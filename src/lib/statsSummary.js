// What the Stats screen says, worked out from what is stored: which sections
// have been heard, and which are marked จำได้ or จำไม่ได้.

// { total, heard, remembered, forgotten, unrated } for one law. A marked
// section counts as heard even if a sync lost its listening record.
export function bookProgress(book, heardIds, memory) {
  const p = { total: book.sections?.length || 0, heard: 0, remembered: 0, forgotten: 0, unrated: 0 };
  for (const s of book.sections || []) {
    const mem = memory[s.id];
    if (!heardIds.has(s.id) && !mem) continue;
    p.heard++;
    if (mem === 'remembered') p.remembered++;
    else if (mem === 'forgotten') p.forgotten++;
    else p.unrated++;
  }
  return p;
}

export function sumProgress(list) {
  const sum = { total: 0, heard: 0, remembered: 0, forgotten: 0, unrated: 0 };
  for (const p of list) for (const k of Object.keys(sum)) sum[k] += p[k];
  return sum;
}

export const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// Whole days from today to a 'YYYY-MM-DD' date, by the calendar: the time of
// day must not change the count.
export function daysUntil(date, today = new Date()) {
  const [y, m, d] = date.split('-').map(Number);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86400000);
}

// The countdown: days left, sections of the chosen laws not heard yet, and how
// many a day clears them by the exam. perDay is 0 once the exam day has come.
export function examPlan(exam, books, heardIds, memory, today = new Date()) {
  const chosen = books.filter(b => exam.bookIds.includes(b.id));
  const sum = sumProgress(chosen.map(b => bookProgress(b, heardIds, memory)));
  const left = sum.total - sum.heard;
  const days = daysUntil(exam.date, today);
  return { days, left, books: chosen.length, perDay: days > 0 ? Math.ceil(left / days) : 0 };
}
