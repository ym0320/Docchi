import { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { createApi, DEFAULT_API_BASE } from "./src/api";
import type { Poll, PollResult } from "./src/types";

type Screen = "vote" | "create";

const MIN_CLOSE_MINUTES = 1;
const MAX_CLOSE_MINUTES = 60 * 24 * 3;

export default function App() {
  const [screen, setScreen] = useState<Screen>("vote");
  const [baseUrlInput, setBaseUrlInput] = useState(DEFAULT_API_BASE.replace(/\/api\/v1$/, ""));
  const [apiBaseUrl, setApiBaseUrl] = useState(baseUrlInput);
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>API URL (Expo Go向け)</Text>
        <TextInput style={styles.input} value={baseUrlInput} onChangeText={setBaseUrlInput} placeholder="例: http://192.168.1.10:8787" autoCapitalize="none" />
        <Pressable style={styles.applyButton} onPress={() => setApiBaseUrl(baseUrlInput)}><Text>API URLを適用</Text></Pressable>
      </View>
      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, screen === "vote" && styles.activeTab]} onPress={() => setScreen("vote")}><Text>投票</Text></Pressable>
        <Pressable style={[styles.tab, screen === "create" && styles.activeTab]} onPress={() => setScreen("create")}><Text>投稿</Text></Pressable>
      </View>
      {screen === "vote" ? <VoteScreen api={api} /> : <CreateScreen api={api} />}
    </SafeAreaView>
  );
}

function VoteScreen({ api }: { api: ReturnType<typeof createApi> }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [result, setResult] = useState<PollResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadNext = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      await api.initSession();
      setPoll(await api.fetchNextPoll());
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNext().catch(console.error);
  }, [api]);

  const vote = async (selected: "A" | "B") => {
    if (!poll || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      setResult(await api.votePoll(poll.id, selected));
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.content}>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading && <Text style={styles.hint}>投票を読み込み中です...</Text>}
      {!loading && !poll && <Text>表示できる投票がありません。</Text>}
      {poll && <>
        <Text style={styles.title}>{poll.title}</Text>
        <Text style={styles.hint}>締切: {new Date(poll.closes_at).toLocaleString()}</Text>
        <Pressable style={[styles.choice, submitting && styles.disabled]} disabled={submitting} onPress={() => vote("A")}><Text>{poll.option_a}</Text></Pressable>
        <Pressable style={[styles.choice, submitting && styles.disabled]} disabled={submitting} onPress={() => vote("B")}><Text>{poll.option_b}</Text></Pressable>
      </>}
      {result && <View style={styles.resultCard}>
        <Text>A: {result.votes_a}票 ({result.percent_a}%)</Text>
        <Text>B: {result.votes_b}票 ({result.percent_b}%)</Text>
        <Pressable style={styles.nextButton} onPress={() => loadNext()}><Text>次へ</Text></Pressable>
      </View>}
      {!result && !loading && <Pressable style={styles.secondaryButton} onPress={() => loadNext()}><Text>別のお題を読む</Text></Pressable>}
    </View>
  );
}

function CreateScreen({ api }: { api: ReturnType<typeof createApi> }) {
  const [title, setTitle] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const normalizedTitle = title.trim();
    const normalizedOptionA = optionA.trim();
    const normalizedOptionB = optionB.trim();
    const closeInMinutes = Number(minutes);

    if (normalizedTitle.length < 1 || normalizedTitle.length > 60) {
      setMessage("タイトルは1〜60文字で入力してください");
      return;
    }
    if (normalizedOptionA.length < 1 || normalizedOptionA.length > 30) {
      setMessage("選択肢Aは1〜30文字で入力してください");
      return;
    }
    if (normalizedOptionB.length < 1 || normalizedOptionB.length > 30) {
      setMessage("選択肢Bは1〜30文字で入力してください");
      return;
    }
    if (!Number.isInteger(closeInMinutes) || closeInMinutes < MIN_CLOSE_MINUTES || closeInMinutes > MAX_CLOSE_MINUTES) {
      setMessage("締切は1〜4320分で入力してください");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      await api.initSession();
      await api.createPoll({
        title: normalizedTitle,
        option_a: normalizedOptionA,
        option_b: normalizedOptionB,
        close_in_minutes: closeInMinutes,
        turnstile_token: turnstileToken.trim(),
      });
      setTitle("");
      setOptionA("");
      setOptionB("");
      setMinutes("60");
      setTurnstileToken("");
      setMessage("投稿しました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "投稿失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.content}>
      <TextInput style={styles.input} placeholder="タイトル(1-60)" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="選択肢A(1-30)" value={optionA} onChangeText={setOptionA} />
      <TextInput style={styles.input} placeholder="選択肢B(1-30)" value={optionB} onChangeText={setOptionB} />
      <TextInput style={styles.input} placeholder="締切(分, 1-4320)" keyboardType="numeric" value={minutes} onChangeText={setMinutes} />
      <TextInput style={styles.input} placeholder="Turnstile token (必要な場合のみ)" value={turnstileToken} onChangeText={setTurnstileToken} autoCapitalize="none" />
      <Text style={styles.hint}>ローカルで `BYPASS_TURNSTILE=true` の場合は空欄で投稿できます。</Text>
      <Pressable style={[styles.submitButton, submitting && styles.disabled]} disabled={submitting} onPress={submit}><Text>{submitting ? "投稿中..." : "投稿する"}</Text></Pressable>
      {!!message && <Text style={message === "投稿しました" ? styles.success : styles.error}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  settingsCard: { margin: 12, padding: 12, borderRadius: 12, backgroundColor: "#f7f7f7", gap: 8 },
  settingsTitle: { fontWeight: "700" },
  applyButton: { backgroundColor: "#d5e8ff", padding: 10, borderRadius: 8, alignItems: "center" },
  tabRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "#f2f2f2", borderRadius: 10 },
  activeTab: { backgroundColor: "#d5e8ff" },
  content: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  choice: { padding: 16, borderWidth: 1, borderColor: "#ddd", borderRadius: 12 },
  disabled: { opacity: 0.6 },
  resultCard: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#f6f9ff", gap: 6 },
  nextButton: { marginTop: 8, padding: 10, alignSelf: "flex-start", backgroundColor: "#d5e8ff", borderRadius: 8 },
  secondaryButton: { padding: 10, alignSelf: "flex-start", backgroundColor: "#f2f2f2", borderRadius: 8 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10 },
  submitButton: { backgroundColor: "#d5e8ff", padding: 12, borderRadius: 10, alignItems: "center" },
  error: { color: "#c00" },
  success: { color: "#18794e" },
  hint: { color: "#666" },
});
