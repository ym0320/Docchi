import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
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
import { createApi } from "./src/api";
import type { Poll, PollResult } from "./src/types";

const api = createApi("");

type Screen = "vote" | "create";

export default function App() {
  const [screen, setScreen] = useState<Screen>("vote");

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
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

// ─── Vote ───────────────────────────────────────────────

function VoteScreen() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [result, setResult] = useState<PollResult | null>(null);
  const [chosen, setChosen] = useState<"A" | "B" | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const barA = useRef(new Animated.Value(0)).current;
  const barB = useRef(new Animated.Value(0)).current;

  const showResult = (res: PollResult, pick: "A" | "B" | null, isClosed = false) => {
    setResult(res);
    setChosen(pick);
    setClosed(isClosed);
    Animated.parallel([
      Animated.spring(barA, { toValue: res.percent_a / 100, useNativeDriver: false, tension: 60 }),
      Animated.spring(barB, { toValue: res.percent_b / 100, useNativeDriver: false, tension: 60 }),
    ]).start();
  };

  const loadNext = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setChosen(null);
      setClosed(false);
      barA.setValue(0);
      barB.setValue(0);
      try {
        await api.initSession();
        setPoll(await api.fetchNextPoll());
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      } finally {
        setLoading(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      }
    });
  };

  useEffect(() => { loadNext(); }, []);

  const vote = async (selected: "A" | "B") => {
    if (!poll || submitting) return;
    setSubmitting(true);
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
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <Text style={s.loadingDot}>・・・</Text>
      </View>
    );
  }

  if (!poll) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyEmoji}>🤔</Text>
        <Text style={s.emptyTitle}>質問がありません</Text>
        <Text style={s.emptyBody}>「投稿」タブから最初の質問を作ろう</Text>
        <Pressable style={s.reloadBtn} onPress={loadNext}>
          <Text style={s.reloadBtnText}>再読み込み</Text>
        </Pressable>
      </View>
    );
  }

  const isPollClosed = new Date(poll.closes_at).getTime() <= Date.now();

  return (
    <Animated.ScrollView
      style={[s.voteScroll, { opacity: fadeAnim }]}
      contentContainerStyle={s.voteContent}
      scrollEnabled={false}
    >
      {/* ヘッダー */}
      <View style={s.voteHeader}>
        <Text style={s.appName}>Docchi</Text>
        {(isPollClosed || closed) && (
          <View style={s.closedBadge}><Text style={s.closedBadgeText}>締切済み</Text></View>
        )}
      </View>

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorBoxText}>{error}</Text>
        </View>
      )}

      {/* 質問カード */}
      <View style={s.questionCard}>
        <Text style={s.questionTitle}>{poll.title}</Text>
        <Text style={s.questionDeadline}>
          {isPollClosed ? "締切済み" : `締切 ${formatDeadline(poll.closes_at)}`}
        </Text>
      </View>

      {/* 投票ボタン or 結果 */}
      {!result ? (
        <View style={s.choicesWrap}>
          <ChoiceButton
            label="A"
            text={poll.option_a}
            color="#2563EB"
            bgColor="#EFF6FF"
            disabled={submitting || isPollClosed}
            onPress={() => vote("A")}
          />
          <View style={s.vsDivider}>
            <View style={s.vsLine} />
            <Text style={s.vsText}>or</Text>
            <View style={s.vsLine} />
          </View>
          <ChoiceButton
            label="B"
            text={poll.option_b}
            color="#DC2626"
            bgColor="#FEF2F2"
            disabled={submitting || isPollClosed}
            onPress={() => vote("B")}
          />
          {isPollClosed && (
            <Text style={s.closedNote}>この質問は締め切りを過ぎています</Text>
          )}
        </View>
      ) : (
        <View style={s.resultWrap}>
          {closed && !chosen && (
            <Text style={s.closedNote}>締め切り後のため投票できません</Text>
          )}
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
          <Text style={s.totalVotes}>合計 {result.total_votes} 票</Text>
          <Pressable style={s.nextBtn} onPress={loadNext}>
            <Text style={s.nextBtnText}>次の質問へ</Text>
          </Pressable>
        </View>
      )}

      {!result && (
        <Pressable style={s.skipLink} onPress={loadNext}>
          <Text style={s.skipLinkText}>スキップ</Text>
        </Pressable>
      )}
    </Animated.ScrollView>
  );
}

function ChoiceButton({
  label, text, color, bgColor, disabled, onPress,
}: {
  label: string; text: string; color: string; bgColor: string;
  disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        s.choiceBtn,
        { backgroundColor: bgColor, borderColor: color },
        pressed && !disabled && { opacity: 0.75, transform: [{ scale: 0.98 }] },
        disabled && s.choiceBtnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[s.choiceLabelBadge, { backgroundColor: color }]}>
        <Text style={s.choiceLabelText}>{label}</Text>
      </View>
      <Text style={[s.choiceText, { color: disabled ? "#999" : "#1C1C1E" }]}>{text}</Text>
    </Pressable>
  );
}

function ResultBar({
  label, text, votes, percent, anim, color, chosen,
}: {
  label: string; text: string; votes: number; percent: number;
  anim: Animated.Value; color: string; chosen: boolean;
}) {
  const barWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[s.resultRow, chosen && { borderColor: color }]}>
      <View style={s.resultTopRow}>
        <View style={[s.resultLabelBadge, { backgroundColor: color }]}>
          <Text style={s.resultLabelText}>{label}</Text>
        </View>
        <Text style={s.resultOptionText} numberOfLines={1}>{text}</Text>
        {chosen && (
          <View style={[s.yourBadge, { borderColor: color }]}>
            <Text style={[s.yourBadgeText, { color }]}>あなた</Text>
          </View>
        )}
        <Text style={[s.resultPercent, { color }]}>{percent}%</Text>
      </View>
      <View style={s.barTrack}>
        <Animated.View style={[s.barFill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={s.resultVoteCount}>{votes}票</Text>
    </View>
  );
}

// ─── Create ─────────────────────────────────────────────

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
        <Text style={s.createPageTitle}>みんなに聞いてみよう</Text>

        {/* 質問 */}
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

        {/* 選択肢 */}
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

        {/* 締切 */}
        <Text style={s.fieldLabel}>締切</Text>
        <View style={s.presetRow}>
          {DEADLINE_PRESETS.map(p => (
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

        {/* ステータス */}
        {status && (
          <View style={[s.statusBox, { backgroundColor: status.ok ? "#F0FDF4" : "#FEF2F2", borderColor: status.ok ? "#86EFAC" : "#FECACA" }]}>
            <Text style={[s.statusText, { color: status.ok ? "#166534" : "#991B1B" }]}>{status.msg}</Text>
          </View>
        )}

        {/* 投稿ボタン */}
        <Pressable
          style={[s.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={s.submitBtnText}>{submitting ? "投稿中..." : "投稿する"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Utils ───────────────────────────────────────────────

function formatDeadline(closesAt: string): string {
  const d = new Date(closesAt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs <= 0) return "締切済み";
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return `あと${Math.floor(diffMs / 60000)}分`;
  if (diffH < 24) return `あと${diffH}時間`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}まで`;
}

// ─── Styles ──────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  body: { flex: 1 },

  // Tab
  tabBar: {
    flexDirection: "row", borderTopWidth: 1, borderTopColor: "#E5E5EA",
    backgroundColor: "#fff", paddingBottom: Platform.OS === "ios" ? 0 : 4,
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 8, gap: 2 },
  tabIcon: { fontSize: 18, color: "#AEAEB2" },
  tabIconActive: { color: "#1C1C1E" },
  tabLabel: { fontSize: 11, color: "#AEAEB2" },
  tabLabelActive: { color: "#1C1C1E", fontWeight: "700" },

  // Loading / Empty
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingDot: { fontSize: 28, color: "#AEAEB2", letterSpacing: 4 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  emptyBody: { fontSize: 14, color: "#8E8E93", textAlign: "center", lineHeight: 20 },
  reloadBtn: {
    marginTop: 8, paddingVertical: 12, paddingHorizontal: 28,
    borderRadius: 24, borderWidth: 1.5, borderColor: "#E5E5EA",
  },
  reloadBtnText: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },

  // Vote screen
  voteScroll: { flex: 1, backgroundColor: "#F9F9F9" },
  voteContent: { padding: 16, gap: 12, paddingBottom: 32 },
  voteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  appName: { fontSize: 22, fontWeight: "900", color: "#1C1C1E", letterSpacing: -0.5 },
  closedBadge: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  closedBadgeText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },

  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FECACA" },
  errorBoxText: { fontSize: 13, color: "#991B1B" },

  questionCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  questionTitle: { fontSize: 22, fontWeight: "800", color: "#1C1C1E", lineHeight: 30 },
  questionDeadline: { marginTop: 10, fontSize: 12, color: "#8E8E93" },

  choicesWrap: { gap: 0 },
  choiceBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 14, borderWidth: 2, padding: 18,
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  choiceBtnDisabled: { opacity: 0.45 },
  choiceLabelBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  choiceLabelText: { fontSize: 15, fontWeight: "900", color: "#fff" },
  choiceText: { flex: 1, fontSize: 17, fontWeight: "700", color: "#1C1C1E" },

  vsDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 10, paddingHorizontal: 4 },
  vsLine: { flex: 1, height: 1, backgroundColor: "#E5E5EA" },
  vsText: { fontSize: 12, fontWeight: "700", color: "#AEAEB2" },

  closedNote: { marginTop: 10, fontSize: 13, color: "#8E8E93", textAlign: "center" },

  // Result
  resultWrap: { gap: 10 },
  resultRow: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: "#E5E5EA", gap: 8,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  resultTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultLabelBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  resultLabelText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  resultOptionText: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  yourBadge: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 7 },
  yourBadgeText: { fontSize: 11, fontWeight: "700" },
  resultPercent: { fontSize: 20, fontWeight: "900" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  resultVoteCount: { fontSize: 12, color: "#8E8E93" },
  totalVotes: { fontSize: 13, color: "#8E8E93", textAlign: "center" },

  nextBtn: {
    backgroundColor: "#1C1C1E", borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 4,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  skipLink: { alignSelf: "center", padding: 12 },
  skipLinkText: { fontSize: 14, color: "#AEAEB2" },

  // Create screen
  createScroll: { flex: 1, backgroundColor: "#fff" },
  createContent: { padding: 20, gap: 4, paddingBottom: 48 },
  createPageTitle: { fontSize: 24, fontWeight: "900", color: "#1C1C1E", marginBottom: 20, letterSpacing: -0.5 },

  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#3C3C43", marginBottom: 6 },
  charCount: { fontWeight: "400", color: "#AEAEB2" },

  textArea: {
    borderWidth: 1.5, borderColor: "#E5E5EA", borderRadius: 12,
    padding: 14, fontSize: 16, color: "#1C1C1E",
    minHeight: 70, textAlignVertical: "top", marginBottom: 16,
  },

  optionsRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 16 },
  optionCol: { flex: 1 },
  optionVs: { fontSize: 12, fontWeight: "700", color: "#AEAEB2", paddingBottom: 14 },
  optionInput: {
    borderWidth: 1.5, borderRadius: 12, padding: 12,
    fontSize: 15, color: "#1C1C1E",
  },

  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  presetChip: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#E5E5EA", backgroundColor: "#fff",
  },
  presetChipActive: { borderColor: "#1C1C1E", backgroundColor: "#1C1C1E" },
  presetChipText: { fontSize: 13, fontWeight: "600", color: "#3C3C43" },
  presetChipTextActive: { color: "#fff" },

  customMinInput: {
    borderWidth: 1.5, borderColor: "#E5E5EA", borderRadius: 12,
    padding: 12, fontSize: 15, color: "#1C1C1E", marginBottom: 12,
  },

  statusBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 4 },
  statusText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },

  submitBtn: {
    backgroundColor: "#1C1C1E", borderRadius: 14, paddingVertical: 17,
    alignItems: "center", marginTop: 12,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
