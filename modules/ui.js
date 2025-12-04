import * as AUTH from "./auth.js";
import * as VAULT from "./vault.js";

const THEME_KEY = "friday_ultra_theme";

export function init() {
  const btnMenu = document.getElementById("btnMenu");
  const sideMenu = document.getElementById("sideMenu");
  const themeToggle = document.getElementById("themeToggle");
  const logoutBtn = document.getElementById("logoutBtn");

  btnMenu.onclick = () => {
    sideMenu.classList.toggle("show");
  };

  // Menú lateral tabs
  sideMenu.querySelectorAll(".menu-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      switchTab(tab);
      sideMenu.classList.remove("show");
    });
  });

  logoutBtn.onclick = () => {
    AUTH.logout();
  };

  // Tema
  initTheme(themeToggle);
}

function initTheme(btn) {
  try {
    const saved = localStorage.getItem(THEME_KEY) || "dark";
    if (saved === "light") {
      document.body.classList.add("light");
      btn.textContent = "☀";
    } else {
      document.body.classList.remove("light");
      btn.textContent = "🌙";
    }
  } catch {}

  btn.onclick = () => {
    const isLight = document.body.classList.toggle("light");
    btn.textContent = isLight ? "☀" : "🌙";
    try {
      localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
    } catch {}
  };
}

export function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.remove("hidden");
}

export function switchAuthMode(mode) {
  const nameField = document.getElementById("nameField");
  const tabLogin = document.getElementById("tabLogin");
  const tabSignup = document.getElementById("tabSignup");

  if (mode === "login") {
    nameField.classList.add("hidden");
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
  } else {
    nameField.classList.remove("hidden");
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
  }
}
