import * as UI from "./modules/ui.js";
import * as AUTH from "./modules/auth.js";
import * as VAULT from "./modules/vault.js";
import * as SPEECH from "./modules/speech.js";
import * as RAG from "./modules/rag.js";
import * as MEMORY from "./modules/memory.js";

// Exponer algunos módulos para llamadas globales simples
window.UI = UI;
window.RAG = RAG;
window.VAULT = VAULT;
window.SPEECH = SPEECH;
window.AUTH = AUTH;

function init() {
  UI.init();
  AUTH.init();
  VAULT.init();
  SPEECH.init();
  RAG.init();
  MEMORY.init();
}

document.addEventListener("DOMContentLoaded", init);
