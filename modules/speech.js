import * as RAG from "./rag.js";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;

export function init() {
  document.getElementById("btnMic").onclick = startMic;
  document.getElementById("btnSend").onclick = manualSend;
}

function startMic() {
  if (!SR) {
    alert("Your browser does not support SpeechRecognition. Use Chrome on PC.");
    return;
  }

  if (!rec) {
    rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = e => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      RAG.processInput(text);
    };

    rec.onerror = e => {
      alert("Mic error: " + e.error + ". Check mic permissions in Chrome.");
    };
    rec.onend = () => {
      // Auto-restart while button logic is simple
      try { rec.start(); } catch {}
    };
  }

  try { rec.start(); } catch {}
}

function manualSend() {
  const text = document.getElementById("manualInput").value.trim();
  if (!text) return;
  document.getElementById("manualInput").value = "";
  RAG.processInput(text);
}

/* Voz: solo lee EN: */
export function speak(fullText) {
  return new Promise(resolve => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const en = extractEnglish(fullText);
    const utter = new SpeechSynthesisUtterance(en || fullText);
    utter.lang = "en-US";
    utter.rate = 1.02;
    utter.pitch = 1.0;
    utter.onend = () => resolve();

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}

function extractEnglish(text) {
  const idx = text.indexOf("EN:");
  if (idx === -1) return text;
  let rest = text.slice(idx + 3);
  const esIdx = rest.indexOf("ES:");
  if (esIdx !== -1) {
    rest = rest.slice(0, esIdx);
  }
  return rest.trim();
}
