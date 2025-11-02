// ---------- DOM helpers ----------
const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const themeToggleBtn = document.getElementById("themeToggle");
const resetBtn = document.getElementById("resetBtn");
const toastEl = document.getElementById("toast");

// 6 tries, 5 letters
const ROWS = 6, COLS = 5;

let currentRow = 0;
let currentCol = 0;
let locked = false; // lock after win/lose

// Track best status per key so far (wrong < misplaced < correct)
const keyBestStatus = {}; // { 'A': 'wrong'|'misplaced'|'correct' }

const statusRank = { wrong: 0, misplaced: 1, correct: 2 };

function showToast(msg, ms = 1200) {
  toastEl.textContent = msg;
  toastEl.style.opacity = "1";
  setTimeout(() => { toastEl.style.opacity = "0"; }, ms);
}

// ---------- Build board ----------
function createBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement("div");
    row.className = "board-row";
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = r;
      tile.dataset.col = c;
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

// ---------- Build keyboard ----------
const KEY_ROWS = [
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  ["ENTER", ..."ZXCVBNM".split(""), "⌫"]
];

function createKeyboard() {
  keyboardEl.innerHTML = "";
  KEY_ROWS.forEach(keys => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";
    keys.forEach(k => {
      const btn = document.createElement("button");
      btn.className = "key";
      if (k === "ENTER" || k === "⌫") btn.classList.add("wide");
      btn.textContent = k;
      btn.id = `key-${k.length === 1 ? k : k.toLowerCase()}`;
      btn.addEventListener("click", () => handleKey(k));
      rowEl.appendChild(btn);
    });
    keyboardEl.appendChild(rowEl);
  });
}

function updateKeyBest(letter, status) {
  const prev = keyBestStatus[letter];
  if (!prev || statusRank[status] > statusRank[prev]) {
    keyBestStatus[letter] = status;
    const btn = document.getElementById(`key-${letter}`);
    if (btn) {
      btn.classList.remove("wrong", "misplaced", "correct");
      btn.classList.add(status);
    }
  }
}

// ---------- Input handling ----------
function handleKey(k) {
  if (locked) return;

  if (k === "ENTER") {
    submitCurrentRow();
    return;
  }
  if (k === "⌫") {
    if (currentCol > 0) {
      currentCol--;
      tileAt(currentRow, currentCol).textContent = "";
    }
    return;
  }
  if (/^[A-Z]$/.test(k) && currentCol < COLS) {
    tileAt(currentRow, currentCol).textContent = k;
    currentCol++;
  }
}

function tileAt(r, c) {
  return boardEl.children[r].children[c];
}

async function submitCurrentRow() {
  if (currentCol < COLS) {
    showToast("Not enough letters");
    return;
  }

  // Collect guess text
  let guess = "";
  for (let c = 0; c < COLS; c++) {
    guess += tileAt(currentRow, c).textContent;
  }

  // send to server
  const res = await fetch("/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guess })
  });
  const data = await res.json();

  if (!res.ok) {
    showToast(data.error || "Invalid guess");
    return;
  }

  // Paint the row tiles & update keyboard with priority coloring
  data.feedback.forEach((status, i) => {
    const letter = guess[i];
    const tile = tileAt(currentRow, i);
    tile.classList.add(status);
    updateKeyBest(letter, status);
  });

  if (data.win) {
    locked = true;
    showToast("You win! 🎉", 1500);
    return;
  }
  if (data.lose) {
    locked = true;
    showToast(`Word was: ${data.target}`, 1800);
    return;
  }

  // Advance to next row
  currentRow++;
  currentCol = 0;
}

// Real keyboard support
document.addEventListener("keydown", (e) => {
  if (locked) return;
  const key = e.key;
  if (key === "Enter") handleKey("ENTER");
  else if (key === "Backspace") handleKey("⌫");
  else if (/^[a-zA-Z]$/.test(key)) handleKey(key.toUpperCase());
});

// ---------- Theme ----------
function applySavedTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.classList.toggle("light", saved === "light");
  themeToggleBtn.textContent = saved === "light" ? "☀️" : "🌙";
}
themeToggleBtn.addEventListener("click", () => {
  const light = !document.documentElement.classList.contains("light");
  document.documentElement.classList.toggle("light", light);
  localStorage.setItem("theme", light ? "light" : "dark");
  themeToggleBtn.textContent = light ? "☀️" : "🌙";
});

// ---------- Reset ----------
resetBtn.addEventListener("click", async () => {
  await fetch("/reset", { method: "POST" });
  boot();
});

// ---------- Restore state on load ----------
async function restoreState() {
  const res = await fetch("/state");
  const data = await res.json();

  // fill previous guesses (if any)
  (data.guesses || []).forEach((g, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = g.word[c];
      const status = g.feedback[c];
      const tile = tileAt(r, c);
      tile.textContent = ch;
      tile.classList.add(status);
      updateKeyBest(ch, status);
    }
    currentRow = r + 1;
    currentCol = 0;
  });

  if (data.win || data.lose) {
    locked = true;
    if (data.win) showToast("You win! 🎉", 1500);
    if (data.lose) showToast(`Word was: ${data.target}`, 1800);
  }
}

function boot() {
  // reset local UI state
  currentRow = 0;
  currentCol = 0;
  locked = false;
  Object.keys(keyBestStatus).forEach(k => delete keyBestStatus[k]);

  createBoard();
  createKeyboard();
  applySavedTheme();
  restoreState();
}

window.addEventListener("load", boot);
