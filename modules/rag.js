import { currentUser } from "./auth.js";
import { speak } from "./speech.js";

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

function addChat(role, text) {
  const box = document.getElementById("chatBox");
  const line = document.createElement("div");
  line.className = "chat-line " + (role === "user" ? "user" : "ai");
  line.textContent = (role === "user" ? "You: " : "Friday: ") + text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

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

function buildSystemPrompt() {
  const name = currentUser ? currentUser.data.name : "Boss";
  const profile = buildUserProfile();
  return `
You are Friday, an advanced C2 American English tutor and personal assistant for "${name}".

OUTPUT FORMAT (ALWAYS EXACTLY THIS):
EN: <short answer in English (1–3 sentences) DIRECTLY about what the user has just said or asked, no new topics>
ES: <short Spanish translation of the EN answer, natural and simple>
FIX: <if the user's English had a mistake, write: "You can say: …" with the corrected version. If their English was fine, write: "OK">

RULES:
- Focus ONLY on the user's last message. Answer about that and do not change to other topics unless they clearly ask for it.
- Be concise and friendly. No long paragraphs unless they specifically ask for a detailed explanation or story.
- If the user talks in Spanish and asks for help, you may explain briefly in Spanish in ES:, but keep ES short.
- Do NOT ask follow-up questions unless the user invites more conversation (e.g., "What do you think?", "Ask me something", "More examples", "More questions").
- Your job is:
  1) Answer naturally in English (EN:).
  2) Translate it to Spanish (ES:).
  3) Correct their English briefly (FIX:).
- If the user explicitly says "tutor mode" or "be my tutor", you can ask short practice questions, but always keep EN/ES/FIX format.
- When documents (study sources) are provided, use them as main reference if relevant to the question. Otherwise, use your general knowledge, but still keep EN/ES/FIX format.

User data summary (for context only):
${profile}
  `.trim();
}

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

export async function processInput(text) {
  if (!text) return;

  const lower = text.toLowerCase();

  // Stop command
  if (lower.includes("friday stop for today") || lower.includes("friday stop")) {
    const bye = `EN: Alright, I'll stop for today.\nES: Está bien, paro por hoy.\nFIX: OK`;
    addChat("ai", bye);
    await speak(bye);
    return;
  }

  addChat("user", text);

  const key = getGroqKey();
  if (!key) {
    const msg = "EN: I need your Groq API key first.\nES: Necesito tu Groq API key primero.\nFIX: OK";
    addChat("ai", msg);
    await speak(msg);
    return;
  }

  if (history.length === 0) {
    history.push({ role: "system", content: buildSystemPrompt() });
  }

  history.push({ role: "user", content: text });

  const body = {
    model: getGroqModel(),
    messages: history.slice(-8),
    temperature: 0.6,
    max_tokens: 220,
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
      reply = "EN: I had a problem talking to Groq.\nES: Tuve un problema al conectar con Groq.\nFIX: OK";
    } else {
      reply = data.choices?.[0]?.message?.content || "EN: I could not understand the response.\nES: No pude entender la respuesta.\nFIX: OK";
      history.push({ role: "assistant", content: reply });
    }
  } catch (e) {
    console.error(e);
    reply = "EN: I could not reach Groq servers.\nES: No pude conectar con los servidores de Groq.\nFIX: OK";
  }

  addChat("ai", reply);
  await speak(reply);
}

async function testGroq() {
  const key = getGroqKey();
  if (!key) {
    alert("Set your Groq API key first.");
    return;
  }
  await processInput("Hello Friday, this is a test. Please answer very short.");
}

/* Study sources */

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
