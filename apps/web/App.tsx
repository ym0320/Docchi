import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  Share,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createApi, myPollIds, myPolls } from "./src/api";
import type { MyPoll, MyPollWithStats } from "./src/api";
import type { Poll, PollResult, VoteOption } from "./src/types";

const api = createApi("");
const { width: SW, height: SH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SW * 0.27;
const MAX_CUSTOM_MINUTES = 4320;
const SUPPORT_EMAIL = "support@docchi.app";
const PRIVACY_URL = "https://example.com/docchi/privacy";
const TERMS_URL = "https://example.com/docchi/terms";
const APP_VERSION = "1.0.0";
const MONO = {
  black: "#050505",
  ink: "#111111",
  text: "#171717",
  textSoft: "#404040",
  textMuted: "#737373",
  textFaint: "#a3a3a3",
  white: "#fafafa",
  surface: "#f5f5f5",
  surfaceStrong: "#ebebeb",
  surfaceMuted: "#e5e5e5",
  line: "#d4d4d4",
  darkBg: "#0a0a0a",
  darkPanel: "#141414",
  darkPanelSoft: "#1c1c1c",
  darkLine: "#2a2a2a",
  choiceA: "#dc2626",
  choiceB: "#2563eb",
  choiceBText: "#1d4ed8",
  overlayA: "#dc2626",
  overlayB: "#2563eb",
  dangerBg: "rgba(255,255,255,0.08)",
  dangerLine: "rgba(255,255,255,0.2)",
};
type RootScreen = "vote" | "create" | "settings";
type TabKind = "vote" | "create" | "settings";

function activeTabForScreen(screen: RootScreen): TabKind {
  return screen;
}

async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("リンクを開けませんでした", url);
  }
}

// ─── Root ────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<RootScreen>("vote");
  const activeTab = activeTabForScreen(screen);
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={MONO.darkBg} />
      <View style={s.body}>
        {screen === "vote" && <VoteScreen />}
        {screen === "create" && <CreateScreen />}
        {screen === "settings" && <SettingsScreen />}
      </View>
      <View style={s.tabBar}>
        <Pressable style={s.tabItem} onPress={() => setScreen("vote")}>
          <TabGlyph kind="vote" active={activeTab === "vote"} />
          <Text style={[s.tabLabel, activeTab === "vote" && s.tabLabelActive]}>投票</Text>
        </Pressable>
        <Pressable style={s.tabItem} onPress={() => setScreen("create")}>
          <TabGlyph kind="create" active={activeTab === "create"} />
          <Text style={[s.tabLabel, activeTab === "create" && s.tabLabelActive]}>投稿</Text>
        </Pressable>
        <Pressable style={s.tabItem} onPress={() => setScreen("settings")}>
          <TabGlyph kind="settings" active={activeTab === "settings"} />
          <Text style={[s.tabLabel, activeTab === "settings" && s.tabLabelActive]}>設定</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TabGlyph({ kind, active }: { kind: TabKind; active: boolean }) {
  const tint = active ? MONO.white : MONO.textMuted;
  const icon =
    kind === "vote" ? (active ? "bar-chart" : "bar-chart-outline") :
    kind === "create" ? (active ? "create" : "create-outline") :
    (active ? "settings" : "settings-outline");

  return (
    <View style={[s.tabGlyphFrame, active && s.tabGlyphFrameActive]}>
      <Ionicons name={icon as any} size={22} color={tint} />
    </View>
  );
}

// ─── Vote Screen ─────────────────────────────────────────

function VoteScreen() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [result, setResult] = useState<PollResult | null>(null);
  const [chosen, setChosen] = useState<VoteOption | null>(null);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const [closing, setClosing] = useState(false);

  const resultFade = useRef(new Animated.Value(0)).current;
  const resultSlide = useRef(new Animated.Value(40)).current;
  const barA = useRef(new Animated.Value(0)).current;
  const barB = useRef(new Animated.Value(0)).current;
  const barC = useRef(new Animated.Value(0)).current;

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
    barC.setValue(0);
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

  const showResult = (res: PollResult, pick: VoteOption | null, isClosed = false) => {
    setResult(res);
    setChosen(pick);
    setClosed(isClosed);
    Animated.parallel([
      Animated.timing(resultFade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(resultSlide, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.spring(barA, { toValue: res.percent_a / 100, useNativeDriver: false, tension: 55, friction: 10 }),
      Animated.spring(barB, { toValue: res.percent_b / 100, useNativeDriver: false, tension: 55, friction: 10 }),
      Animated.spring(barC, { toValue: res.percent_c / 100, useNativeDriver: false, tension: 55, friction: 10 }),
    ]).start();
  };

  const handleVote = async (selected: VoteOption) => {
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
        setResult({ votes_a: 0, votes_b: 0, votes_c: 0, total_votes: 0, percent_a: 0, percent_b: 0, percent_c: 0 });
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

  const handleReportPoll = () => {
    if (!poll) return;
    Alert.alert("この投稿を通報", "どの理由で通報しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "スパム",
        onPress: async () => {
          try {
            await api.initSession();
            await api.reportPoll(poll.id, { reason: "spam" });
            setError(null);
            Alert.alert("通報しました", "確認のため、この投稿は次の表示候補から外します。");
            loadNext();
          } catch (e) {
            setError(e instanceof Error ? e.message : "通報に失敗しました");
          }
        },
      },
      {
        text: "不快 / 不適切",
        style: "destructive",
        onPress: async () => {
          try {
            await api.initSession();
            await api.reportPoll(poll.id, { reason: "abuse" });
            setError(null);
            Alert.alert("通報しました", "安全確認のため、内容を記録しました。");
            loadNext();
          } catch (e) {
            setError(e instanceof Error ? e.message : "通報に失敗しました");
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
          {poll && !result && (
            <Pressable style={s.reportBtn} onPress={handleReportPoll}>
              <Text style={s.reportBtnText}>通報</Text>
            </Pressable>
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
              <View style={[s.chosenBanner, { backgroundColor: chosen === "A" ? MONO.choiceA : chosen === "B" ? MONO.choiceB : "#7c3aed" }]}>
                <Text style={s.chosenBannerText}>
                  {chosen === "A" ? poll.option_a : chosen === "B" ? poll.option_b : poll.option_c} を選択
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
                color={MONO.choiceA}
                chosen={chosen === "A"}
              />
              <ResultBar
                label="B"
                text={poll.option_b}
                votes={result.votes_b}
                percent={result.percent_b}
                anim={barB}
                color={MONO.choiceB}
                chosen={chosen === "B"}
              />
              {poll.option_c ? (
                <ResultBar
                  label="C"
                  text={poll.option_c}
                  votes={result.votes_c}
                  percent={result.percent_c}
                  anim={barC}
                  color="#7c3aed"
                  chosen={chosen === "C"}
                />
              ) : null}
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
  onVote: (option: VoteOption) => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const tapHintA = useRef(new Animated.Value(0)).current;
  const tapHintB = useRef(new Animated.Value(0)).current;
  const tapHintC = useRef(new Animated.Value(0)).current;
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;
  const [swipeHintText, setSwipeHintText] = useState<string | null>(null);
  const hasOptionC = Boolean(poll.option_c);
  const CARD_H = Math.min(SH * 0.54, 430);

  const playSwipeHint = (kind: VoteOption) => {
    const pulse = kind === "A" ? tapHintA : kind === "B" ? tapHintB : tapHintC;
    setSwipeHintText(kind === "C" ? "上にスワイプしてCを選択" : "タップではなくスワイプで選択");
    pulse.setValue(0);
    swipeHintOpacity.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 0, friction: 4, tension: 150, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(swipeHintOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(swipeHintOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !isPollClosed && (
          Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 0.8
          || (hasOptionC && dy < -6 && Math.abs(dy) > Math.abs(dx) * 0.9)
        ),
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
        !isPollClosed && (
          Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 0.8
          || (hasOptionC && dy < -6 && Math.abs(dy) > Math.abs(dx) * 0.9)
        ),
      onPanResponderMove: (_, { dx, dy }) => {
        pan.setValue({ x: dx, y: hasOptionC ? dy * 0.22 : dy * 0.15 });
      },
      onPanResponderRelease: (_, { dx, dy, vx, vy }) => {
        const chooseC = hasOptionC && (
          (dy < -56 && Math.abs(dy) > Math.abs(dx) * 0.9) ||
          vy < -0.65
        );
        const speed = Math.abs(vx) > 0.6;
        if (chooseC) {
          Animated.timing(pan, {
            toValue: { x: 0, y: -CARD_H - 120 },
            duration: 220,
            useNativeDriver: false,
          }).start(() => onVote("C"));
        } else if (Math.abs(dx) > SWIPE_THRESHOLD || speed) {
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
    inputRange: [0, SWIPE_THRESHOLD * 0.35, SWIPE_THRESHOLD, SW * 0.7],
    outputRange: [0, 0.12, 0.36, 0.62],
    extrapolate: "clamp",
  });

  const bBgOpacity = pan.x.interpolate({
    inputRange: [-SW * 0.7, -SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.35, 0],
    outputRange: [0.62, 0.36, 0.12, 0],
    extrapolate: "clamp",
  });
  const cOpacity = pan.y.interpolate({
    inputRange: [-CARD_H * 0.5, -48, 0],
    outputRange: [1, 0.2, 0],
    extrapolate: "clamp",
  });
  const cBgOpacity = pan.y.interpolate({
    inputRange: [-CARD_H * 0.6, -56, 0],
    outputRange: [0.58, 0.18, 0],
    extrapolate: "clamp",
  });
  const aTapTranslate = tapHintA.interpolate({ inputRange: [0, 1], outputRange: [0, 7] });
  const bTapTranslate = tapHintB.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const cTapTranslate = tapHintC.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const tapScaleA = tapHintA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const tapScaleB = tapHintB.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const tapScaleC = tapHintC.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const swipeHintY = swipeHintOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

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
        {/* Swipe tint grows stronger as the card gets closer to commit */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: MONO.overlayA, opacity: aBgOpacity }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: MONO.overlayB, opacity: bBgOpacity }]}
          pointerEvents="none"
        />
        {hasOptionC && (
          <Animated.View
            style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: "#7c3aed", opacity: cBgOpacity }]}
            pointerEvents="none"
          />
        )}

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
        {hasOptionC && (
          <Animated.View style={[s.stampC, { opacity: cOpacity }]}>
            <Text style={s.stampLabelC}>C</Text>
            <Text style={s.stampOptionC} numberOfLines={2}>{poll.option_c}</Text>
          </Animated.View>
        )}

        {/* Card content */}
        <View style={s.cardTop}>
          <Text style={s.cardQuestion}>{poll.title}</Text>
          <Text style={s.cardDeadline}>
            {isPollClosed ? "締切済み" : formatDeadline(poll.closes_at)}
          </Text>
        </View>

        {/* Large choice panels */}
        <View style={s.choicePanels}>
          <Pressable onPress={() => playSwipeHint("B")} style={s.choicePanelPressable}>
          <Animated.View style={[s.choicePanelB, { transform: [{ translateX: bTapTranslate }, { scale: tapScaleB }] }]}>
            <Text style={s.choicePanelArrow}>←</Text>
            <View style={[s.choicePanelBadge, { backgroundColor: MONO.choiceB }]}>
              <Text style={s.choicePanelBadgeText}>B</Text>
            </View>
            <Text style={s.choicePanelText}>{poll.option_b}</Text>
          </Animated.View>
          </Pressable>

          <View style={s.choiceDivider} />

          <Pressable onPress={() => playSwipeHint("A")} style={s.choicePanelPressable}>
          <Animated.View style={[s.choicePanelA, { transform: [{ translateX: aTapTranslate }, { scale: tapScaleA }] }]}>
            <Text style={s.choicePanelArrow}>→</Text>
            <View style={[s.choicePanelBadge, { backgroundColor: MONO.choiceA }]}>
              <Text style={s.choicePanelBadgeText}>A</Text>
            </View>
            <Text style={s.choicePanelText}>{poll.option_a}</Text>
          </Animated.View>
          </Pressable>
          {hasOptionC && (
            <Pressable style={s.choicePanelCAnchor} onPress={() => playSwipeHint("C")}>
              <Animated.View style={[s.choicePanelC, { transform: [{ translateY: cTapTranslate }, { scale: tapScaleC }] }]}>
                <Text style={s.choicePanelArrowUp}>↑</Text>
                <View style={[s.choicePanelBadge, { backgroundColor: "#7c3aed" }]}>
                  <Text style={s.choicePanelBadgeText}>C</Text>
                </View>
                <Text style={s.choicePanelCText} numberOfLines={2}>{poll.option_c}</Text>
              </Animated.View>
            </Pressable>
          )}
        </View>
        {swipeHintText ? (
          <Animated.View style={[s.swipeHintBubble, { opacity: swipeHintOpacity, transform: [{ translateY: swipeHintY }] }]}>
            <Text style={s.swipeHintText}>{swipeHintText}</Text>
          </Animated.View>
        ) : null}

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

// ─── History Screen ──────────────────────────────────────

function HistoryScreen() {
  const [polls, setPolls] = useState<MyPollWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.initSession();
      const data = await api.fetchMyPolls();
      setPolls(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClose = (poll: MyPollWithStats) => {
    Alert.alert("今すぐ締め切る", `「${poll.title}」を締め切りますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "締め切る", style: "destructive",
        onPress: async () => {
          setClosingId(poll.id);
          try {
            await api.closePoll(poll.id);
            setPolls((prev) =>
              prev.map((p) => p.id === poll.id ? { ...p, closed: true, closes_at: new Date().toISOString() } : p)
            );
          } catch { /* already closed */ }
          finally { setClosingId(null); }
        },
      },
    ]);
  };

  return (
    <View style={s.historyRoot}>
      <View style={s.historyHeader}>
        <Text style={s.historyTitle}>自分の投稿</Text>
        <Pressable style={s.historyRefreshBtn} onPress={load} disabled={loading}>
          <Text style={s.historyRefreshText}>{loading ? "更新中..." : "更新"}</Text>
        </Pressable>
      </View>

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView style={s.historyScroll} contentContainerStyle={s.historyContent}>
        {loading && polls.length === 0 ? (
          <View style={s.historyCentered}>
            <Text style={s.historyEmptyText}>読み込み中...</Text>
          </View>
        ) : polls.length === 0 ? (
          <View style={s.historyCentered}>
            <Text style={s.historyEmptyText}>まだ投稿がありません</Text>
            <Text style={s.historyEmptyBody}>「投稿」タブから質問を作ってみよう</Text>
          </View>
        ) : (
          polls.map((poll) => (
            <HistoryCard
              key={poll.id}
              poll={poll}
              closing={closingId === poll.id}
              onClose={() => handleClose(poll)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function HistoryCard({
  poll,
  closing,
  onClose,
}: {
  poll: MyPollWithStats;
  closing: boolean;
  onClose: () => void;
}) {
  const barA = useRef(new Animated.Value(0)).current;
  const barB = useRef(new Animated.Value(0)).current;
  const barC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(barA, { toValue: poll.percent_a / 100, useNativeDriver: false, tension: 60 }),
      Animated.spring(barB, { toValue: poll.percent_b / 100, useNativeDriver: false, tension: 60 }),
      Animated.spring(barC, { toValue: poll.percent_c / 100, useNativeDriver: false, tension: 60 }),
    ]).start();
  }, [poll.percent_a, poll.percent_b, poll.percent_c]);

  const barAWidth = barA.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const barBWidth = barB.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const barCWidth = barC.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[s.historyCard, poll.closed && s.historyCardClosed]}>
      <View style={s.historyCardHeader}>
        <Text style={s.historyCardTitle} numberOfLines={2}>{poll.title}</Text>
        {poll.closed
          ? <View style={s.hClosedBadge}><Text style={s.hClosedBadgeText}>締切済み</Text></View>
          : (
            <Pressable
              style={[s.hCloseBtn, closing && { opacity: 0.5 }]}
              onPress={onClose}
              disabled={closing}
            >
              <Text style={s.hCloseBtnText}>{closing ? "処理中..." : "締め切る"}</Text>
            </Pressable>
          )
        }
      </View>

      {!poll.closed && (
        <Text style={s.historyDeadline}>締切 {formatDeadline(poll.closes_at)}</Text>
      )}

      <Text style={s.historyTotalVotes}>合計 {poll.total_votes} 票</Text>

      <View style={s.historyBarRow}>
        <View style={[s.historyOptionBadge, { backgroundColor: MONO.choiceA }]}>
          <Text style={s.historyOptionBadgeText}>A</Text>
        </View>
        <Text style={s.historyOptionText} numberOfLines={1}>{poll.option_a}</Text>
        <Text style={[s.historyPercent, { color: MONO.choiceA }]}>{poll.percent_a}%</Text>
      </View>
      <View style={s.hBarTrack}>
        <Animated.View style={[s.hBarFill, { width: barAWidth, backgroundColor: MONO.choiceA }]} />
      </View>

      <View style={[s.historyBarRow, { marginTop: 10 }]}>
        <View style={[s.historyOptionBadge, { backgroundColor: MONO.choiceB }]}>
          <Text style={s.historyOptionBadgeText}>B</Text>
        </View>
        <Text style={s.historyOptionText} numberOfLines={1}>{poll.option_b}</Text>
        <Text style={[s.historyPercent, { color: MONO.choiceBText }]}>{poll.percent_b}%</Text>
      </View>
      <View style={s.hBarTrack}>
        <Animated.View style={[s.hBarFill, { width: barBWidth, backgroundColor: MONO.choiceB }]} />
      </View>
      {poll.option_c ? (
        <>
          <View style={[s.historyBarRow, { marginTop: 10 }]}>
            <View style={[s.historyOptionBadge, { backgroundColor: "#7c3aed" }]}>
              <Text style={s.historyOptionBadgeText}>C</Text>
            </View>
            <Text style={s.historyOptionText} numberOfLines={1}>{poll.option_c}</Text>
            <Text style={[s.historyPercent, { color: "#7c3aed" }]}>{poll.percent_c}%</Text>
          </View>
          <View style={s.hBarTrack}>
            <Animated.View style={[s.hBarFill, { width: barCWidth, backgroundColor: "#7c3aed" }]} />
          </View>
        </>
      ) : null}
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

type SamplePoll = {
  id: string;
  title: string;
  option_a: string;
  option_b: string;
  option_c?: string;
  note: string;
};

function createSamplePolls(): SamplePoll[] {
  return [
    {
      id: "sample-outfit-office",
      title: "今日の出社、ジャケット着ていく？それともシャツだけにする？",
      option_a: "ジャケットを着ていく",
      option_b: "シャツだけで行く",
      note: "その日の自分の動きを決めきれないときに、他人の一票を背中押しにする使い方です。",
    },
    {
      id: "sample-lunch-alone",
      title: "今日のお昼、ひとりで外に食べに行く？それとも社内で済ませる？",
      option_a: "外に食べに行く",
      option_b: "社内で済ませる",
      note: "小さな行動でも自分では決めきれない、という優柔不断さにそのまま寄せたサンプルです。",
    },
    {
      id: "sample-message-crush",
      title: "気になってる人に、今日こそ連絡する？まだ送らない？",
      option_a: "今夜送る",
      option_b: "今日はやめておく",
      note: "自分の感情が絡む選択ほど、他人に委ねる意味が出ます。",
    },
    {
      id: "sample-laundry-night",
      title: "洗濯物、今夜のうちに回す？明日の朝に回す？",
      option_a: "今夜やる",
      option_b: "明日の朝やる",
      note: "生活の中の先延ばし判断を、ひとりで抱え込まず決めるためのサンプルです。",
    },
    {
      id: "sample-buy-shoes",
      title: "迷ってるスニーカー、今日買う？いったん見送る？",
      option_a: "今日買う",
      option_b: "今回は見送る",
      note: "買うかやめるかの最終判断を委ねると、衝動買いの言い訳にも歯止めにもなります。",
    },
    {
      id: "sample-gym",
      title: "仕事終わり、ジムに行く？今日はまっすぐ帰る？",
      option_a: "ジムに行く",
      option_b: "今日は帰って休む",
      note: "意志の弱さを自覚している日の選択ほど、このアプリのコンセプトに合います。",
    },
    {
      id: "sample-haircut",
      title: "美容室、予約するなら今日入れる？それとも来週まで伸ばす？",
      option_a: "今日予約する",
      option_b: "来週まで待つ",
      note: "後回しにしがちな用事を、投票結果で実行に移しやすくするイメージです。",
    },
    {
      id: "sample-weekend-plan",
      title: "この土日、実家に帰る？ひとりで家で休む？",
      option_a: "実家に帰る",
      option_b: "家でゆっくり休む",
      option_c: "予定を入れて外に出る",
      note: "気分も体力も絡む週末の決断を、第三者に委ねるための3択です。",
    },
    {
      id: "sample-overtime",
      title: "このタスク、今日残って終わらせる？明日の朝に回す？",
      option_a: "今日やり切る",
      option_b: "明日の朝やる",
      note: "仕事の判断を自分だけで決めるとぶれやすい人向けの、実用的な委任サンプルです。",
    },
    {
      id: "sample-trip-booking",
      title: "来月の旅行、もう予約する？もう少し様子を見る？",
      option_a: "今予約する",
      option_b: "まだ様子を見る",
      note: "先送りしがちな中くらいの決断を、他人の多数決で前に進める例です。",
    },
    {
      id: "sample-resign",
      title: "今の会社、今年中に転職活動を始める？まだ今の場所で続ける？",
      option_a: "転職活動を始める",
      option_b: "もう少し今の会社で続ける",
      note: "人生寄りの選択でも、『自分では決めきれないから委ねる』構図ならこのアプリらしく使えます。",
    },
    {
      id: "sample-move-invite",
      title: "友だちに誘われた飲み会、今日は行く？断って休む？",
      option_a: "行く",
      option_b: "断って休む",
      note: "人付き合いの小さな判断も、誰かに決めてもらえると気持ちが軽くなります。",
    },
  ];
}

function roundToNextFiveMinutes(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const rounded = Math.ceil(minutes / 5) * 5;
  next.setMinutes(rounded);
  if (rounded === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  }
  return next;
}

function createDefaultCustomDeadline(): Date {
  const base = new Date(Date.now() + 60 * 60000);
  return roundToNextFiveMinutes(base);
}

function clampCustomDeadline(date: Date): Date {
  const min = new Date(Date.now() + 60000);
  const max = new Date(Date.now() + MAX_CUSTOM_MINUTES * 60000);
  if (date.getTime() < min.getTime()) return roundToNextFiveMinutes(min);
  if (date.getTime() > max.getTime()) return roundToNextFiveMinutes(max);
  return roundToNextFiveMinutes(date);
}

function diffMinutesFromNow(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60000));
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPickerDate(date: Date): string {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()} (${weekday})`;
}

function formatPickerTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function mergeDatePart(current: Date, nextDate: Date): Date {
  const merged = new Date(current);
  merged.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  return clampCustomDeadline(merged);
}

function mergeTimePart(current: Date, nextTime: Date): Date {
  const merged = new Date(current);
  merged.setHours(nextTime.getHours(), nextTime.getMinutes(), 0, 0);
  return clampCustomDeadline(merged);
}

function WebDeadlinePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (next: Date) => void;
}) {
  const min = formatDateTimeLocal(clampCustomDeadline(new Date(Date.now() + 60000)));
  const max = formatDateTimeLocal(clampCustomDeadline(new Date(Date.now() + MAX_CUSTOM_MINUTES * 60000)));

  return (
    <View style={s.webPickerWrap}>
      <Text style={s.customPickerHint}>カレンダーで締切日時を選択</Text>
      <input
        type="datetime-local"
        value={formatDateTimeLocal(value)}
        min={min}
        max={max}
        step={300}
        onChange={(event) => {
          const parsed = parseDateTimeLocal(event.currentTarget.value);
          if (parsed) onChange(clampCustomDeadline(parsed));
        }}
        style={{
          width: "100%",
          borderRadius: 12,
          border: `1.5px solid ${MONO.line}`,
          padding: "12px 14px",
          fontSize: 15,
          color: MONO.text,
          backgroundColor: MONO.white,
          boxSizing: "border-box",
        }}
      />
    </View>
  );
}

function NativeDeadlinePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (next: Date) => void;
}) {
  const [showAndroidDate, setShowAndroidDate] = useState(false);
  const [showAndroidTime, setShowAndroidTime] = useState(false);
  const minDate = clampCustomDeadline(new Date(Date.now() + 60000));
  const maxDate = clampCustomDeadline(new Date(Date.now() + MAX_CUSTOM_MINUTES * 60000));

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowAndroidDate(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(mergeDatePart(value, selected));
  };

  const handleTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowAndroidTime(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(mergeTimePart(value, selected));
  };

  return (
    <View style={s.nativePickerWrap}>
      <Text style={s.customPickerHint}>ネイティブの日時ピッカーで締切を選択</Text>
      {Platform.OS === "ios" ? (
        <View style={s.iosPickerWrap}>
          <View style={s.iosPickerCard}>
            <Text style={s.nativePickerLabel}>日付</Text>
            <DateTimePicker
              value={value}
              mode="date"
              display="inline"
              minimumDate={minDate}
              maximumDate={maxDate}
              onChange={handleDateChange}
            />
          </View>
          <View style={s.iosPickerCard}>
            <Text style={s.nativePickerLabel}>時刻</Text>
            <DateTimePicker
              value={value}
              mode="time"
              display="spinner"
              minuteInterval={5}
              onChange={handleTimeChange}
            />
          </View>
        </View>
      ) : (
        <View style={s.nativePickerActions}>
          <Pressable style={s.nativePickerButton} onPress={() => setShowAndroidDate(true)}>
            <Text style={s.nativePickerLabel}>日付</Text>
            <Text style={s.nativePickerValue}>{formatPickerDate(value)}</Text>
          </Pressable>
          <Pressable style={s.nativePickerButton} onPress={() => setShowAndroidTime(true)}>
            <Text style={s.nativePickerLabel}>時刻</Text>
            <Text style={s.nativePickerValue}>{formatPickerTime(value)}</Text>
          </Pressable>
          {showAndroidDate && (
            <DateTimePicker
              value={value}
              mode="date"
              minimumDate={minDate}
              maximumDate={maxDate}
              onChange={handleDateChange}
            />
          )}
          {showAndroidTime && (
            <DateTimePicker
              value={value}
              mode="time"
              minuteInterval={5}
              onChange={handleTimeChange}
            />
          )}
        </View>
      )}
      <Text style={s.customPickerSummary}>{formatDeadline(value.toISOString())}</Text>
    </View>
  );
}

function CreateScreen() {
  const [title, setTitle] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [useOptionC, setUseOptionC] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [customInput, setCustomInput] = useState("");
  const [customDateTime, setCustomDateTime] = useState<Date>(() => createDefaultCustomDeadline());
  const [useCustom, setUseCustom] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [myPollList, setMyPollList] = useState<MyPoll[]>([]);
  const [samplePolls, setSamplePolls] = useState<SamplePoll[]>(() => createSamplePolls());
  const [sampleQuery, setSampleQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");

  const effectiveMinutes = useCustom
    ? Platform.OS === "web" || Platform.OS === "ios"
      ? diffMinutesFromNow(customDateTime)
      : Number(customInput)
    : minutes;

  const submit = async () => {
    const t = title.trim(), a = optionA.trim(), b = optionB.trim(), c = optionC.trim();
    const mins = effectiveMinutes;
    if (t.length < 1 || t.length > 60) return setStatus({ msg: "タイトルは1〜60文字で入力してください", ok: false });
    if (a.length < 1 || a.length > 30) return setStatus({ msg: "選択肢Aは1〜30文字で入力してください", ok: false });
    if (b.length < 1 || b.length > 30) return setStatus({ msg: "選択肢Bは1〜30文字で入力してください", ok: false });
    if (useOptionC && (c.length < 1 || c.length > 30)) return setStatus({ msg: "選択肢Cは1〜30文字で入力してください", ok: false });
    if (!Number.isInteger(mins) || mins < 1 || mins > 4320) return setStatus({ msg: "締切は1〜4320分で指定してください", ok: false });
    setSubmitting(true);
    setStatus(null);
    try {
      await api.initSession();
      await api.createPoll({ title: t, option_a: a, option_b: b, option_c: useOptionC ? c : undefined, close_in_minutes: mins, turnstile_token: "" });
      setTitle(""); setOptionA(""); setOptionB(""); setOptionC(""); setUseOptionC(false);
       setMinutes(60); setCustomInput(""); setUseCustom(false); setCustomDateTime(createDefaultCustomDeadline());
      setMyPollList(Array.from(myPolls.values()).reverse());
      setStatus({ msg: "投稿しました！みんなが投票してくれるよ", ok: true });
    } catch (e) {
      setStatus({ msg: e instanceof Error ? e.message : "投稿に失敗しました", ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const applyPollToComposer = (poll: {
    title: string;
    option_a: string;
    option_b: string;
    option_c?: string | null;
  }) => {
    setTitle(poll.title);
    setOptionA(poll.option_a);
    setOptionB(poll.option_b);
    setOptionC(poll.option_c ?? "");
    setUseOptionC(Boolean(poll.option_c));
    setStatus({ msg: "内容を入力欄に読み込みました。必要なら少し直して投稿できます。", ok: true });
  };

  const filteredSamplePolls = samplePolls.filter((poll) => {
    const q = sampleQuery.trim().toLowerCase();
    if (!q) return true;
    return [poll.title, poll.option_a, poll.option_b, poll.option_c ?? "", poll.note]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const filteredMyPolls = myPollList.filter((poll) => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return true;
    return [poll.title, poll.option_a, poll.option_b, poll.option_c ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={s.createScroll} contentContainerStyle={s.createContent} keyboardShouldPersistTaps="handled">
        <View style={s.createHeader}>
          <Text style={s.createTitle}>自分で決めきれないことを委ねよう</Text>
          <View />
        </View>

        <Text style={s.fieldLabel}>質問 <Text style={s.charCount}>{title.length}/60</Text></Text>
        <TextInput
          style={s.textArea}
          placeholder="例: 今日の帰り、寄り道する？まっすぐ帰る？"
          placeholderTextColor={MONO.textFaint}
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          multiline
          numberOfLines={2}
        />

        <View style={s.optionsRow}>
          <View style={s.optionCol}>
            <Text style={[s.fieldLabel, { color: MONO.choiceA }]}>A <Text style={s.charCount}>{optionA.length}/30</Text></Text>
            <TextInput
              style={[s.optionInput, { borderColor: MONO.ink }]}
              placeholder="選択肢A"
              placeholderTextColor={MONO.textFaint}
              value={optionA}
              onChangeText={setOptionA}
              maxLength={30}
            />
          </View>
          <Text style={s.optionVs}>vs</Text>
          <View style={s.optionCol}>
            <Text style={[s.fieldLabel, { color: MONO.choiceBText }]}>B <Text style={s.charCount}>{optionB.length}/30</Text></Text>
            <TextInput
              style={[s.optionInput, { borderColor: MONO.textFaint }]}
              placeholder="選択肢B"
              placeholderTextColor={MONO.textFaint}
              value={optionB}
              onChangeText={setOptionB}
              maxLength={30}
            />
          </View>
        </View>
        {useOptionC ? (
          <View style={s.optionCWrap}>
            <View style={s.optionCHeader}>
              <Text style={[s.fieldLabel, { color: "#7c3aed" }]}>C <Text style={s.charCount}>{optionC.length}/30</Text></Text>
              <Pressable style={s.optionCRemoveBtn} onPress={() => { setUseOptionC(false); setOptionC(""); }}>
                <Text style={s.optionCRemoveBtnText}>Cを外す</Text>
              </Pressable>
            </View>
            <TextInput
              style={[s.optionInput, { borderColor: "#c4b5fd" }]}
              placeholder="選択肢C（上スワイプで選択）"
              placeholderTextColor={MONO.textFaint}
              value={optionC}
              onChangeText={setOptionC}
              maxLength={30}
            />
          </View>
        ) : (
          <Pressable style={s.addOptionBtn} onPress={() => setUseOptionC(true)}>
            <Text style={s.addOptionBtnText}>選択肢Cを追加</Text>
          </Pressable>
        )}

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
            onPress={() => {
              setUseCustom(true);
              setCustomDateTime(createDefaultCustomDeadline());
            }}
          >
            <Text style={[s.presetChipText, useCustom && s.presetChipTextActive]}>カスタム</Text>
          </Pressable>
        </View>
        {useCustom && Platform.OS === "web" && (
          <WebDeadlinePicker value={customDateTime} onChange={setCustomDateTime} />
        )}
        {useCustom && (Platform.OS === "ios" || Platform.OS === "android") && (
          <NativeDeadlinePicker value={customDateTime} onChange={setCustomDateTime} />
        )}
        {useCustom && Platform.OS !== "web" && Platform.OS !== "ios" && Platform.OS !== "android" && (
          <TextInput
            style={s.customMinInput}
            placeholder="分単位で入力（1〜4320）"
            placeholderTextColor={MONO.textFaint}
            keyboardType="numeric"
            value={customInput}
            onChangeText={setCustomInput}
          />
        )}

        {status && (
          <View style={[s.statusBox, status.ok ? s.statusBoxOk : s.statusBoxError]}>
            <Text style={[s.statusText, status.ok ? s.statusTextOk : s.statusTextError]}>{status.msg}</Text>
          </View>
        )}

        <Pressable style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
          <Text style={s.submitBtnText}>{submitting ? "投稿中..." : "投稿する"}</Text>
        </Pressable>

        {myPollList.length > 0 && (
          <View style={s.myPollsSection}>
            <Text style={s.myPollsSectionTitle}>自分の投稿と履歴</Text>
            <Text style={s.sampleSectionHint}>進行状況の確認に加えて、複製して作り直したり共有したりできます</Text>
            <TextInput
              style={s.inlineSearchInput}
              placeholder="自分の投稿を検索"
              placeholderTextColor={MONO.textFaint}
              value={historyQuery}
              onChangeText={setHistoryQuery}
            />
            {filteredMyPolls.length === 0 ? (
              <View style={s.sampleEmptyCard}>
                <Text style={s.sampleEmptyTitle}>一致する投稿がありません</Text>
                <Text style={s.sampleEmptyBody}>検索条件をゆるめると、作成済みの投稿が再び表示されます。</Text>
              </View>
            ) : filteredMyPolls.map((p) => (
              <MyPollCard
                key={p.id}
                poll={p}
                onDuplicate={() => applyPollToComposer(p)}
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

function MyPollCard({ poll, onClose, onDuplicate }: { poll: MyPoll; onClose: () => void; onDuplicate: () => void }) {
  const [result, setResult] = useState<PollResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const barA = useRef(new Animated.Value(0)).current;
  const barB = useRef(new Animated.Value(0)).current;
  const barC = useRef(new Animated.Value(0)).current;
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
        Animated.spring(barC, { toValue: res.percent_c / 100, useNativeDriver: false }),
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

  const handleShare = async () => {
    const lines = [
      poll.title,
      `A: ${poll.option_a}`,
      `B: ${poll.option_b}`,
      poll.option_c ? `C: ${poll.option_c}` : null,
      `締切: ${formatDeadline(poll.closes_at)}`,
    ].filter(Boolean);

    try {
      await Share.share({
        message: lines.join("\n"),
        title: poll.title,
      });
    } catch {
      Alert.alert("共有できませんでした", "時間を置いてもう一度お試しください。");
    }
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
            <Text style={[s.myPollOptionLabel, { color: MONO.choiceA }]}>A</Text>
            <Text style={s.myPollOptionText} numberOfLines={1}>{poll.option_a}</Text>
            <Text style={[s.myPollPercent, { color: MONO.choiceA }]}>{result.percent_a}%</Text>
            <Text style={s.myPollVotes}>{result.votes_a}票</Text>
          </View>
          <MiniBar label="" percent={result.percent_a} anim={barA} color={MONO.choiceA} />
          <View style={[s.myPollResultRow, { marginTop: 8 }]}>
            <Text style={[s.myPollOptionLabel, { color: MONO.choiceBText }]}>B</Text>
            <Text style={s.myPollOptionText} numberOfLines={1}>{poll.option_b}</Text>
            <Text style={[s.myPollPercent, { color: MONO.choiceBText }]}>{result.percent_b}%</Text>
            <Text style={s.myPollVotes}>{result.votes_b}票</Text>
          </View>
          <MiniBar label="" percent={result.percent_b} anim={barB} color={MONO.choiceB} />
          {poll.option_c ? (
            <>
              <View style={[s.myPollResultRow, { marginTop: 8 }]}>
                <Text style={[s.myPollOptionLabel, { color: "#7c3aed" }]}>C</Text>
                <Text style={s.myPollOptionText} numberOfLines={1}>{poll.option_c}</Text>
                <Text style={[s.myPollPercent, { color: "#7c3aed" }]}>{result.percent_c}%</Text>
                <Text style={s.myPollVotes}>{result.votes_c}票</Text>
              </View>
              <MiniBar label="" percent={result.percent_c} anim={barC} color="#7c3aed" />
            </>
          ) : null}
          <Text style={s.myPollTotal}>合計 {result.total_votes} 票</Text>
        </View>
      )}
      <Pressable style={s.refreshBtn} onPress={fetchResult} disabled={loading}>
        <Text style={s.refreshBtnText}>{loading ? "更新中..." : "票数を更新"}</Text>
      </Pressable>
      <View style={s.cardActionRow}>
        <Pressable style={s.secondaryActionBtn} onPress={onDuplicate}>
          <Text style={s.secondaryActionBtnText}>複製して作る</Text>
        </Pressable>
        <Pressable style={s.secondaryActionBtn} onPress={handleShare}>
          <Text style={s.secondaryActionBtnText}>共有</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <View style={s.settingsHeader}>
      <View style={s.settingsHeaderTop}>
        {onBack ? (
          <Pressable style={s.settingsBackBtn} onPress={onBack}>
            <Text style={s.settingsBackBtnText}>戻る</Text>
          </Pressable>
        ) : <View />}
      </View>
      <Text style={s.settingsTitle}>{title}</Text>
      {subtitle ? <Text style={s.settingsSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function SettingsScreen() {
  return (
    <ScrollView style={s.settingsRoot} contentContainerStyle={s.settingsContent}>
      <ScreenHeader title="設定" />

      <View style={s.settingsSection}>
        <Text style={s.settingsSectionTitle}>法務</Text>
        <Pressable style={s.settingsActionBtn} onPress={() => openExternal(PRIVACY_URL)}>
          <Text style={s.settingsActionText}>プライバシーポリシー</Text>
        </Pressable>
        <Pressable style={s.settingsActionBtn} onPress={() => openExternal(TERMS_URL)}>
          <Text style={s.settingsActionText}>利用規約</Text>
        </Pressable>
      </View>

      <View style={s.settingsSection}>
        <Text style={s.settingsSectionTitle}>サポート</Text>
        <Pressable style={s.settingsActionBtn} onPress={() => openExternal(`mailto:${SUPPORT_EMAIL}`)}>
          <Text style={s.settingsActionText}>フィードバックを送る</Text>
        </Pressable>
        <Pressable style={s.settingsActionBtn} onPress={() => openExternal(`mailto:${SUPPORT_EMAIL}`)}>
          <Text style={s.settingsActionText}>お問い合わせ</Text>
        </Pressable>
      </View>

      <View style={s.settingsSection}>
        <Text style={s.settingsSectionTitle}>このアプリについて</Text>
        <View style={s.settingsInfoRow}>
          <Text style={s.settingsInfoLabel}>バージョン</Text>
          <Text style={s.settingsInfoValue}>{APP_VERSION}</Text>
        </View>
      </View>
    </ScrollView>
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
  root: { flex: 1, backgroundColor: MONO.darkBg },
  body: { flex: 1 },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: MONO.darkLine,
    backgroundColor: MONO.darkBg,
    paddingBottom: Platform.OS === "ios" ? 0 : 4,
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2 },
  tabLabel: { fontSize: 11, color: MONO.textMuted },
  tabLabelActive: { color: MONO.white, fontWeight: "700" },
  tabGlyphFrame: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tabGlyphFrameActive: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
  },

  // Vote screen
  voteRoot: { flex: 1, backgroundColor: MONO.darkBg },
  voteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoText: { fontSize: 26, fontWeight: "900", color: MONO.white, letterSpacing: -1 },
  headerBadges: { flexDirection: "row", alignItems: "center", gap: 8 },
  closedBadge: {
    backgroundColor: MONO.darkPanelSoft,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  closedBadgeText: { fontSize: 12, fontWeight: "600", color: MONO.textMuted },
  closeNowBtn: {
    backgroundColor: MONO.dangerBg,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: MONO.dangerLine,
  },
  closeNowBtnText: { fontSize: 12, fontWeight: "700", color: MONO.white },
  reportBtn: {
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: MONO.darkLine,
    backgroundColor: MONO.darkPanelSoft,
  },
  reportBtnText: { fontSize: 12, fontWeight: "700", color: MONO.white },

  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: MONO.dangerBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: MONO.dangerLine,
  },
  errorText: { fontSize: 13, color: MONO.white },

  cardArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  // Loading / Empty
  loadingWrap: { alignItems: "center", justifyContent: "center", gap: 16 },
  loadingDots: { fontSize: 28, color: MONO.textMuted, letterSpacing: 6 },
  emptyWrap: { alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: MONO.white },
  emptyBody: { fontSize: 14, color: MONO.textMuted, textAlign: "center", lineHeight: 22 },
  reloadBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: MONO.darkLine,
  },
  reloadBtnText: { fontSize: 14, fontWeight: "600", color: MONO.white },

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
    backgroundColor: MONO.darkPanelSoft,
    borderRadius: 24,
  },
  swipeCard: {
    width: SW - 32,
    backgroundColor: MONO.white,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: MONO.black,
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
    color: MONO.choiceA,
    lineHeight: 52,
    textShadowColor: "rgba(17,17,17,0.18)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    borderWidth: 3,
    borderColor: MONO.choiceA,
    borderRadius: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  stampOptionA: {
    fontSize: 16,
    fontWeight: "800",
    color: MONO.choiceA,
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
    color: MONO.choiceBText,
    lineHeight: 52,
    textShadowColor: "rgba(138,138,138,0.22)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    borderWidth: 3,
    borderColor: MONO.choiceB,
    borderRadius: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  stampOptionB: {
    fontSize: 16,
    fontWeight: "800",
    color: MONO.choiceBText,
    marginTop: 4,
    maxWidth: 160,
    textAlign: "right",
  },
  stampC: {
    position: "absolute",
    top: 18,
    alignSelf: "center",
    alignItems: "center",
    zIndex: 10,
  },
  stampLabelC: {
    fontSize: 42,
    fontWeight: "900",
    color: "#7c3aed",
    lineHeight: 46,
    borderWidth: 3,
    borderColor: "#7c3aed",
    borderRadius: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  stampOptionC: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7c3aed",
    marginTop: 4,
    maxWidth: 180,
    textAlign: "center",
  },
  cardTop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 36,
    paddingBottom: 16,
  },
  cardQuestion: {
    fontSize: 24,
    fontWeight: "900",
    color: MONO.ink,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  cardDeadline: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    color: MONO.textFaint,
  },
  choicePanels: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: MONO.surfaceStrong,
    minHeight: 110,
    position: "relative",
    paddingBottom: 18,
  },
  choicePanelPressable: { flex: 1 },
  choicePanelB: {
    flex: 1,
    backgroundColor: MONO.surfaceStrong,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    gap: 6,
    borderBottomLeftRadius: 24,
  },
  choicePanelA: {
    flex: 1,
    backgroundColor: MONO.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    gap: 6,
    borderBottomRightRadius: 24,
  },
  choiceDivider: { width: 1, backgroundColor: MONO.surfaceStrong },
  choicePanelArrow: { fontSize: 18, fontWeight: "900", color: MONO.textFaint },
  choicePanelArrowUp: { fontSize: 18, fontWeight: "900", color: "#7c3aed" },
  choicePanelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  choicePanelBadgeText: { fontSize: 15, fontWeight: "900", color: MONO.white },
  choicePanelText: {
    fontSize: 16,
    fontWeight: "800",
    color: MONO.ink,
    textAlign: "center",
    lineHeight: 22,
  },
  choicePanelCAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -16,
    alignItems: "center",
  },
  choicePanelC: {
    minWidth: 144,
    maxWidth: SW - 120,
    borderRadius: 18,
    backgroundColor: "#f5f3ff",
    borderWidth: 1.5,
    borderColor: "#c4b5fd",
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 4,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  choicePanelCText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#5b21b6",
    textAlign: "center",
    lineHeight: 20,
  },
  swipeHintBubble: {
    position: "absolute",
    bottom: 136,
    alignSelf: "center",
    backgroundColor: "rgba(10,10,10,0.84)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  swipeHintText: { fontSize: 12, fontWeight: "700", color: MONO.white },
  closedOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.62)",
    paddingVertical: 14,
    alignItems: "center",
  },
  closedOverlayText: { color: MONO.white, fontSize: 14, fontWeight: "700" },

  // Result card
  resultCard: {
    width: SW - 32,
    backgroundColor: MONO.white,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: MONO.black,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  chosenBanner: {
    backgroundColor: MONO.choiceA,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  chosenBannerText: { color: MONO.white, fontSize: 14, fontWeight: "800" },
  resultCardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: MONO.ink,
    padding: 20,
    paddingBottom: 8,
    lineHeight: 28,
  },
  resultBars: { paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  resultRow: {
    backgroundColor: MONO.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: MONO.line,
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
  resultBadgeText: { fontSize: 12, fontWeight: "900", color: MONO.white },
  resultOptionText: { flex: 1, fontSize: 15, fontWeight: "700", color: MONO.text },
  yourChoice: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  yourChoiceText: { fontSize: 11, fontWeight: "700" },
  resultPercent: { fontSize: 20, fontWeight: "900" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: MONO.line, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  resultVoteCount: { fontSize: 12, color: MONO.textFaint },
  totalVotes: {
    fontSize: 13,
    color: MONO.textFaint,
    textAlign: "center",
    paddingVertical: 8,
  },
  nextBtn: {
    backgroundColor: MONO.ink,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  nextBtnText: { color: MONO.white, fontSize: 16, fontWeight: "800" },

  skipBtn: { alignSelf: "center", paddingVertical: 16, paddingHorizontal: 32 },
  skipBtnText: { fontSize: 14, color: MONO.textMuted, fontWeight: "600" },

  // Mini bar
  miniBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniBarLabel: { fontSize: 13, fontWeight: "800", width: 16 },
  miniBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: MONO.line, overflow: "hidden" },
  miniBarFill: { height: 6, borderRadius: 3 },
  miniBarPercent: { fontSize: 12, fontWeight: "700", color: MONO.textSoft, width: 36, textAlign: "right" },

  // Create screen
  createScroll: { flex: 1, backgroundColor: MONO.white },
  createContent: { padding: 20, gap: 4, paddingBottom: 48 },
  createHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  createTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: MONO.ink,
    letterSpacing: -0.5,
    flex: 1,
  },
  sampleResetBtn: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: MONO.surfaceStrong,
    borderWidth: 1,
    borderColor: MONO.line,
  },
  sampleResetBtnText: { fontSize: 12, fontWeight: "800", color: MONO.text },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: MONO.textSoft, marginBottom: 6 },
  charCount: { fontWeight: "400", color: MONO.textFaint },
  textArea: {
    borderWidth: 1.5,
    borderColor: MONO.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: MONO.text,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  optionsRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 16 },
  optionCol: { flex: 1 },
  optionVs: { fontSize: 12, fontWeight: "700", color: MONO.textFaint, paddingBottom: 14 },
  optionCWrap: { marginBottom: 16, gap: 6 },
  optionCHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  optionCRemoveBtn: {
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    backgroundColor: "#f5f3ff",
  },
  optionCRemoveBtnText: { fontSize: 12, fontWeight: "700", color: "#6d28d9" },
  addOptionBtn: {
    alignSelf: "flex-start",
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8b4fe",
    backgroundColor: "#faf5ff",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  addOptionBtnText: { fontSize: 13, fontWeight: "800", color: "#7c3aed" },
  optionInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: MONO.text,
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: MONO.line,
    backgroundColor: MONO.white,
  },
  presetChipActive: { borderColor: MONO.ink, backgroundColor: MONO.ink },
  presetChipText: { fontSize: 13, fontWeight: "600", color: MONO.textSoft },
  presetChipTextActive: { color: MONO.white },
  customMinInput: {
    borderWidth: 1.5,
    borderColor: MONO.line,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: MONO.text,
    marginBottom: 12,
  },
  webPickerWrap: { marginBottom: 12, gap: 8 },
  nativePickerWrap: { marginBottom: 12, gap: 10 },
  iosPickerWrap: {
    gap: 12,
  },
  iosPickerCard: {
    borderWidth: 1,
    borderColor: MONO.line,
    borderRadius: 18,
    backgroundColor: MONO.surface,
    padding: 12,
    gap: 10,
  },
  customPickerHint: { fontSize: 12, fontWeight: "700", color: MONO.textMuted },
  customPickerSummary: { fontSize: 12, color: MONO.textSoft, textAlign: "center" },
  nativePickerActions: {
    gap: 10,
  },
  nativePickerButton: {
    borderWidth: 1,
    borderColor: MONO.line,
    borderRadius: 16,
    backgroundColor: MONO.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  nativePickerLabel: { fontSize: 12, fontWeight: "700", color: MONO.textMuted },
  nativePickerValue: { fontSize: 16, fontWeight: "800", color: MONO.text },
  statusBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 4 },
  statusText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  submitBtn: {
    backgroundColor: MONO.ink,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 12,
  },
  submitBtnText: { color: MONO.white, fontSize: 16, fontWeight: "800" },
  sampleSection: { marginTop: 28, gap: 12 },
  sampleSectionHeader: { gap: 4 },
  sampleSectionHint: { fontSize: 12, color: MONO.textMuted },
  sampleCard: {
    backgroundColor: MONO.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: MONO.line,
    gap: 8,
  },
  sampleCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  inlineSearchInput: {
    borderWidth: 1,
    borderColor: MONO.line,
    backgroundColor: MONO.white,
    color: MONO.text,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  sampleCardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: MONO.text, lineHeight: 22 },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  sampleUseBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: MONO.ink,
    borderWidth: 1,
    borderColor: MONO.ink,
    alignItems: "center",
  },
  sampleUseBtnText: { fontSize: 12, fontWeight: "800", color: MONO.white },
  sampleDeleteBtn: {
    minWidth: 76,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: MONO.white,
    borderWidth: 1,
    borderColor: MONO.line,
    alignItems: "center",
  },
  sampleDeleteBtnText: { fontSize: 12, fontWeight: "700", color: MONO.text },
  sampleOptionA: { fontSize: 14, fontWeight: "700", color: MONO.choiceA },
  sampleOptionB: { fontSize: 14, fontWeight: "700", color: MONO.choiceBText },
  sampleOptionC: { fontSize: 14, fontWeight: "700", color: "#7c3aed" },
  sampleNote: { fontSize: 12, color: MONO.textSoft, lineHeight: 18 },
  sampleEmptyCard: {
    backgroundColor: MONO.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: MONO.line,
    gap: 6,
  },
  sampleEmptyTitle: { fontSize: 14, fontWeight: "800", color: MONO.text },
  sampleEmptyBody: { fontSize: 12, color: MONO.textMuted, lineHeight: 18 },
  disabledBtn: { opacity: 0.55 },

  // Settings
  settingsRoot: { flex: 1, backgroundColor: MONO.white },
  settingsContent: { padding: 20, gap: 16, paddingBottom: 44 },
  settingsHeader: { gap: 8, marginBottom: 4 },
  settingsHeaderTop: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingsBackBtn: {
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: MONO.surfaceStrong,
    borderWidth: 1,
    borderColor: MONO.line,
  },
  settingsBackBtnText: { fontSize: 12, fontWeight: "700", color: MONO.text },
  settingsTitle: { fontSize: 26, fontWeight: "900", color: MONO.ink, letterSpacing: -0.8 },
  settingsSubtitle: { fontSize: 13, color: MONO.textMuted, lineHeight: 20 },
  settingsSection: {
    backgroundColor: MONO.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: MONO.line,
    padding: 16,
    gap: 10,
  },
  settingsSectionTitle: { fontSize: 16, fontWeight: "800", color: MONO.ink, marginBottom: 2 },
  settingsActionBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MONO.line,
    backgroundColor: MONO.white,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  settingsActionText: { fontSize: 14, fontWeight: "700", color: MONO.text },
  settingsInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  settingsInfoLabel: { fontSize: 14, color: MONO.textSoft },
  settingsInfoValue: { fontSize: 14, fontWeight: "700", color: MONO.textMuted },
  // History screen
  historyRoot: { flex: 1, backgroundColor: MONO.darkBg },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  historyTitle: { fontSize: 26, fontWeight: "900", color: MONO.white, letterSpacing: -1 },
  historyRefreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: MONO.darkPanelSoft,
  },
  historyRefreshText: { fontSize: 13, fontWeight: "700", color: MONO.textFaint },
  historyScroll: { flex: 1 },
  historyContent: { padding: 16, gap: 12, paddingBottom: 40 },
  historyCentered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
  historyEmptyText: { fontSize: 18, fontWeight: "700", color: MONO.textMuted },
  historyEmptyBody: { fontSize: 14, color: MONO.textSoft, textAlign: "center" },
  historyCard: {
    backgroundColor: MONO.darkPanel,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: MONO.darkLine,
    gap: 6,
  },
  historyCardClosed: { opacity: 0.7 },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  historyCardTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: MONO.white, lineHeight: 22 },
  hClosedBadge: {
    backgroundColor: MONO.darkPanelSoft,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  hClosedBadgeText: { fontSize: 11, fontWeight: "700", color: MONO.textMuted },
  hCloseBtn: {
    backgroundColor: MONO.dangerBg,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: MONO.dangerLine,
  },
  hCloseBtnText: { fontSize: 12, fontWeight: "700", color: MONO.white },
  historyDeadline: { fontSize: 12, color: MONO.textMuted, marginBottom: 2 },
  historyTotalVotes: { fontSize: 12, color: MONO.textMuted, marginBottom: 6 },
  historyBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyOptionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  historyOptionBadgeText: { fontSize: 11, fontWeight: "900", color: MONO.white },
  historyOptionText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#d6d6d6" },
  historyPercent: { fontSize: 16, fontWeight: "900" },
  hBarTrack: { height: 6, borderRadius: 3, backgroundColor: MONO.darkLine, overflow: "hidden" },
  hBarFill: { height: 6, borderRadius: 3 },

  myPollsSection: { marginTop: 28, gap: 12 },
  myPollsSectionTitle: { fontSize: 16, fontWeight: "800", color: MONO.ink },
  myPollCard: {
    backgroundColor: MONO.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: MONO.line,
    gap: 8,
  },
  myPollHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  myPollTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: MONO.text },
  myPollDeadline: { fontSize: 11, color: MONO.textFaint },
  myPollLoading: { fontSize: 12, color: MONO.textFaint },
  myPollResult: { gap: 4, marginTop: 4 },
  myPollResultRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  myPollOptionLabel: { fontSize: 13, fontWeight: "800", width: 16 },
  myPollOptionText: { flex: 1, fontSize: 13, color: MONO.textSoft },
  myPollPercent: { fontSize: 14, fontWeight: "800" },
  myPollVotes: { fontSize: 11, color: MONO.textFaint, width: 30, textAlign: "right" },
  myPollTotal: { fontSize: 12, color: MONO.textFaint, textAlign: "right", marginTop: 4 },
  refreshBtn: {
    alignSelf: "flex-end",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MONO.line,
  },
  refreshBtnText: { fontSize: 12, fontWeight: "600", color: MONO.textSoft },
  statusBoxOk: {
    backgroundColor: MONO.surface,
    borderColor: MONO.line,
  },
  statusBoxError: {
    backgroundColor: MONO.darkPanelSoft,
    borderColor: MONO.darkLine,
  },
  statusTextOk: {
    color: MONO.text,
  },
  statusTextError: {
    color: MONO.white,
  },
  secondaryActionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: MONO.white,
    borderWidth: 1,
    borderColor: MONO.line,
    alignItems: "center",
  },
  secondaryActionBtnText: { fontSize: 12, fontWeight: "700", color: MONO.text },
});
