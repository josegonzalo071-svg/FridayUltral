import { currentUser, saveCurrentUser } from "./auth.js";

export function init() {
  document.getElementById("btnAddNote").onclick = addNote;
  document.getElementById("btnAddBirthday").onclick = addBirthday;
  document.getElementById("btnAddPrivate").onclick = addPrivate;

  document.getElementById("btnExportVault").onclick = exportVault;
  document.getElementById("btnImportVault").onclick = () => {
    document.getElementById("vaultImportFile").click();
  };
  document.getElementById("vaultImportFile").addEventListener("change", importVault);

  document.getElementById("vaultSearch").addEventListener("input", render);
}

function ensureUser() {
  return !!currentUser;
}

function addNote() {
  if (!ensureUser()) return;
  const title = document.getElementById("noteTitle").value.trim();
  const content = document.getElementById("noteContent").value.trim();
  if (!content) return;

  currentUser.data.notes.push({
    id: Date.now() + "_n",
    title: title || "Note",
    content,
    createdAt: new Date().toISOString()
  });
  saveCurrentUser();
  document.getElementById("noteContent").value = "";
  render();
}

function addBirthday() {
  if (!ensureUser()) return;
  const name = document.getElementById("bdayName").value.trim();
  const date = document.getElementById("bdayDate").value;
  if (!name || !date) return;

  currentUser.data.birthdays.push({
    id: Date.now() + "_b",
    name,
    date
  });
  saveCurrentUser();
  render();
}

function addPrivate() {
  if (!ensureUser()) return;
  const label = document.getElementById("privLabel").value.trim();
  const type = document.getElementById("privType").value.trim() || "note";
  const value = document.getElementById("privValue").value.trim();
  if (!label || !value) return;

  currentUser.data.priv.push({
    id: Date.now() + "_p",
    label,
    type,
    value
  });
  saveCurrentUser();
  document.getElementById("privValue").value = "";
  render();
}

export function render() {
  if (!ensureUser()) return;

  const search = document.getElementById("vaultSearch").value.trim().toLowerCase();

  // Notas ordenadas por fecha desc
  const notes = [...currentUser.data.notes].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  ).filter(n =>
    !search ||
    n.title.toLowerCase().includes(search) ||
    n.content.toLowerCase().includes(search)
  );

  const nList = document.getElementById("notesList");
  nList.innerHTML = "";
  notes.forEach(n => {
    const div = document.createElement("div");
    div.className = "list-item";
    const left = document.createElement("div");
    left.innerHTML = `<span class="list-label">${n.title}</span> ${n.content}`;
    const actions = document.createElement("div");
    actions.className = "list-actions";

    const btnDel = document.createElement("button");
    btnDel.textContent = "🗑";
    btnDel.onclick = () => {
      currentUser.data.notes = currentUser.data.notes.filter(x => x.id !== n.id);
      saveCurrentUser();
      render();
    };

    actions.appendChild(btnDel);
    div.appendChild(left);
    div.appendChild(actions);
    nList.appendChild(div);
  });

  // Cumpleaños ordenados por fecha
  const bdays = [...currentUser.data.birthdays].sort((a, b) =>
    (a.date || "").localeCompare(b.date || "")
  ).filter(b =>
    !search ||
    b.name.toLowerCase().includes(search) ||
    (b.date || "").includes(search)
  );

  const bList = document.getElementById("birthdaysList");
  bList.innerHTML = "";
  bdays.forEach(b => {
    const div = document.createElement("div");
    div.className = "list-item";
    const left = document.createElement("div");
    left.innerHTML = `<span class="list-label">${b.name}</span> ${b.date}`;
    const actions = document.createElement("div");
    actions.className = "list-actions";

    const btnDel = document.createElement("button");
    btnDel.textContent = "🗑";
    btnDel.onclick = () => {
      currentUser.data.birthdays = currentUser.data.birthdays.filter(x => x.id !== b.id);
      saveCurrentUser();
      render();
    };

    actions.appendChild(btnDel);
    div.appendChild(left);
    div.appendChild(actions);
    bList.appendChild(div);
  });

  // Privados
  const privs = [...currentUser.data.priv].filter(p =>
    !search ||
    p.label.toLowerCase().includes(search) ||
    p.type.toLowerCase().includes(search) ||
    p.value.toLowerCase().includes(search)
  );

  const pList = document.getElementById("privList");
  pList.innerHTML = "";
  privs.forEach(p => {
    const div = document.createElement("div");
    div.className = "list-item";
    const left = document.createElement("div");
    left.innerHTML = `<span class="list-label">${p.label}</span> (${p.type}) — ${p.value}`;
    const actions = document.createElement("div");
    actions.className = "list-actions";

    const btnDel = document.createElement("button");
    btnDel.textContent = "🗑";
    btnDel.onclick = () => {
      currentUser.data.priv = currentUser.data.priv.filter(x => x.id !== p.id);
      saveCurrentUser();
      render();
    };

    actions.appendChild(btnDel);
    div.appendChild(left);
    div.appendChild(actions);
    pList.appendChild(div);
  });

  // Study sources también se muestran en rag.js (allí se renderiza srcList)
}

/* Export / Import */

function exportVault() {
  if (!ensureUser()) return;
  const data = {
    notes: currentUser.data.notes,
    birthdays: currentUser.data.birthdays,
    priv: currentUser.data.priv,
    sources: currentUser.data.sources
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `friday_vault_${currentUser.data.name || currentUser.username}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importVault(event) {
  if (!ensureUser()) return;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.notes) currentUser.data.notes = data.notes;
      if (data.birthdays) currentUser.data.birthdays = data.birthdays;
      if (data.priv) currentUser.data.priv = data.priv;
      if (data.sources) currentUser.data.sources = data.sources;
      saveCurrentUser();
      render();
      document.getElementById("srcList").innerHTML = ""; // RAG re-render next time
    } catch {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}
