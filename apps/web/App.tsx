import { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { createApi, DEFAULT_API_BASE } from "./src/api";
import type { Poll, PollResult } from "./src/types";

type Screen = "vote" | "create";

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

  const loadNext = async () => {
    setError(null); setResult(null);
    try { await api.initSession(); setPoll(await api.fetchNextPoll()); }
    catch (e) { setError(e instanceof Error ? e.message : "読み込み失敗"); }
  };

  useEffect(() => { loadNext().catch(console.error); }, [api]);

  return (
    <View style={styles.content}>
      {error && <Text style={styles.error}>{error}</Text>}
      {!poll && <Text>表示できる投票がありません。</Text>}
      {poll && <>
        <Text style={styles.title}>{poll.title}</Text>
        <Pressable style={styles.choice} onPress={async () => setResult(await api.votePoll(poll.id, "A"))}><Text>{poll.option_a}</Text></Pressable>
        <Pressable style={styles.choice} onPress={async () => setResult(await api.votePoll(poll.id, "B"))}><Text>{poll.option_b}</Text></Pressable>
      </>}
      {result && <View style={styles.resultCard}>
        <Text>A: {result.votes_a}票 ({result.percent_a}%)</Text>
        <Text>B: {result.votes_b}票 ({result.percent_b}%)</Text>
        <Pressable style={styles.nextButton} onPress={() => loadNext()}><Text>次へ</Text></Pressable>
      </View>}
    </View>
  );
}

function CreateScreen({ api }: { api: ReturnType<typeof createApi> }) {
  const [title, setTitle] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [message, setMessage] = useState("");

  const submit = async () => {
    try {
      await api.initSession();
      await api.createPoll({ title, option_a: optionA, option_b: optionB, close_in_minutes: Number(minutes), turnstile_token: "replace-with-real-turnstile-token" });
      setMessage("投稿しました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "投稿失敗");
    }
  };

  return (
    <View style={styles.content}>
      <TextInput style={styles.input} placeholder="タイトル(1-60)" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="選択肢A(1-30)" value={optionA} onChangeText={setOptionA} />
      <TextInput style={styles.input} placeholder="選択肢B(1-30)" value={optionB} onChangeText={setOptionB} />
      <TextInput style={styles.input} placeholder="締切(分, 1-4320)" keyboardType="numeric" value={minutes} onChangeText={setMinutes} />
      <Pressable style={styles.submitButton} onPress={submit}><Text>投稿する</Text></Pressable>
      {!!message && <Text>{message}</Text>}
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
  resultCard: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#f6f9ff", gap: 6 },
  nextButton: { marginTop: 8, padding: 10, alignSelf: "flex-start", backgroundColor: "#d5e8ff", borderRadius: 8 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10 },
  submitButton: { backgroundColor: "#d5e8ff", padding: 12, borderRadius: 10, alignItems: "center" },
  error: { color: "#c00" },
});
