// What to tell the user when a Pro-gated action is blocked, and why.
//
// Three distinct reasons can block the same tap, and each needs different
// copy: a free user needs to be sold on Pro; a subscriber who has not
// signed in already paid and must never be told to buy again; a subscriber
// over the device cap needs to manage devices, not sign in somewhere else.
// Kept as a pure function (no JSX, no React) so the decision is testable on
// its own and every call site renders whichever component the `kind` calls
// for.

const BUY_COPY = {
  folder: {
    title: 'สร้างโฟลเดอร์ — ฟีเจอร์ Pro',
    body: 'สมาชิก Pro สร้างโฟลเดอร์จัดหมวดมาตราได้ไม่จำกัด',
  },
  highlight: {
    title: 'ไฮไลท์ตัวบท — ฟีเจอร์ Pro',
    body: 'สมาชิก Pro ระบายสีเน้นข้อความในตัวบทได้ และไฮไลท์จะถูกบันทึกไว้',
  },
  bookmark: {
    title: 'บุ๊กมาร์ก — ฟีเจอร์ Pro',
    body: 'สมาชิก Pro บันทึกมาตราที่สนใจไว้ในคลังส่วนตัว เข้าถึงได้ทุกเมื่อ',
  },
  listen: {
    title: 'โควต้าการฟังหมดแล้ววันนี้',
    body: 'สมัคร Pro เพื่อฟังไม่จำกัด หรือดูโฆษณาเพื่อรับโควต้าเพิ่ม',
  },
};

const SIGNIN_COPY = {
  title: 'เข้าสู่ระบบเพื่อใช้งาน Pro',
  body: 'บัญชีนี้มีสิทธิ์ใช้งาน Pro อยู่แล้ว — เข้าสู่ระบบเพื่อเปิดใช้งานฟีเจอร์ Pro บนเครื่องนี้',
};

const DEVICE_SLOT_COPY = {
  title: 'ใช้งานครบจำนวนอุปกรณ์แล้ว',
  body: 'บัญชีนี้ใช้ Pro ได้สูงสุด 3 อุปกรณ์ — จัดการอุปกรณ์ในหน้าตั้งค่าเพื่อเปิดใช้บนเครื่องนี้',
};

export function gateContentFor(state, feature) {
  if (state === 'free') return { kind: 'buy', ...BUY_COPY[feature] };
  if (state === 'needs-signin') return { kind: 'signin', ...SIGNIN_COPY };
  if (state === 'needs-device-slot') return { kind: 'device-slot', ...DEVICE_SLOT_COPY };
  return null; // 'pro' and 'loading' — nothing is blocked
}
