import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createApi, myPollIds, myPolls } from "./src/api";
import type { MyPoll } from "./src/api";
import type { Poll, PollResult } from "./src/types";

const api = createApi("");
const { width: SW, height: SH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SW * 0.27;

// ─── Root ────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<"vote" | "create">("vote");
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D10" />
      <View style={s.body}>
        {screen === "vote" ? <VoteScreen /> : <CreateScreen />}
      </View>
      <View style={s.tabBar}>
        <Pressable style={s.tabItem} onPress={() => setScreen("vote")}>
          <Text style={[s.tabIcon, screen === "vote" && s.tabIconActive]}>票</Text>
          <Text style={[s.tabLabel, screen === "vote" && s.tabLabelActive]}>投票</Text>
        </Pressable>
        <Pressable style={s.tabItem} onPress={() => setScreen("create")}>
          <Text style={[s.tabIcon, screen === "create" && s.tabIconActive]}>＋</Text>
          <Text style={[s.tabLabel, screen === "create" && s.tabLabelActive]}>投稿</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Vote Screen ─────────────────────────────────────────

function VoteScreen() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [result, setResult] = useState<PollResult | null>(null);
  const [chosen, setChosen] = useState<"A" | "B" | null>(null);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const [closing, setClosing] = useState(false);

  const resultFade = useRef(new Animated.Value(0)).current;
  const resultSlide = useRef(new Animated.Value(40)).current;
  const barA = useRef(new Animated.Value(0)).current;
  const barB = useRef(new Animated.Value(0)).current;

  const loadNext = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setChosen(null);
    setClosed(false);
    resultFade.setValue(0);
    resultSlide.setValue(40);
    barA.setValue(0);
    barB.setValue(0);
    try {
      await api.initSession();
      setPoll(await api.fetchNextPoll());
      setCardKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNext();
  }, []);

  const showResult = (res: PollResult, pick: "A" | "B" | null, isClosed = false) => {
    setResult(res);
    setChosen(pick);
    setClosed(isClosed);
    Animated.parallel([
      Animated.timing(resultFade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(resultSlide, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.spring(barA, { toValue: res.percent_a / 100, useNativeDriver: false, tension: 55, friction: 10 }),
      Animated.spring(barB, { toValue: res.percent_b / 100, useNativeDriver: false, tension: 55, friction: 10 }),
    ]).start();
  };

  const handleVote = async (selected: "A" | "B") => {
    if (!poll) return;
    try {
      const res = await api.votePoll(poll.id, selected);
      showResult(res, selected);
    } catch (e: any) {
      if (e.closed && e.result) {
        showResult(e.result, null, true);
      } else if (e.message === "already_voted") {
        const res = await api.fetchPollResult(poll.id);
        showResult(res, null, false);
      } else {
        setError(e.message ?? "投票に失敗しました");
        setResult({ votes_a: 0, votes_b: 0, total_votes: 0, percent_a: 0, percent_b: 0 });
        resultFade.setValue(1);
      }
    }
  };

  const handleClose = () => {
    if (!poll) return;
    Alert.alert("今すぐ締め切る", "この質問の受付を終了しますか？この操作は取り消せません。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "締め切る", style: "destructive",
        onPress: async () => {
          setClosing(true);
          try {
            await api.closePoll(poll.id);
            loadNext();
          } catch {
            setError("締め切りに失敗しました");
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  };

  const isPollClosed = poll ? new Date(poll.closes_at).getTime() <= Date.now() : false;
  const isMyPoll = poll ? myPollIds.has(poll.id) : false;

  return (
    <View style={s.voteRoot}>
      {/* Header */}
      <View style={s.voteHeader}>
        <Text style={s.logoText}>Docchi</Text>
        <View style={s.headerBadges}>
          {poll && (isPollClosed || closed) && (
            <View style={s.closedBadge}><Text style={s.closedBadgeText}>締切済み</Text></View>
          )}
          {poll && isMyPoll && !result && !isPollClosed && (
            <Pressable
              style={[s.closeNowBtn, closing && { opacity: 0.5 }]}
              onPress={handleClose}
              disabled={closing}
            >
              <Text style={s.closeNowBtnText}>{closing ? "処理中..." : "締め切る"}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Card area */}
      <View style={s.cardArea}>
        {loading ? (
          <View style={s.loadingWrap}>
            <Text style={s.loadingDots}>・・・</Text>
          </View>
        ) : !poll ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>🤔</Text>
            <Text style={s.emptyTitle}>質問がありません</Text>
            <Text style={s.emptyBody}>「投稿」タブから最初の質問を作ろう</Text>
            <Pressable style={s.reloadBtn} onPress={loadNext}>
              <Text style={s.reloadBtnText}>再読み込み</Text>
            </Pressable>
          </View>
        ) : !result ? (
          <SwipeCard
            key={cardKey}
            poll={poll}
            isPollClosed={isPollClosed}
            onVote={handleVote}
          />
        ) : (
          <Animated.View
            style={[
              s.resultCard,
              {
                opacity: resultFade,
                transform: [{ translateY: resultSlide }],
              },
            ]}
          >
            {chosen && (
              <View style={[s.chosenBanner, { backgroundColor: chosen === "A" ? "#1D4ED8" : "#B91C1C" }]}>
                <Text style={s.chosenBannerText}>
                  {chosen === "A" ? poll.option_a : poll.option_b} を選択
                </Text>
              </View>
            )}
            {closed && !chosen && (
              <View style={s.chosenBanner}>
                <Text style={s.chosenBannerText}>締め切り後のため投票できませんでした</Text>
              </View>
            )}

            <Text style={s.resultCardTitle}>{poll.title}</Text>

            <View style={s.resultBars}>
              <ResultBar
                label="A"
                text={poll.option_a}
                votes={result.votes_a}
                percent={result.percent_a}
                anim={barA}
                color="#2563EB"
                chosen={chosen === "A"}
              />
              <ResultBar
                label="B"
                text={poll.option_b}
                votes={result.votes_b}
                percent={result.percent_b}
                anim={barB}
                color="#DC2626"
                chosen={chosen === "B"}
              />
            </View>

            <Text style={s.totalVotes}>合計 {result.total_votes} 票</Text>

            <Pressable style={s.nextBtn} onPress={loadNext}>
              <Text style={s.nextBtnText}>次の質問へ</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Skip (shown only before vote) */}
      {poll && !result && !loading && (
        <Pressable style={s.skipBtn} onPress={loadNext}>
          <Text style={s.skipBtnText}>スキップ</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Swipe Card ──────────────────────────────────────────

function SwipeCard({
  poll,
  isPollClosed,
  onVote,
}: {
  poll: Poll;
  isPollClosed: boolean;
  onVote: (option: "A" | "B") => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isPollClosed,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !isPollClosed && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 0.8,
      onPanResponderMove: (_, { dx, dy }) => {
        pan.setValue({ x: dx, y: dy * 0.15 });
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const speed = Math.abs(vx) > 0.6;
        if (Math.abs(dx) > SWIPE_THRESHOLD || speed) {
          const dir = dx > 0 ? 1 : -1;
          Animated.timing(pan, {
            toValue: { x: dir * (SW + 100), y: 0 },
            duration: 220,
            useNativeDriver: false,
          }).start(() => onVote(dir > 0 ? "A" : "B"));
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            tension: 200,
            friction: 15,
          }).start();
        }
      },
    })
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SW * 0.6, 0, SW * 0.6],
    outputRange: ["-14deg", "0deg", "14deg"],
    extrapolate: "clamp",
  });

  const aOpacity = pan.x.interpolate({
    inputRange: [SWIPE_THRESHOLD * 0.2, SWIPE_THRESHOLD * 0.8],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const bOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 0.8, -SWIPE_THRESHOLD * 0.2],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const aBgOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 0.18],
    extrapolate: "clamp",
  });

  const bBgOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [0.18, 0],
    extrapolate: "clamp",
  });

  const CARD_H = Math.min(SH * 0.54, 430);

  return (
    <View style={s.swipeCardWrap}>
      {/* Background deck shadows */}
      <View style={[s.deckCard, { bottom: -12, transform: [{ scale: 0.95 }], opacity: 0.45 }]} />
      <View style={[s.deckCard, { bottom: -6, transform: [{ scale: 0.975 }], opacity: 0.7 }]} />

      <Animated.View
        style={[
          s.swipeCard,
          { height: CARD_H },
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { rotate },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Color tint: green for A, red for B */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: "rgba(16,185,129,1)", opacity: aBgOpacity }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: "rgba(239,68,68,1)", opacity: bBgOpacity }]}
          pointerEvents="none"
        />

        {/* A stamp (right swipe indicator) */}
        <Animated.View style={[s.stampA, { opacity: aOpacity }]}>
          <Text style={s.stampLabelA}>A</Text>
          <Text style={s.stampOptionA} numberOfLines={2}>{poll.option_a}</Text>
        </Animated.View>

        {/* B stamp (left swipe indicator) */}
        <Animated.View style={[s.stampB, { opacity: bOpacity }]}>
          <Text style={s.stampLabelB}>B</Text>
          <Text style={s.stampOptionB} numberOfLines={2}>{poll.option_b}</Text>
        </Animated.View>

        {/* Card content */}
        <View style={s.cardBody}>
          <Text style={s.cardQuestion}>{poll.title}</Text>
          <Text style={s.cardDeadline}>
            {isPollClosed ? "締切済み" : formatDeadline(poll.closes_at)}
          </Text>
        </View>

        {/* Bottom swipe guide */}
        <View style={s.cardFooter}>
          <View style={s.footerSide}>
            <Text style={s.footerArrowB}>←</Text>
            <View style={[s.footerBadge, { backgroundColor: "#DC2626" }]}>
              <Text style={s.footerBadgeText}>B</Text>
            </View>
            <Text style={s.footerOptionB} numberOfLines={1}>{poll.option_b}</Text>
          </View>

          <View style={s.footerDivider} />

          <View style={[s.footerSide, s.footerSideRight]}>
            <Text style={s.footerOptionA} numberOfLines={1}>{poll.option_a}</Text>
            <View style={[s.footerBadge, { backgroundColor: "#2563EB" }]}>
              <Text style={s.footerBadgeText}>A</Text>
            </View>
            <Text style={s.footerArrowA}>→</Text>
          </View>
        </View>

        {isPollClosed && (
          <View style={s.closedOverlay}>
            <Text style={s.closedOverlayText}>この質問は締め切り済みです</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Result Bar ──────────────────────────────────────────

function ResultBar({
  label, text, votes, percent, anim, color, chosen,
}: {
  label: string; text: string; votes: number; percent: number;
  anim: Animated.Value; color: string; chosen: boolean;
}) {
  const barWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={[s.resultRow, chosen && { borderColor: color, borderWidth: 2 }]}>
      <View style={s.resultTopRow}>
        <View style={[s.resultBadge, { backgroundColor: color }]}>
          <Text style={s.resultBadgeText}>{label}</Text>
        </View>
        <Text style={s.resultOptionText} numberOfLines={1}>{text}</Text>
        {chosen && (
          <View style={[s.yourChoice, { borderColor: color }]}>
            <Text style={[s.yourChoiceText, { color }]}>あなた</Text>
          </View>
        )}
        <Text style={[s.resultPercent, { color }]}>{percent}%</Text>
      </View>
      <View style={s.barTrack}>
        <Animated.View style={[s.barFill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={s.resultVoteCount}>{votes} 票</Text>
    </View>
  );
}

function MiniBar({ label, percent, anim, color }: {
  label: string; percent: number; anim: Animated.Value; color: string;
}) {
  const barWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={s.miniBarRow}>
      {label ? <Text style={[s.miniBarLabel, { color }]}>{label}</Text> : null}
      <View style={s.miniBarTrack}>
        <Animated.View style={[s.miniBarFill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={s.miniBarPercent}>{percent}%</Text>
    </View>
  );
}

// ─── Create Screen ───────────────────────────────────────

const DEADLINE_PRESETS = [
  { label: "30分", value: 30 },
  { label: "1時間", value: 60 },
  { label: "半日", value: 720 },
  { label: "1日", value: 1440 },
  { label: "3日", value: 4320 },
];

function CreateScreen() {
  const [title, setTitle] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [customInput, setCustomInput] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [myPollList, setMyPollList] = useState<MyPoll[]>([]);

  const effectiveMinutes = useCustom ? Number(customInput) : minutes;

  const submit = async () => {
    const t = title.trim(), a = optionA.trim(), b = optionB.trim();
    const mins = effectiveMinutes;
    if (t.length < 1 || t.length > 60) return setStatus({ msg: "タイトルは1〜60文字で入力してください", ok: false });
    if (a.length < 1 || a.length > 30) return setStatus({ msg: "選択肢Aは1〜30文字で入力してください", ok: false });
    if (b.length < 1 || b.length > 30) return setStatus({ msg: "選択肢Bは1〜30文字で入力してください", ok: false });
    if (!Number.isInteger(mins) || mins < 1 || mins > 4320) return setStatus({ msg: "締切は1〜4320分で指定してください", ok: false });
    setSubmitting(true);
    setStatus(null);
    try {
      await api.initSession();
      await api.createPoll({ title: t, option_a: a, option_b: b, close_in_minutes: mins, turnstile_token: "" });
      setTitle(""); setOptionA(""); setOptionB("");
      setMinutes(60); setCustomInput(""); setUseCustom(false);
      setMyPollList(Array.from(myPolls.values()).reverse());
      setStatus({ msg: "投稿しました！みんなが投票してくれるよ", ok: true });
    } catch (e) {
      setStatus({ msg: e instanceof Error ? e.message : "投稿に失敗しました", ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={s.createScroll} contentContainerStyle={s.createContent} keyboardShouldPersistTaps="handled">
        <Text style={s.createTitle}>みんなに聞いてみよう</Text>

        <Text style={s.fieldLabel}>質問 <Text style={s.charCount}>{title.length}/60</Text></Text>
        <TextInput
          style={s.textArea}
          placeholder="例: 猫と犬、どっちが好き？"
          placeholderTextColor="#AEAEB2"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          multiline
          numberOfLines={2}
        />

        <View style={s.optionsRow}>
          <View style={s.optionCol}>
            <Text style={[s.fieldLabel, { color: "#2563EB" }]}>A <Text style={s.charCount}>{optionA.length}/30</Text></Text>
            <TextInput
              style={[s.optionInput, { borderColor: "#BFDBFE" }]}
              placeholder="選択肢A"
              placeholderTextColor="#AEAEB2"
              value={optionA}
              onChangeText={setOptionA}
              maxLength={30}
            />
          </View>
          <Text style={s.optionVs}>vs</Text>
          <View style={s.optionCol}>
            <Text style={[s.fieldLabel, { color: "#DC2626" }]}>B <Text style={s.charCount}>{optionB.length}/30</Text></Text>
            <TextInput
              style={[s.optionInput, { borderColor: "#FECACA" }]}
              placeholder="選択肢B"
              placeholderTextColor="#AEAEB2"
              value={optionB}
              onChangeText={setOptionB}
              maxLength={30}
            />
          </View>
        </View>

        <Text style={s.fieldLabel}>締切</Text>
        <View style={s.presetRow}>
          {DEADLINE_PRESETS.map((p) => (
            <Pressable
              key={p.value}
              style={[s.presetChip, !useCustom && minutes === p.value && s.presetChipActive]}
              onPress={() => { setMinutes(p.value); setUseCustom(false); }}
            >
              <Text style={[s.presetChipText, !useCustom && minutes === p.value && s.presetChipTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[s.presetChip, useCustom && s.presetChipActive]}
            onPress={() => setUseCustom(true)}
          >
            <Text style={[s.presetChipText, useCustom && s.presetChipTextActive]}>カスタム</Text>
          </Pressable>
        </View>
        {useCustom && (
          <TextInput
            style={s.customMinInput}
            placeholder="分単位で入力（1〜4320）"
            placeholderTextColor="#AEAEB2"
            keyboardType="numeric"
            value={customInput}
            onChangeText={setCustomInput}
          />
        )}

        {status && (
          <View style={[s.statusBox, { backgroundColor: status.ok ? "#F0FDF4" : "#FEF2F2", borderColor: status.ok ? "#86EFAC" : "#FECACA" }]}>
            <Text style={[s.statusText, { color: status.ok ? "#166534" : "#991B1B" }]}>{status.msg}</Text>
          </View>
        )}

        <Pressable style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
          <Text style={s.submitBtnText}>{submitting ? "投稿中..." : "投稿する"}</Text>
        </Pressable>

        {myPollList.length > 0 && (
          <View style={s.myPollsSection}>
            <Text style={s.myPollsSectionTitle}>自分の投稿</Text>
            {myPollList.map((p) => (
              <MyPollCard
                key={p.id}
                poll={p}
                onClose={() => {
                  setMyPollList((prev) =>
                    prev.map((x) => x.id === p.id ? { ...x, closes_at: new Date().toISOString() } : x)
                  );
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MyPollCard({ poll, onClose }: { poll: MyPoll; onClose: () => void }) {
  const [result, setResult] = useState<PollResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const barA = useRef(new Animated.Value(0)).current;
  const barB = useRef(new Animated.Value(0)).current;
  const isClosed = new Date(poll.closes_at).getTime() <= Date.now();

  const fetchResult = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.fetchPollResult(poll.id);
      setResult(res);
      Animated.parallel([
        Animated.spring(barA, { toValue: res.percent_a / 100, useNativeDriver: false }),
        Animated.spring(barB, { toValue: res.percent_b / 100, useNativeDriver: false }),
      ]).start();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResult(); }, []);

  const handleClose = () => {
    Alert.alert("今すぐ締め切る", `「${poll.title}」を締め切りますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "締め切る", style: "destructive",
        onPress: async () => {
          setClosing(true);
          try { await api.closePoll(poll.id); onClose(); } catch { /* already closed */ }
          finally { setClosing(false); }
        },
      },
    ]);
  };

  return (
    <View style={s.myPollCard}>
      <View style={s.myPollHeader}>
        <Text style={s.myPollTitle} numberOfLines={2}>{poll.title}</Text>
        {isClosed
          ? <View style={s.closedBadge}><Text style={s.closedBadgeText}>締切済み</Text></View>
          : <Pressable style={[s.closeNowBtn, closing && { opacity: 0.5 }]} onPress={handleClose} disabled={closing}>
              <Text style={s.closeNowBtnText}>{closing ? "処理中..." : "締め切る"}</Text>
            </Pressable>
        }
      </View>
      {!isClosed && <Text style={s.myPollDeadline}>締切 {formatDeadline(poll.closes_at)}</Text>}
      {loading && <Text style={s.myPollLoading}>集計中...</Text>}
      {result && (
        <View style={s.myPollResult}>
          <View style={s.myPollResultRow}>
            <Text style={[s.myPollOptionLabel, { color: "#2563EB" }]}>A</Text>
            <Text style={s.myPollOptionText} numberOfLines={1}>{poll.option_a}</Text>
            <Text style={[s.myPollPercent, { color: "#2563EB" }]}>{result.percent_a}%</Text>
            <Text style={s.myPollVotes}>{result.votes_a}票</Text>
          </View>
          <MiniBar label="" percent={result.percent_a} anim={barA} color="#2563EB" />
          <View style={[s.myPollResultRow, { marginTop: 8 }]}>
            <Text style={[s.myPollOptionLabel, { color: "#DC2626" }]}>B</Text>
            <Text style={s.myPollOptionText} numberOfLines={1}>{poll.option_b}</Text>
            <Text style={[s.myPollPercent, { color: "#DC2626" }]}>{result.percent_b}%</Text>
            <Text style={s.myPollVotes}>{result.votes_b}票</Text>
          </View>
          <MiniBar label="" percent={result.percent_b} anim={barB} color="#DC2626" />
          <Text style={s.myPollTotal}>合計 {result.total_votes} 票</Text>
        </View>
      )}
      <Pressable style={s.refreshBtn} onPress={fetchResult} disabled={loading}>
        <Text style={s.refreshBtnText}>{loading ? "更新中..." : "票数を更新"}</Text>
      </Pressable>
    </View>
  );
}

// ─── Utils ───────────────────────────────────────────────

function formatDeadline(closesAt: string): string {
  const d = new Date(closesAt);
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "締切済み";
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return `あと${Math.floor(diffMs / 60000)}分`;
  if (diffH < 24) return `あと${diffH}時間`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}まで`;
}

// ─── Styles ──────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D10" },
  body: { flex: 1 },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#1E1E24",
    backgroundColor: "#0D0D10",
    paddingBottom: Platform.OS === "ios" ? 0 : 4,
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2 },
  tabIcon: { fontSize: 18, color: "#4B4B58" },
  tabIconActive: { color: "#FFFFFF" },
  tabLabel: { fontSize: 11, color: "#4B4B58" },
  tabLabelActive: { color: "#FFFFFF", fontWeight: "700" },

  // Vote screen
  voteRoot: { flex: 1, backgroundColor: "#0D0D10" },
  voteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoText: { fontSize: 26, fontWeight: "900", color: "#FFFFFF", letterSpacing: -1 },
  headerBadges: { flexDirection: "row", alignItems: "center", gap: 8 },
  closedBadge: {
    backgroundColor: "#1E1E24",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  closedBadgeText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  closeNowBtn: {
    backgroundColor: "rgba(185, 28, 28, 0.15)",
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.4)",
  },
  closeNowBtnText: { fontSize: 12, fontWeight: "700", color: "#F87171" },

  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: { fontSize: 13, color: "#F87171" },

  cardArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  // Loading / Empty
  loadingWrap: { alignItems: "center", justifyContent: "center", gap: 16 },
  loadingDots: { fontSize: 28, color: "#4B4B58", letterSpacing: 6 },
  emptyWrap: { alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  emptyBody: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22 },
  reloadBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#2A2A32",
  },
  reloadBtnText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  // Swipe card
  swipeCardWrap: {
    width: SW - 32,
    alignItems: "center",
    position: "relative",
  },
  deckCard: {
    position: "absolute",
    width: SW - 32,
    height: Math.min(SH * 0.54, 430),
    backgroundColor: "#1A1A22",
    borderRadius: 24,
  },
  swipeCard: {
    width: SW - 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  stampA: {
    position: "absolute",
    top: 24,
    left: 20,
    alignItems: "flex-start",
    zIndex: 10,
  },
  stampLabelA: {
    fontSize: 48,
    fontWeight: "900",
    color: "#10B981",
    lineHeight: 52,
    textShadowColor: "rgba(16,185,129,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    borderWidth: 3,
    borderColor: "#10B981",
    borderRadius: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  stampOptionA: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10B981",
    marginTop: 4,
    maxWidth: 160,
  },
  stampB: {
    position: "absolute",
    top: 24,
    right: 20,
    alignItems: "flex-end",
    zIndex: 10,
  },
  stampLabelB: {
    fontSize: 48,
    fontWeight: "900",
    color: "#EF4444",
    lineHeight: 52,
    textShadowColor: "rgba(239,68,68,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    borderWidth: 3,
    borderColor: "#EF4444",
    borderRadius: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  stampOptionB: {
    fontSize: 16,
    fontWeight: "800",
    color: "#EF4444",
    marginTop: 4,
    maxWidth: 160,
    textAlign: "right",
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    paddingTop: 40,
    paddingBottom: 20,
  },
  cardQuestion: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F0F11",
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  cardDeadline: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "#FAFAFA",
  },
  footerSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerSideRight: { justifyContent: "flex-end" },
  footerArrowB: { fontSize: 16, fontWeight: "800", color: "#DC2626" },
  footerArrowA: { fontSize: 16, fontWeight: "800", color: "#2563EB" },
  footerBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBadgeText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  footerOptionB: { flex: 1, fontSize: 12, fontWeight: "700", color: "#DC2626" },
  footerOptionA: { flex: 1, fontSize: 12, fontWeight: "700", color: "#2563EB", textAlign: "right" },
  footerDivider: { width: 1, height: 24, backgroundColor: "#E5E7EB", marginHorizontal: 8 },
  closedOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 14,
    alignItems: "center",
  },
  closedOverlayText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Result card
  resultCard: {
    width: SW - 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  chosenBanner: {
    backgroundColor: "#1D4ED8",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  chosenBannerText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  resultCardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F0F11",
    padding: 20,
    paddingBottom: 8,
    lineHeight: 28,
  },
  resultBars: { paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  resultRow: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  resultTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBadgeText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  resultOptionText: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111827" },
  yourChoice: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  yourChoiceText: { fontSize: 11, fontWeight: "700" },
  resultPercent: { fontSize: 20, fontWeight: "900" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#E5E7EB", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  resultVoteCount: { fontSize: 12, color: "#9CA3AF" },
  totalVotes: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 8,
  },
  nextBtn: {
    backgroundColor: "#0F0F11",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  nextBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },

  skipBtn: { alignSelf: "center", paddingVertical: 16, paddingHorizontal: 32 },
  skipBtnText: { fontSize: 14, color: "#4B4B58", fontWeight: "600" },

  // Mini bar
  miniBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniBarLabel: { fontSize: 13, fontWeight: "800", width: 16 },
  miniBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#E5E7EB", overflow: "hidden" },
  miniBarFill: { height: 6, borderRadius: 3 },
  miniBarPercent: { fontSize: 12, fontWeight: "700", color: "#374151", width: 36, textAlign: "right" },

  // Create screen
  createScroll: { flex: 1, backgroundColor: "#FFFFFF" },
  createContent: { padding: 20, gap: 4, paddingBottom: 48 },
  createTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F0F11",
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 6 },
  charCount: { fontWeight: "400", color: "#9CA3AF" },
  textArea: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#111827",
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  optionsRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 16 },
  optionCol: { flex: 1 },
  optionVs: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", paddingBottom: 14 },
  optionInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#111827",
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  presetChipActive: { borderColor: "#0F0F11", backgroundColor: "#0F0F11" },
  presetChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  presetChipTextActive: { color: "#fff" },
  customMinInput: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#111827",
    marginBottom: 12,
  },
  statusBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 4 },
  statusText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  submitBtn: {
    backgroundColor: "#0F0F11",
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 12,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  myPollsSection: { marginTop: 28, gap: 12 },
  myPollsSectionTitle: { fontSize: 16, fontWeight: "800", color: "#0F0F11" },
  myPollCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  myPollHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  myPollTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111827" },
  myPollDeadline: { fontSize: 11, color: "#9CA3AF" },
  myPollLoading: { fontSize: 12, color: "#9CA3AF" },
  myPollResult: { gap: 4, marginTop: 4 },
  myPollResultRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  myPollOptionLabel: { fontSize: 13, fontWeight: "800", width: 16 },
  myPollOptionText: { flex: 1, fontSize: 13, color: "#374151" },
  myPollPercent: { fontSize: 14, fontWeight: "800" },
  myPollVotes: { fontSize: 11, color: "#9CA3AF", width: 30, textAlign: "right" },
  myPollTotal: { fontSize: 12, color: "#9CA3AF", textAlign: "right", marginTop: 4 },
  refreshBtn: {
    alignSelf: "flex-end",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  refreshBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },
});
