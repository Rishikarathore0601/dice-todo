/*
README — Dice To-Do (Expo + React Native) — FIXED

Problem fixed in this version:
- The original file used many `react-native-paper` components that may cause build errors depending on the installed version of `react-native-paper` and the project's React Native setup. It also imported `Paragraph` which is not consistently available across versions.
- To maximize compatibility and remove version-dependent breakage, this updated `App.js` uses **only core React Native components** and keeps AsyncStorage usage guarded with safe wrappers and sensible fallbacks.

What this contains now:
- A single-file example `App.js` (below) for an Expo-managed React Native app.
- Features: Add tasks (High/Medium/Low), weighted dice roll (High=3, Med=2, Low=1), mark done/delete, persistent storage via AsyncStorage (with safe try/catch fallback), simple roll animation, and a clean UI built with core components.

Important: This version intentionally avoids `react-native-paper` so it will run reliably with any Expo-managed JS project.

Setup steps (run in your terminal):

1) Create a new Expo app (JavaScript template):
   npx create-expo-app dice-todo --template blank
   cd dice-todo

2) Install AsyncStorage (required):
   npx expo install @react-native-async-storage/async-storage

3) Replace the contents of `App.js` with the code below.

4) Start the app
   npx expo start
   # then open on an emulator or Expo Go on your phone

Notes & suggestions
- Tasks are saved locally (AsyncStorage) — no backend required.
- The dice picks among *incomplete* tasks only. Completed tasks are excluded.
- The UI uses only React Native core components for maximum compatibility.

---
Below is the full `App.js`. Copy everything and paste into your project's App.js.
*/

import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Keyboard,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@dice_todo_tasks_v1";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tempSelected, setTempSelected] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");

  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    loadTasks();
    // cleanup on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // Persist whenever tasks change
    saveTasks();
  }, [tasks]);

  // Safe AsyncStorage wrappers
  async function safeGetItem(key) {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === "function") {
        return await AsyncStorage.getItem(key);
      }
    } catch (e) {
      console.warn("AsyncStorage.getItem failed", e);
    }
    return null;
  }

  async function safeSetItem(key, value) {
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === "function") {
        await AsyncStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("AsyncStorage.setItem failed", e);
    }
  }

  async function loadTasks() {
    try {
      const raw = await safeGetItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTasks(parsed);
      }
    } catch (e) {
      console.warn("Failed to load tasks", e);
    }
  }

  async function saveTasks() {
    try {
      await safeSetItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn("Failed to save tasks", e);
    }
  }

  function resetForm() {
    setName("");
    setPriority("Medium");
  }

  function addTask() {
    if (!name || !name.trim()) {
      setError("Please enter a task name");
      return;
    }
    const newTask = {
      id: Date.now().toString(),
      name: name.trim(),
      priority,
      done: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [newTask, ...prev]);
    resetForm();
    setModalVisible(false);
    setError("");
    Keyboard.dismiss();
  }

  function toggleDone(id) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    if (selectedTask && selectedTask.id === id) setSelectedTask(null);
  }

  function deleteTask(id) {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => setTasks((prev) => prev.filter((t) => t.id !== id)),
      },
    ]);
  }

  // Weighted pick function: High=3, Medium=2, Low=1
  function pickWeightedTask(pool) {
    if (!pool || pool.length === 0) return null;
    const expanded = [];
    for (const t of pool) {
      const w = t.priority === "High" ? 3 : t.priority === "Medium" ? 2 : 1;
      for (let i = 0; i < w; i++) expanded.push(t.id);
    }
    const id = expanded[Math.floor(Math.random() * expanded.length)];
    return pool.find((p) => p.id === id) || null;
  }

  function rollDice() {
    setSelectedTask(null);
    const available = tasks.filter((t) => !t.done);
    if (!available.length) {
      setSelectedTask(null);
      setError("No incomplete tasks to pick from. Add some!");
      return;
    }

    setError("");
    setRolling(true);

    // quick animation: cycle through random tasks, then settle on weighted pick
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    intervalRef.current = setInterval(() => {
      const next = available[Math.floor(Math.random() * available.length)];
      setTempSelected(next);
    }, 80);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const final = pickWeightedTask(available);
      setSelectedTask(final);
      setTempSelected(null);
      setRolling(false);
    }, 1200);
  }

  function renderPriorityChip(p) {
    const bg =
      p === "High" ? "#ff6b6b" : p === "Medium" ? "#ffb86b" : "#6bff95";
    return (
      <View style={[styles.chip, { backgroundColor: bg }]}>
        <Text style={styles.chipText}>{p}</Text>
      </View>
    );
  }

  function TaskCard({ item }) {
    return (
      <View style={styles.card}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.taskText, item.done && styles.taskDone]}>
              {item.name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                marginTop: 6,
                alignItems: "center",
              }}
            >
              {renderPriorityChip(item.priority)}
              <Text style={{ color: "#666", fontSize: 12, marginLeft: 8 }}>
                Added {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => toggleDone(item.id)}
              style={styles.iconBtn}
            >
              <Text style={{ fontSize: 18 }}>{item.done ? "↩️" : "✔️"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteTask(item.id)}
              style={styles.iconBtn}
            >
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>🎲 Dice To-Do</Text>
        <Text style={styles.subtitle}>Let chance choose — with priority</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={[styles.button, rolling && { opacity: 0.6 }]}
            onPress={rollDice}
            disabled={rolling}
          >
            <Text style={styles.buttonText}>
              {rolling ? "Rolling..." : "Roll Dice"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.outlineButton]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.outlineText}>+ Add Task</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={{ marginVertical: 12 }}>
          {selectedTask ? (
            <View style={styles.selectedCard}>
              <Text style={styles.selectedTitle}>Selected Task</Text>
              <Text style={styles.selectedName}>{selectedTask.name}</Text>
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                {renderPriorityChip(selectedTask.priority)}
              </View>
            </View>
          ) : tempSelected ? (
            <View style={styles.tempCard}>
              <Text style={styles.selectedTitle}>Rolling…</Text>
              <Text style={styles.selectedName}>{tempSelected.name}</Text>
            </View>
          ) : (
            <View style={styles.hintCard}>
              <Text style={{ color: "#444" }}>
                Tap <Text style={{ fontWeight: "700" }}>Roll Dice</Text> to pick
                a task (priority-weighted).
              </Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Tasks</Text>
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TaskCard item={item} />}
            ListEmptyComponent={() => (
              <View style={[styles.card, { padding: 16, marginTop: 12 }]}>
                <Text style={{ color: "#666" }}>
                  No tasks yet. Add one with the + button or "Add Task".
                </Text>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 120 }}
          />
        </View>

        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text
                style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}
              >
                Add Task
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Task name"
                value={name}
                onChangeText={(t) => setName(t)}
              />

              <View style={{ marginTop: 12 }}>
                <Text style={{ marginBottom: 8 }}>Priority</Text>
                <View style={{ flexDirection: "row" }}>
                  {["High", "Medium", "Low"].map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(p)}
                      style={[
                        styles.priorityBtn,
                        priority === p
                          ? styles.priorityBtnActive
                          : { backgroundColor: "#eee" },
                      ]}
                    >
                      <Text
                        style={
                          priority === p
                            ? { color: "#fff", fontWeight: "700" }
                            : {}
                        }
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {error ? (
                <Text style={{ color: "#9b1c1c", marginTop: 6 }}>{error}</Text>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  marginTop: 18,
                  justifyContent: "flex-end",
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    setError("");
                    resetForm();
                  }}
                  style={{ padding: 8 }}
                >
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addTask}
                  style={[styles.button, { marginLeft: 12 }]}
                >
                  <Text style={styles.buttonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Text style={{ color: "#fff", fontSize: 22 }}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },
  header: { padding: 16, paddingTop: Platform.OS === "android" ? 20 : 16 },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#666", marginTop: 6 },
  content: { flex: 1, paddingHorizontal: 14, paddingBottom: 40 },
  topRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 10,
  },
  button: {
    backgroundColor: "#2b8cff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  outlineButton: { backgroundColor: "transparent", marginLeft: 12 },
  outlineText: { color: "#2b8cff", fontWeight: "700" },
  errorBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#fff4f1",
    borderRadius: 8,
  },
  errorText: { color: "#7a1f1f" },
  selectedCard: { padding: 12, backgroundColor: "#e8f6ff", borderRadius: 12 },
  tempCard: { padding: 12, backgroundColor: "#fff7e6", borderRadius: 12 },
  hintCard: { padding: 12, backgroundColor: "#ffffff", borderRadius: 12 },
  selectedTitle: { fontSize: 12, color: "#333" },
  selectedName: { fontSize: 20, fontWeight: "700", marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  card: {
    marginVertical: 6,
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
  },
  taskText: { fontSize: 16, fontWeight: "600", color: "#222" },
  taskDone: { textDecorationLine: "line-through", color: "#999" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    width: "90%",
    padding: 16,
    borderRadius: 10,
  },
  input: { borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 8 },
  priorityBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#eee",
  },
  priorityBtnActive: { backgroundColor: "#2b8cff" },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginRight: 6,
  },
  chipText: { fontWeight: "700", fontSize: 12 },
  iconBtn: { padding: 8, marginLeft: 6 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#2b8cff",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
});

/*
End of App.js
*/
