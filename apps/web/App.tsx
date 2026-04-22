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

const C = {
  bg: "#0f0f13",
  surface: "#1a1a22",
  surfaceHigh: "#24242f",
  border: "#2e2e3d",
  textPrimary: "#f0f0f5",
  textSecondary: "#8888aa",
  a: "#5b8cff",
  aLight: "#1a2a55",
  b: "#ff6b5b",
  bLight: "#451a16",
  accent: "#7c5cfc",
  success: "#34d399",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("vote");

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.header}>
        <Text style={styles.logo}>Docchi</Text>
        <Text style={styles.tagline}>どっちにする？</Text>
      </View>

      <View style={styles.body}>
        {screen === "vote" ? <VoteScreen /> : <CreateScreen />}
      </View>

      <View style={styles.tabBar}>
        <Pressable style={styles.tabItem} onPress={() => setScreen("vote")}>
          <View style={[styles.tabIndicator, screen === "vote" && styles.tabIndicatorActive]} />
          <Text style={[styles.tabLabel, screen === "vote" && styles.tabLabelActive]}>投票</Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setScreen("create")}>
          <View style={[styles.tabIndicator, screen === "create" && styles.tabIndicatorActive]} />
          <Text style={[styles.tabLabel, screen === "create" && styles.tabLabelActive]}>投稿</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function VoteScreen() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [result, setResult] = useState<PollResult | null>(null);
  const [chosen, setChosen] = useState<"A" | "B" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const barA = useRef(new Animated.Value(0)).current;
  const barB = useRef(new Animated.Value(0)).current;

  const loadNext = async () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setChosen(null);
      barA.setValue(0);
      barB.setValue(0);
      try {
        await api.initSession();
        setPoll(await api.fetchNextPoll());
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      } finally {
        setLoading(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }
    });
  };

  useEffect(() => { loadNext(); }, []);

  const vote = async (selected: "A" | "B") => {
    if (!poll || submitting) return;
    setSubmitting(true);
    setChosen(selected);
    try {
      const res = await api.votePoll(poll.id, selected);
      setResult(res);
      Animated.parallel([
        Animated.spring(barA, { toValue: res.percent_a / 100, useNativeDriver: false }),
        Animated.spring(barB, { toValue: res.percent_b / 100, useNativeDriver: false }),
      ]).start();
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票に失敗しました");
      setChosen(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  if (!poll) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🤔</Text>
        <Text style={styles.emptyText}>投票がありません</Text>
        <Text style={styles.emptyHint}>「投稿」タブから質問を追加しよう</Text>
        <Pressable style={styles.reloadBtn} onPress={loadNext}>
          <Text style={styles.reloadBtnText}>再読み込み</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.voteWrap, { opacity: fadeAnim }]}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.questionLabel}>Q.</Text>
        <Text style={styles.questionText}>{poll.title}</Text>
        <Text style={styles.deadline}>
          締切 {new Date(poll.closes_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>

      {!result ? (
        <View style={styles.choiceRow}>
          <Pressable
            style={[styles.choiceBtn, styles.choiceBtnA, submitting && styles.btnDisabled]}
            disabled={submitting}
            onPress={() => vote("A")}
          >
            <Text style={styles.choiceLetter}>A</Text>
            <Text style={styles.choiceText}>{poll.option_a}</Text>
          </Pressable>

          <View style={styles.orDivider}>
            <Text style={styles.orText}>or</Text>
          </View>

          <Pressable
            style={[styles.choiceBtn, styles.choiceBtnB, submitting && styles.btnDisabled]}
            disabled={submitting}
            onPress={() => vote("B")}
          >
            <Text style={styles.choiceLetter}>B</Text>
            <Text style={styles.choiceText}>{poll.option_b}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.resultWrap}>
          <ResultBar
            label="A"
            optionText={poll.option_a}
            votes={result.votes_a}
            percent={result.percent_a}
            anim={barA}
            color={C.a}
            bgColor={C.aLight}
            chosen={chosen === "A"}
          />
          <ResultBar
            label="B"
            optionText={poll.option_b}
            votes={result.votes_b}
            percent={result.percent_b}
            anim={barB}
            color={C.b}
            bgColor={C.bLight}
            chosen={chosen === "B"}
          />
          <Text style={styles.totalText}>合計 {result.total_votes} 票</Text>
          <Pressable style={styles.nextBtn} onPress={loadNext}>
            <Text style={styles.nextBtnText}>次へ →</Text>
          </Pressable>
        </View>
      )}

      {!result && (
        <Pressable style={styles.skipBtn} onPress={loadNext}>
          <Text style={styles.skipText}>スキップ</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function ResultBar({
  label, optionText, votes, percent, anim, color, bgColor, chosen,
}: {
  label: string; optionText: string; votes: number; percent: number;
  anim: Animated.Value; color: string; bgColor: string; chosen: boolean;
}) {
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[styles.resultRow, chosen && { borderColor: color, borderWidth: 1.5 }]}>
      <View style={styles.resultLabelRow}>
        <Text style={[styles.resultLetter, { color }]}>{label}</Text>
        <Text style={styles.resultOptionText}>{optionText}</Text>
        {chosen && <Text style={[styles.votedBadge, { backgroundColor: color }]}>あなた</Text>}
        <Text style={[styles.resultPercent, { color }]}>{percent}%</Text>
      </View>
      <View style={[styles.barBg, { backgroundColor: bgColor }]}>
        <Animated.View style={[styles.barFill, { width, backgroundColor: color }]} />
      </View>
      <Text style={styles.voteCount}>{votes} 票</Text>
    </View>
  );
}

function CreateScreen() {
  const [title, setTitle] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const PRESETS = [
    { label: "1時間", value: "60" },
    { label: "半日", value: "720" },
    { label: "1日", value: "1440" },
    { label: "3日", value: "4320" },
  ];

  const submit = async () => {
    const t = title.trim(), a = optionA.trim(), b = optionB.trim();
    const mins = Number(minutes);

    if (t.length < 1 || t.length > 60) return setMessage({ text: "タイトルは1〜60文字", ok: false });
    if (a.length < 1 || a.length > 30) return setMessage({ text: "選択肢Aは1〜30文字", ok: false });
    if (b.length < 1 || b.length > 30) return setMessage({ text: "選択肢Bは1〜30文字", ok: false });
    if (!Number.isInteger(mins) || mins < 1 || mins > 4320) return setMessage({ text: "締切は1〜4320分", ok: false });

    setSubmitting(true);
    setMessage(null);
    try {
      await api.initSession();
      await api.createPoll({ title: t, option_a: a, option_b: b, close_in_minutes: mins, turnstile_token: "" });
      setTitle(""); setOptionA(""); setOptionB(""); setMinutes("60");
      setMessage({ text: "投稿しました！", ok: true });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "投稿に失敗しました", ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.createScroll} contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.createTitle}>新しい質問を投稿</Text>

        <Text style={styles.fieldLabel}>質問タイトル <Text style={styles.fieldLimit}>{title.length}/60</Text></Text>
        <TextInput
          style={styles.textField}
          placeholder="例：猫派と犬派、どっちが好き？"
          placeholderTextColor={C.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          multiline
        />

        <View style={styles.optionRow}>
          <View style={[styles.optionWrap, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: C.a }]}>A <Text style={styles.fieldLimit}>{optionA.length}/30</Text></Text>
            <TextInput
              style={[styles.textField, styles.optionField, { borderColor: C.a + "44" }]}
              placeholder="選択肢A"
              placeholderTextColor={C.textSecondary}
              value={optionA}
              onChangeText={setOptionA}
              maxLength={30}
            />
          </View>
          <View style={styles.optionVs}>
            <Text style={styles.vsText}>vs</Text>
          </View>
          <View style={[styles.optionWrap, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: C.b }]}>B <Text style={styles.fieldLimit}>{optionB.length}/30</Text></Text>
            <TextInput
              style={[styles.textField, styles.optionField, { borderColor: C.b + "44" }]}
              placeholder="選択肢B"
              placeholderTextColor={C.textSecondary}
              value={optionB}
              onChangeText={setOptionB}
              maxLength={30}
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>締切</Text>
        <View style={styles.presetRow}>
          {PRESETS.map(p => (
            <Pressable
              key={p.value}
              style={[styles.presetChip, minutes === p.value && styles.presetChipActive]}
              onPress={() => setMinutes(p.value)}
            >
              <Text style={[styles.presetText, minutes === p.value && styles.presetTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.textField}
          placeholder="または分単位で入力 (1〜4320)"
          placeholderTextColor={C.textSecondary}
          keyboardType="numeric"
          value={minutes}
          onChangeText={setMinutes}
        />

        {message && (
          <View style={[styles.messageBanner, { backgroundColor: message.ok ? "#0d3d2a" : "#3d0d0d" }]}>
            <Text style={[styles.messageText, { color: message.ok ? C.success : C.b }]}>{message.text}</Text>
          </View>
        )}

        <Pressable style={[styles.submitBtn, submitting && styles.btnDisabled]} disabled={submitting} onPress={submit}>
          <Text style={styles.submitBtnText}>{submitting ? "投稿中..." : "投稿する"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  logo: { fontSize: 26, fontWeight: "800", color: C.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  body: { flex: 1 },

  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabIndicator: { width: 24, height: 3, borderRadius: 2, backgroundColor: "transparent", marginBottom: 4 },
  tabIndicatorActive: { backgroundColor: C.accent },
  tabLabel: { fontSize: 13, color: C.textSecondary },
  tabLabelActive: { color: C.textPrimary, fontWeight: "700" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: C.textSecondary, fontSize: 15 },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyText: { fontSize: 18, fontWeight: "700", color: C.textPrimary },
  emptyHint: { fontSize: 13, color: C.textSecondary },
  reloadBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: C.surfaceHigh, borderRadius: 20 },
  reloadBtnText: { color: C.textPrimary, fontSize: 14, fontWeight: "600" },

  voteWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  errorBanner: { backgroundColor: "#3d0d0d", borderRadius: 10, padding: 12 },
  errorText: { color: C.b, fontSize: 13 },

  card: { backgroundColor: C.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  questionLabel: { fontSize: 11, fontWeight: "700", color: C.accent, letterSpacing: 1, marginBottom: 6 },
  questionText: { fontSize: 22, fontWeight: "800", color: C.textPrimary, lineHeight: 30 },
  deadline: { fontSize: 11, color: C.textSecondary, marginTop: 10 },

  choiceRow: { flexDirection: "row", gap: 0, alignItems: "stretch", height: 180 },
  choiceBtn: {
    flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center",
    padding: 16, gap: 8,
  },
  choiceBtnA: { backgroundColor: C.aLight, borderWidth: 1.5, borderColor: C.a, marginRight: 6 },
  choiceBtnB: { backgroundColor: C.bLight, borderWidth: 1.5, borderColor: C.b, marginLeft: 6 },
  btnDisabled: { opacity: 0.5 },
  choiceLetter: { fontSize: 32, fontWeight: "900", color: C.textPrimary },
  choiceText: { fontSize: 15, fontWeight: "700", color: C.textPrimary, textAlign: "center" },
  orDivider: { width: 28, alignItems: "center", justifyContent: "center" },
  orText: { fontSize: 12, fontWeight: "600", color: C.textSecondary },

  resultWrap: { gap: 10 },
  resultRow: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border, gap: 8,
  },
  resultLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultLetter: { fontSize: 16, fontWeight: "900", width: 20 },
  resultOptionText: { flex: 1, fontSize: 14, fontWeight: "600", color: C.textPrimary },
  votedBadge: { fontSize: 10, fontWeight: "700", color: "#fff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  resultPercent: { fontSize: 18, fontWeight: "800" },
  barBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  voteCount: { fontSize: 11, color: C.textSecondary },
  totalText: { fontSize: 12, color: C.textSecondary, textAlign: "center" },
  nextBtn: {
    backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14,
    alignItems: "center", marginTop: 4,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  skipBtn: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 20 },
  skipText: { color: C.textSecondary, fontSize: 13 },

  createScroll: { flex: 1 },
  createContent: { padding: 20, gap: 6, paddingBottom: 40 },
  createTitle: { fontSize: 20, fontWeight: "800", color: C.textPrimary, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.5, marginBottom: 4 },
  fieldLimit: { fontWeight: "400" },
  textField: {
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    color: C.textPrimary, fontSize: 15, padding: 14, marginBottom: 12,
  },
  optionRow: { flexDirection: "row", alignItems: "flex-end", gap: 0, marginBottom: 0 },
  optionWrap: { gap: 0 },
  optionField: { marginBottom: 12 },
  optionVs: { width: 36, alignItems: "center", paddingBottom: 24 },
  vsText: { fontSize: 12, fontWeight: "700", color: C.textSecondary },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  presetChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  presetChipActive: { backgroundColor: C.accent + "33", borderColor: C.accent },
  presetText: { fontSize: 13, color: C.textSecondary, fontWeight: "600" },
  presetTextActive: { color: C.accent },
  messageBanner: { borderRadius: 10, padding: 12, marginTop: 4 },
  messageText: { fontSize: 14, fontWeight: "600" },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 8,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
