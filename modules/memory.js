// modules/memory.js
import { currentUser } from "./auth.js";

const STORAGE_KEY = "friday_ultra_memory";

let memoryDb = {};

/* Cargar / guardar desde localStorage */
function loadMemory() {
  try {
    memoryDb = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    memoryDb = {};
  }
}

function saveMemory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDb));
  } catch {
    // ignorar errores de cuota
  }
}

function getUserKey() {
  if (currentUser && currentUser.username) return currentUser.username;
  return "_guest";
}

/* Inicialización (ya la llama app.js) */
export function init() {
  loadMemory();
  console.log("Memory module ready with long-term memory.");
}

/**
 * Guarda un evento en la memoria de largo plazo del usuario
 * type: "user_message" | "ai_reply" | "topic"
 * payload: { text?: string, topic?: string }
 */
export function rememberEvent(type, payload = {}) {
  loadMemory();
  const key = getUserKey();
  if (!memoryDb[key]) {
    memoryDb[key] = {
      createdAt: new Date().toISOString(),
      lastSeen: null,
      lastMessages: [],
      topics: {}
    };
  }

  const m = memoryDb[key];
  m.lastSeen = new Date().toISOString();

  if (type === "user_message") {
    const text = (payload.text || "").trim();
    if (text) {
      m.lastMessages.push(text);
      if (m.lastMessages.length > 12) {
        m.lastMessages.shift();
      }
      autoExtractTopics(m, text);
    }
  } else if (type === "ai_reply") {
    const text = (payload.text || "").trim();
    if (text) {
      m.lastMessages.push("FRIDAY: " + text);
      if (m.lastMessages.length > 12) {
        m.lastMessages.shift();
      }
    }
  } else if (type === "topic") {
    if (payload.topic) bumpTopic(m, payload.topic);
  }

  saveMemory();
}

/* Detectar temas comunes automáticamente a partir del texto del usuario */
function autoExtractTopics(m, text) {
  const lower = text.toLowerCase();

  if (lower.includes("impresora") || lower.includes("printer")) {
    bumpTopic(m, "printers");
  }
  if (lower.includes("bocina") || lower.includes("speaker")) {
    bumpTopic(m, "speakers");
  }
  if (lower.includes("monitor") || lower.includes("pantalla")) {
    bumpTopic(m, "monitors");
  }
  if (lower.includes("pc") || lower.includes("computadora") || lower.includes("laptop")) {
    bumpTopic(m, "computers");
  }
  if (lower.includes("ingles") || lower.includes("english")) {
    bumpTopic(m, "english_practice");
  }
  if (lower.includes("trifusion") || lower.includes("tienda")) {
    bumpTopic(m, "business");
  }
}

function bumpTopic(m, topic) {
  if (!m.topics[topic]) m.topics[topic] = 0;
  m.topics[topic] += 1;
}

/**
 * Devuelve un pequeño resumen de la memoria del usuario
 * para inyectarlo al prompt del modelo.
 */
export function getUserMemorySummary() {
  loadMemory();
  const key = getUserKey();
  const m = memoryDb[key];
  if (!m) return "No long-term memory for this user yet.";

  const topTopics = Object.entries(m.topics || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([topic, count]) => `${topic} (${count})`);

  const recent = (m.lastMessages || []).slice(-3);

  return `
Long-term memory:
- First seen: ${m.createdAt}
- Last seen: ${m.lastSeen}
- Top topics: ${topTopics.join(", ") || "none yet"}
- Last interactions: ${recent.join(" || ")}
`.trim();
}

