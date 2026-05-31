// Daily listening quota for free users.
//   • 10 sections / day base quota
//   • watch a rewarded ad → +10 banked credits (carries across days)
// Rollover policy (v2 — #5):
//   • If the user finishes the day with < 10 remaining, top up to 10.
//   • If the user already has ≥ 10 (banked from rewards), do NOT top up.
// Pro users bypass quota entirely (checked by the caller).
//
// Storage shape: { date: 'YYYY-M-D', balance: number }
// balance = total sections the user can still listen to (daily + banked combined).

const STORAGE_KEY = 'lawcode-th-quota';
export const DAILY_FREE = 10;
export const REWARD_AMOUNT = 10;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    // Migrate v1 shape ({used,bonus,date}) → v2 ({balance,date}).
    if (raw.balance == null && (raw.used != null || raw.bonus != null)) {
      const oldFree = 30; // v1 daily allowance
      const oldRemaining = Math.max(0, oldFree + (raw.bonus || 0) - (raw.used || 0));
      return { date: raw.date || todayStr(), balance: oldRemaining };
    }
    return { date: raw.date || todayStr(), balance: raw.balance ?? DAILY_FREE };
  } catch {
    return { date: todayStr(), balance: DAILY_FREE };
  }
}

function save(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// On day-change: top up to DAILY_FREE only if below it (keep banked surplus).
function rolled() {
  const s = read();
  const today = todayStr();
  if (s.date !== today) {
    if (s.balance < DAILY_FREE) s.balance = DAILY_FREE;
    s.date = today;
    save(s);
  }
  return s;
}

export function getRemaining() {
  return Math.max(0, rolled().balance);
}

// "Banked" = anything above the daily allowance. Used for the UI hint.
export function getBonus() {
  return Math.max(0, rolled().balance - DAILY_FREE);
}

export function getUsedToday() {
  // Best-effort indicator — not strictly tracked any more.
  return Math.max(0, DAILY_FREE - rolled().balance);
}

// Try to consume one section of quota. Returns true if allowed.
export function consume() {
  const s = rolled();
  if (s.balance <= 0) return false;
  s.balance -= 1;
  save(s);
  return true;
}

// Add banked credits (after a rewarded ad).
export function addReward(amount = REWARD_AMOUNT) {
  const s = rolled();
  s.balance += amount;
  save(s);
  return s.balance;
}
