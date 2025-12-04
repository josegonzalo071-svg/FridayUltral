import * as UI from "./ui.js";
import * as VAULT from "./vault.js";

let userDb = {};
export let currentUser = null; // { username, data }

const STORAGE_KEY = "friday_ultra_users";
const STORAGE_LAST = "friday_ultra_last_user";

function loadDb() {
  try {
    userDb = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    userDb = {};
  }
}

function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userDb));
  } catch {}
}

export function init() {
  loadDb();

  const tabLogin = document.getElementById("tabLogin");
  const tabSignup = document.getElementById("tabSignup");
  const btnAuth = document.getElementById("btnAuth");

  tabLogin.onclick = () => UI.switchAuthMode("login");
  tabSignup.onclick = () => UI.switchAuthMode("signup");
  btnAuth.onclick = handleAuth;

  // Autorellenar último usuario
  try {
    const last = localStorage.getItem(STORAGE_LAST);
    if (last) {
      document.getElementById("username").value = last;
    }
  } catch {}
}

function showError(msg) {
  document.getElementById("authError").textContent = msg || "";
}

async function handleAuth() {
  showError("");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const displayName = document.getElementById("displayName").value.trim();
  const nameFieldVisible = !document.getElementById("nameField").classList.contains("hidden");

  if (!username || !password) {
    showError("Username and password required.");
    return;
  }

  if (nameFieldVisible) {
    // Sign up
    if (userDb[username]) {
      showError("User already exists. Choose another username.");
      return;
    }

    if (password.length < 4) {
      showError("Password must be at least 4 characters.");
      return;
    }

    userDb[username] = {
      pass: password,
      name: displayName || username,
      notes: [],
      birthdays: [],
      priv: [],
      sources: []
    };
    saveDb();
    setCurrentUser(username);
  } else {
    // Login
    const u = userDb[username];
    if (!u || u.pass !== password) {
      showError("Invalid username or password.");
      return;
    }
    setCurrentUser(username);
  }

  // Guardar último usuario
  try {
    localStorage.setItem(STORAGE_LAST, username);
  } catch {}

  // Ocultar login, mostrar app
  document.getElementById("loginOverlay").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  // Actualizar cabecera
  const name = currentUser.data.name;
  document.getElementById("appTitle").textContent = `Friday — with ${name}`;
  document.getElementById("appStatus").textContent = `Ready for you, ${name}. Say "Hello Friday" to start.`;

  VAULT.render();
}

function setCurrentUser(username) {
  const data = userDb[username];
  currentUser = { username, data };

  // Asegurar arrays
  if (!currentUser.data.notes) currentUser.data.notes = [];
  if (!currentUser.data.birthdays) currentUser.data.birthdays = [];
  if (!currentUser.data.priv) currentUser.data.priv = [];
  if (!currentUser.data.sources) currentUser.data.sources = [];
}

export function saveCurrentUser() {
  if (!currentUser) return;
  userDb[currentUser.username] = currentUser.data;
  saveDb();
}

export function logout() {
  currentUser = null;
  document.getElementById("app").classList.add("hidden");
  document.getElementById("loginOverlay").classList.remove("hidden");
}
