const THAI_NUM_SUFFIX = '(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ|เอกาทศ|ทวาทศ)';

// OLD (buggy)
const OLD = new RegExp(`^มาตรา\\s+[\\d/]+(?:\\s*${THAI_NUM_SUFFIX})?\\s*`, 'i');
// NEW (fixed): require suffix to be standalone token
const NEW = new RegExp(`^มาตรา\\s+[\\d/]+(?:\\s*${THAI_NUM_SUFFIX}(?=\\s|$))?\\s*`, 'i');

const tests = [
  'มาตรา 342 ฉ้อโกงโดยแสดงตน',
  'มาตรา 4 ฉ เขตอำนาจศาล',
  'มาตรา 277ทวิ กระทำชำเรา',
  'มาตรา 283 ทวิ พาเยาวชน',
  'มาตรา 343 ฉ้อโกงประชาชน',
  'มาตรา 344 ฉ้อโกงแรงงาน',
  'มาตรา 348 ความผิดในหมวด',
];
for (const t of tests) {
  console.log(t);
  console.log('  OLD:', t.replace(OLD, ''));
  console.log('  NEW:', t.replace(NEW, ''));
}
