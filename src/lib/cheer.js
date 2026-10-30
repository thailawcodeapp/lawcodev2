// The line above the brand on Wave Home: a word of encouragement for the exam.
// One for the morning and one for the evening, the same all through that part
// of the day (the hero redraws on every spoken chunk), a different one the next.

const MORNING = [
  'เช้านี้ฟังอีกสักมาตรา วันสอบจะขอบคุณตัวเอง',
  'เริ่มวันด้วยตัวบท สนามสอบรออยู่ไม่ไกล',
  'วันนี้ทีละมาตรา ไม่นานก็ครบทั้งเล่ม',
  'ความพยายามเช้านี้ คือคะแนนในวันสอบ',
  'ตั้งใจอีกวัน ชื่อในประกาศผลรออยู่',
  'ไม่มีเวลาอ่าน ฟังระหว่างทางก็ได้',
  'เก่งขึ้นทีละมาตรา เริ่มอีกครั้งตอนนี้',
  'อ่านไม่ไหว พักสายตามาฟังแทน',
  'สมองสดใสที่สุดตอนเช้า ทบทวนตอนนี้เลย',
  'ทุกมาตราที่จำได้ คือแต้มต่อในห้องสอบ',
  'ทุกนาทีคือคะแนนสอบ',
  'สู้อีกนิด วันที่เห็นชื่อตัวเองใกล้เข้ามา',
];

const EVENING = [
  'เหนื่อยแล้วก็พัก แต่ขออีกหนึ่งมาตราก่อนนอน',
  'วันนี้ทำได้ดีแล้ว อีกนิดเดียวก็ครบเป้า',
  'ฟังทบทวนก่อนนอน จำได้แม่นกว่าเดิม',
  'ทุกคืนที่ไม่ยอมแพ้ พาคุณใกล้วันสอบผ่าน',
  'พรุ่งนี้จะง่ายขึ้น เพราะคืนนี้คุณไม่หยุด',
  'ค่ำนี้ทบทวนสักหมวด แล้วนอนให้เต็มอิ่ม',
  'เก็บอีกมาตรา ปิดวันนี้อย่างภูมิใจ',
  'คนที่สอบได้ ก็เคยเหนื่อยแบบนี้เหมือนกัน',
  'วันนี้ไม่เสียเปล่า สิ่งที่ฟังไว้อยู่กับคุณแล้ว',
  'เหนื่อยวันนี้ เพื่อยิ้มวันประกาศผล',
  'เวลาที่คนอื่นปล่อยผ่าน คือเวลาที่เราใช้ทบทวน',
  'ความรู้สะสมทุกคืน วันสอบจะเห็นผลเอง',
];

// Stepping by 5 through a list of 12 reaches every line before any comes back,
// in an order that does not read as the list's own.
const STEP = 5;

export function cheer(now = new Date()) {
  const pool = now.getHours() < 12 ? MORNING : EVENING;
  const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  return pool[(day * STEP) % pool.length];
}

export const CHEERS = { MORNING, EVENING };
