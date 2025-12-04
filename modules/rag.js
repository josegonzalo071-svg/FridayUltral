// modules/rag.js
import { currentUser } from "./auth.js";
import { speak } from "./speech.js";
import { getUserMemorySummary, rememberEvent } from "./memory.js";

let history = [];

export function init() {
  document.getElementById("btnTestGroq").onclick = testGroq;
  document.getElementById("btnAddSource").onclick = addSource;
}

function getGroqKey() {
  return document.getElementById("groqKey").value.trim();
}
function getGroqModel() {
  return (document.getElementById("groqModel").value.trim() || "llama-3.1-8b-instant");
}

/* Chat UI */
function addChat(role, text) {
  const box = document.getElementById("chatBox");
  const line = document.createElement("div");
  line.className = "chat-line " + (role === "user" ? "user" : "ai");

  if (role === "user") {
    line.textContent = "You: " + text;
  } else {
    // Mostrar bloques EN / ES / ASK / FIX de forma más legible
    const parsed = parseBlocks(text);
    line.innerHTML = `
      <div><strong>Friday</strong></div>
      ${parsed.EN ? `<div><strong>EN:</strong> ${parsed.EN}</div>` : ""}
      ${parsed.ES ? `<div><strong>ES:</strong> ${parsed.ES}</div>` : ""}
      ${parsed.ASK ? `<div><strong>ASK:</strong> ${parsed.ASK}</div>` : ""}
      ${parsed.FIX ? `<div><strong>FIX:</strong> ${parsed.FIX}</div>` : ""}
    `;
  }

  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

/* Interpretar el texto en bloques EN/ES/ASK/FIX */
function parseBlocks(text) {
  const result = { EN: "", ES: "", ASK: "", FIX: "" };
  const lines = (text || "").split(/\r?\n/);

  let currentLabel = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^EN:/i.test(line)) {
      currentLabel = "EN";
      result.EN += line.replace(/^EN:\s*/i, "") + " ";
    } else if (/^ES:/i.test(line)) {
      currentLabel = "ES";
      result.ES += line.replace(/^ES:\s*/i, "") + " ";
    } else if (/^ASK:/i.test(line)) {
      currentLabel = "ASK";
      result.ASK += line.replace(/^ASK:\s*/i, "") + " ";
    } else if (/^FIX:/i.test(line)) {
      currentLabel = "FIX";
      result.FIX += line.replace(/^FIX:\s*/i, "") + " ";
    } else if (currentLabel) {
      result[currentLabel] += line + " ";
    }
  }

  // Quitar espacios de más
  Object.keys(result).forEach(k => {
    result[k] = result[k].trim();
  });

  // Si el modelo no respetó el formato, dejamos el texto crudo en EN
  if (!result.EN && !result.ES && !result.ASK && !result.FIX) {
    result.EN = text;
  }

  return result;
}

/* Perfil del usuario a partir de AUTH / VAULT */
function buildUserProfile() {
  if (!currentUser) return "No structured data yet.";
  const d = currentUser.data;
  return `
User:
- Name: ${d.name}
- Notes: ${d.notes.length}
- Birthdays: ${d.birthdays.length}
- Private items: ${d.priv.length}
- Study sources: ${d.sources.length}
`.trim();
}

/* Prompt del sistema – personalidad mejorada + memoria */
function buildSystemPrompt() {
  const name = currentUser ? currentUser.data.name : "Boss";
  const profile = buildUserProfile();
  const longTerm = getUserMemorySummary();

  return `
You are "Friday Ultra", an advanced, warm, HUMAN-LIKE AI assistant and English tutor for "${name}".

PERSONALITY:
- Friendly, supportive, and expressive.
- Talks like a real person, not a robot.
- Can use emojis sometimes (🙂, 😅, 😉) but not too many.
- Remembers what the user likes and uses that to personalize answers.

OUTPUT FORMAT (ALWAYS EXACTLY THIS ORDER, EVERY TIME):
EN: <natural answer in English (2–4 sentences), directly about what the user just said>
ES: <natural Spanish translation of the EN answer, simple and clear>
ASK: <short follow-up question to keep the conversation alive, in EN or ES depending on what feels more natural>
FIX: <if the user's English had a mistake, write: "You can say: …" with the corrected version.
      If their English was fine or they wrote only in Spanish, write: "OK">

CONVERSATION RULES:
- Focus mainly on the user's LAST message, but keep the tone consistent with the previous conversation.
- Sound human, with small reactions like "Nice!", "I get you", "That makes sense", etc.
- ASK must ALMOST ALWAYS contain a question, unless the user clearly says they want to stop or says goodbye.
- If the user is tired, angry or sad, respond with empathy and care.
- If the user only wants direct answers (like yes/no or quick data), keep EN/ES short but still include ASK with a simple follow-up choice.
- You are also an English tutor:
  - If they write in English, check their English and correct it in FIX.
  - If they write in Spanish and want to learn, you can encourage them to try in English.

USE OF DOCUMENTS (STUDY SOURCES):
- When documents are provided, use them as the main reference if relevant to the question.
- You can ask follow-up questions in ASK related to the document (for example: what part is harder, what they want to practice, etc.).

CONTEXT ABOUT THE USER (ONLY FOR YOU, DO NOT REPEAT LITERALLY):
${profile}

LONG-TERM MEMORY (ONLY FOR YOU, DO NOT REPEAT LITERALLY):
${longTerm}
`.trim();
}

/* Construye "documents" para Groq a partir de Study Sources */
function buildDocuments() {
  if (!currentUser) return [];
  const srcs = currentUser.data.sources || [];
  return srcs.map((s, i) => ({
    id: String(i),
    text: (s.content || "").slice(0, 8000),
    metadata: {
      title: s.title || `Source ${i}`,
      origin: s.origin || ""
    }
  }));
}

/* Procesar entrada del usuario (voz o texto) */
export async function processInput(text) {
  if (!text) return;

  const lower = text.toLowerCase();

  // Comando de stop
  if (lower.includes("friday stop for today") || lower.includes("friday stop")) {
    const bye = `EN: Alright, I'll stop for today.\nES: Está bien, paro por hoy.\nASK: Do you want to continue later?\nFIX: OK`;
    addChat("ai", bye);
    await speak(bye);
    rememberEvent("ai_reply", { text: bye });
    return;
  }

  addChat("user", text);
  rememberEvent("user_message", { text });

  const key = getGroqKey();
  if (!key) {
    const msg = "EN: I need your Groq API key first.\nES: Necesito tu Groq API key primero.\nASK: Can you paste your Groq key in Settings?\nFIX: OK";
    addChat("ai", msg);
    await speak(msg);
    rememberEvent("ai_reply", { text: msg });
    return;
  }

  if (history.length === 0) {
    history.push({ role: "system", content: buildSystemPrompt() });
  }

  history.push({ role: "user", content: text });

  const body = {
    model: getGroqModel(),
    messages: history.slice(-10),
    temperature: 0.7,
    max_tokens: 260,
    documents: buildDocuments()
  };

  let reply = "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Groq error:", data);
      reply = "EN: I had a problem talking to Groq.\nES: Tuve un problema al conectar con Groq.\nASK: Can you check your internet or API key?\nFIX: OK";
    } else {
      reply = data.choices?.[0]?.message?.content || "EN: I could not understand the response.\nES: No pude entender la respuesta.\nASK: Can you ask me again in another way?\nFIX: OK";
      history.push({ role: "assistant", content: reply });
    }
  } catch (e) {
    console.error(e);
    reply = "EN: I could not reach Groq servers.\nES: No pude conectar con los servidores de Groq.\nASK: Do you want to try again in a moment?\nFIX: OK";
  }

  addChat("ai", reply);
  rememberEvent("ai_reply", { text: reply });
  await speak(reply);
}

/* Test rápido desde Settings */
async function testGroq() {
  const key = getGroqKey();
  if (!key) {
    alert("Set your Groq API key first.");
    return;
  }
  await processInput("Hello Friday, this is a short test. Answer in your normal style.");
}

/* Renderizado de Study Sources (igual que antes) */
export function renderSources() {
  if (!currentUser) return;
  const list = document.getElementById("srcList");
  list.innerHTML = "";
  const srcs = currentUser.data.sources || [];
  srcs.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "list-item";
    const left = document.createElement("div");
    left.innerHTML = `<span class="list-label">${s.title}</span> (${s.origin || "no origin"})`;
    const actions = document.createElement("div");
    actions.className = "list-actions";
    const btnDel = document.createElement("button");
    btnDel.textContent = "🗑";
    btnDel.onclick = () => {
      currentUser.data.sources.splice(idx, 1);
    };
    actions.appendChild(btnDel);
    div.appendChild(left);
    div.appendChild(actions);
    list.appendChild(div);
  });
}

function addSource() {
  if (!currentUser) {
    alert("Log in first.");
    return;
  }
  const title = document.getElementById("srcTitle").value.trim();
  const origin = document.getElementById("srcOrigin").value.trim();
  const content = document.getElementById("srcContent").value.trim();
  if (!title || !content) {
    alert("Title and content are required.");
    return;
  }
  currentUser.data.sources.push({
    title,
    origin,
    content,
    createdAt: new Date().toISOString()
  });
  import("./auth.js").then(m => m.saveCurrentUser());
  document.getElementById("srcContent").value = "";
  renderSources();
}
