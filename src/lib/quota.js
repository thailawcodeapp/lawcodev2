// Daily listening quota for free users (#11)
//   • 30 sections / day for free
//   • watch a rewarded ad → +30 banked credits
//   • banked credits carry over between days ("ดูสะสมล่วงหน้า")
// Pro users bypass quota entirely (checked by the caller).

const STORAGE_KEY = 'lawcode-th-quota';
export const DAILY_FREE = 30;
export const REWARD_AMOUNT = 30;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function read() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return { date: s.date || todayStr(), used: s.used || 0, bonus: s.bonus || 0 };
  } catch {
    return { date: todayStr(), used: 0, bonus: 0 };
  }
}

function save(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// Roll the day over: reset daily free use, deducting any banked credits that
// were spent beyond the free allowance from the carried-over bonus.
function rolled() {
  const s = read();
  const today = todayStr();
  if (s.date !== today) {
    const usedBonus = Math.max(0, s.used - DAILY_FREE);
    s.bonus = Math.max(0, s.bonus - usedBonus);
    s.used = 0;
    s.date = today;
    save(s);
  }
  return s;
}

export function getRemaining() {
  const s = rolled();
  return Math.max(0, DAILY_FREE + s.bonus - s.used);
}

export function getBonus() {
  return rolled().bonus;
}

export function getUsedToday() {
  return rolled().used;
}

// Try to consume one section of quota. Returns true if allowed.
export function consume() {
  const s = rolled();
  if (DAILY_FREE + s.bonus - s.used <= 0) return false;
  s.used += 1;
  save(s);
  return true;
}

// Add banked credits (after a rewarded ad).
export function addReward(amount = REWARD_AMOUNT) {
  const s = rolled();
  s.bonus += amount;
  save(s);
  return getRemaining();
}
