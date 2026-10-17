export const LAW_BOOKS_META = [
  {
    id: 'civil',
    shortName: 'แพ่งและพาณิชย์',
    abbr: 'พ.พ.',
    fullName: 'ประมวลกฎหมายแพ่งและพาณิชย์',
    subtitle: 'พ.ศ. 2468',
    blurb: 'หนี้ สัญญา ทรัพย์สิน ครอบครัว และมรดก ตามกฎหมายแพ่งไทย',
    color: '#1e5fa8',
    totalSections: 1871,
    available: true,
    dataFile: '/data/civil-th.json',
  },
  {
    id: 'criminal',
    shortName: 'อาญา',
    abbr: 'อ.',
    fullName: 'ประมวลกฎหมายอาญา',
    subtitle: 'พ.ศ. 2499',
    blurb: 'ความผิด ความรับผิด โทษ และหลักทั่วไปของกฎหมายอาญาไทย',
    color: '#a93225',
    totalSections: 448,
    available: true,
    dataFile: '/data/criminal-th.json',
  },
  {
    id: 'civil_proc',
    shortName: 'วิธีพิจารณาความแพ่ง',
    abbr: 'วิ.แพ่ง',
    fullName: 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง',
    subtitle: 'พ.ศ. 2477',
    blurb: 'หลักเกณฑ์การดำเนินคดีแพ่ง การสืบพยาน คำพิพากษา และการบังคับคดี',
    color: '#2a7a4e',
    totalSections: 468,
    available: true,
    dataFile: '/data/civil-proc-th.json',
  },
  {
    id: 'criminal_proc',
    shortName: 'วิธีพิจารณาความอาญา',
    abbr: 'วิ.อาญา',
    fullName: 'ประมวลกฎหมายวิธีพิจารณาความอาญา',
    subtitle: 'พ.ศ. 2477',
    blurb: 'หลักเกณฑ์การจับกุม การฟ้องร้อง การพิจารณาคดี และการอุทธรณ์ในคดีอาญา',
    color: '#6b3fa0',
    totalSections: 323,
    available: true,
    dataFile: '/data/criminal-proc-th.json',
  },
  // After the four codes: the Constitution, then พระธรรมนูญศาล, then the
  // acts in Thai alphabetical order of their full names. This order is the
  // one Home, the book picker, search chips and folders all follow.
  {
    id: 'constitution',
    shortName: 'รัฐธรรมนูญ',
    displayName: 'รัฐธรรมนูญแห่งราชอาณาจักรไทย',
    abbr: 'รธน.',
    fullName: 'รัฐธรรมนูญแห่งราชอาณาจักรไทย',
    subtitle: 'พ.ศ. 2560',
    blurb: 'พระมหากษัตริย์ สิทธิและเสรีภาพ รัฐสภา คณะรัฐมนตรี ศาล และองค์กรอิสระ',
    totalSections: 279,
    available: true,
    dataFile: '/data/constitution-th.json',
  },
  {
    id: 'court_org',
    shortName: 'พระธรรมนูญศาล',
    // Home and the book's own page spell the whole name; everywhere shorter
    // space is wanted (search chips, folders, stats) keeps shortName.
    displayName: 'พระธรรมนูญศาลยุติธรรม',
    abbr: 'ธรรมนูญศาล',
    fullName: 'พระธรรมนูญศาลยุติธรรม',
    subtitle: 'พ.ศ. 2543',
    blurb: 'ชั้นของศาล เขตอำนาจ องค์คณะผู้พิพากษา และการจ่ายสำนวนคดี',
    totalSections: 34,
    available: true,
    dataFile: '/data/court-org-th.json',
  },
  // These five, and the Constitution above, come from scripts/import-acts.mjs.
  // Their section titles are
  // the opening words of each section (`excerpt: true` in the data), not
  // written headings: the source has none.
  {
    id: 'labour_protection',
    shortName: 'คุ้มครองแรงงาน',
    displayName: 'พ.ร.บ.คุ้มครองแรงงาน',
    abbr: 'แรงงาน',
    fullName: 'พระราชบัญญัติคุ้มครองแรงงาน',
    subtitle: 'พ.ศ. 2541',
    blurb: 'การใช้แรงงาน ค่าจ้าง สวัสดิการ ค่าชดเชย และพนักงานตรวจแรงงาน',
    totalSections: 177,
    available: true,
    dataFile: '/data/labour-protection-th.json',
  },
  {
    id: 'district_court',
    shortName: 'ศาลแขวง',
    displayName: 'พ.ร.บ.จัดตั้งศาลแขวงและวิธีพิจารณาความอาญาในศาลแขวง',
    abbr: 'ศาลแขวง',
    fullName: 'พระราชบัญญัติจัดตั้งศาลแขวงและวิธีพิจารณาความอาญาในศาลแขวง',
    subtitle: 'พ.ศ. 2499',
    blurb: 'การจัดตั้งศาลแขวง และวิธีพิจารณาคดีอาญาในศาลแขวง',
    totalSections: 16,
    available: true,
    dataFile: '/data/district-court-th.json',
  },
  {
    id: 'admin_court',
    shortName: 'ศาลปกครอง',
    displayName: 'พ.ร.บ.จัดตั้งศาลปกครองและวิธีพิจารณาคดีปกครอง',
    abbr: 'ศาลปกครอง',
    fullName: 'พระราชบัญญัติจัดตั้งศาลปกครองและวิธีพิจารณาคดีปกครอง',
    subtitle: 'พ.ศ. 2542',
    blurb: 'เขตอำนาจศาลปกครอง ตุลาการ และวิธีพิจารณาคดีปกครอง',
    totalSections: 158,
    available: true,
    dataFile: '/data/admin-court-th.json',
  },
  {
    id: 'consumer_proc',
    shortName: 'วิธีพิจารณาคดีผู้บริโภค',
    displayName: 'พ.ร.บ.วิธีพิจารณาคดีผู้บริโภค',
    abbr: 'ผู้บริโภค',
    fullName: 'พระราชบัญญัติวิธีพิจารณาคดีผู้บริโภค',
    subtitle: 'พ.ศ. 2551',
    blurb: 'การฟ้อง การพิจารณา อุทธรณ์ และการบังคับคดีในคดีผู้บริโภค',
    totalSections: 63,
    available: true,
    dataFile: '/data/consumer-proc-th.json',
  },
  {
    id: 'juvenile_court',
    shortName: 'ศาลเยาวชนและครอบครัว',
    displayName: 'พ.ร.บ.ศาลเยาวชนและครอบครัวและวิธีพิจารณาคดีเยาวชนและครอบครัว',
    abbr: 'เยาวชนฯ',
    fullName: 'พระราชบัญญัติศาลเยาวชนและครอบครัวและวิธีพิจารณาคดีเยาวชนและครอบครัว',
    subtitle: 'พ.ศ. 2553',
    blurb: 'ศาลเยาวชนและครอบครัว คดีอาญาที่เด็กหรือเยาวชนต้องหา และคดีครอบครัว',
    totalSections: 209,
    available: true,
    dataFile: '/data/juvenile-court-th.json',
  },
];

// The four codes are listed apart from the acts on Home and in the book
// picker; everything not named here is an act.
export const CODE_BOOK_IDS = ['civil', 'criminal', 'civil_proc', 'criminal_proc'];

// TOC structure for Criminal Code (Penal Code)
export const CRIMINAL_TOC = [
  {
    number: 'I',
    name: 'General Provisions',
    range: '1–106',
    sectionStart: 1,
    titles: [
      {
        name: 'Criminal Law and Its Application',
        range: '1–17',
        sectionStart: 1,
        chapters: [
          { name: 'Definitions and Jurisdiction', range: '1–11', sectionStart: 1 },
          { name: 'Principals and Accessories', range: '12–17', sectionStart: 12 },
        ],
      },
      {
        name: 'Penalties',
        range: '18–58',
        sectionStart: 18,
        chapters: [
          { name: 'Types of Penalty', range: '18–37', sectionStart: 18 },
          { name: 'Suspension, Probation, and Pardon', range: '38–58', sectionStart: 38 },
        ],
      },
      {
        name: 'Liability for Criminal Acts',
        range: '59–106',
        sectionStart: 59,
        chapters: [
          { name: 'Intent, Negligence, and Attempt', range: '59–80', sectionStart: 59 },
          { name: 'Defences', range: '59–80', sectionStart: 68 },
          { name: 'Concurrence and Recidivism', range: '91–106', sectionStart: 91 },
        ],
      },
    ],
  },
  {
    number: 'II',
    name: 'Specific Offences',
    range: '107–366',
    sectionStart: 107,
    titles: [
      {
        name: 'Security of the Kingdom',
        range: '107–135/4',
        sectionStart: 107,
        chapters: [
          { name: 'Internal Security', range: '107–118', sectionStart: 107 },
          { name: 'External Security', range: '119–129', sectionStart: 119 },
          { name: 'Terrorism', range: '135/1–135/4', sectionStart: 135 },
        ],
      },
      {
        name: 'Official Functions',
        range: '136–166',
        sectionStart: 136,
        chapters: [
          { name: 'Malfeasance in Office', range: '147–166', sectionStart: 147 },
        ],
      },
      {
        name: 'Administration of Justice',
        range: '167–205',
        sectionStart: 167,
        chapters: [
          { name: 'Perjury and False Evidence', range: '177–184', sectionStart: 177 },
          { name: 'Escape and Prison Offences', range: '190–205', sectionStart: 190 },
        ],
      },
      {
        name: 'Causing Public Danger',
        range: '217–239',
        sectionStart: 217,
        chapters: [
          { name: 'Arson and Explosion', range: '217–224', sectionStart: 217 },
          { name: 'Traffic and Hazardous Materials', range: '225–239', sectionStart: 225 },
        ],
      },
      {
        name: 'Forgery and Counterfeiting',
        range: '240–269/15',
        sectionStart: 240,
        chapters: [
          { name: 'Currency', range: '240–249', sectionStart: 240 },
          { name: 'Documents and Seals', range: '264–269', sectionStart: 264 },
          { name: 'Electronic Cards and Passports', range: '269/1–269/15', sectionStart: 269 },
        ],
      },
      {
        name: 'Sexual Offences',
        range: '276–287/2',
        sectionStart: 276,
        chapters: [
          { name: 'Rape and Indecent Acts', range: '276–284', sectionStart: 276 },
        ],
      },
      {
        name: 'Offences Against Life',
        range: '288–295',
        sectionStart: 288,
        chapters: [
          { name: 'Murder and Homicide', range: '288–295', sectionStart: 288 },
        ],
      },
      {
        name: 'Offences Against the Body',
        range: '295–300',
        sectionStart: 295,
        chapters: [
          { name: 'Assault and Grievous Bodily Harm', range: '295–300', sectionStart: 295 },
        ],
      },
      {
        name: 'Liberty and Reputation',
        range: '309–333',
        sectionStart: 309,
        chapters: [
          { name: 'Unlawful Detention and Abduction', range: '309–320', sectionStart: 309 },
          { name: 'Defamation', range: '326–333', sectionStart: 326 },
        ],
      },
      {
        name: 'Offences Against Property',
        range: '334–366',
        sectionStart: 334,
        chapters: [
          { name: 'Theft and Robbery', range: '334–340', sectionStart: 334 },
          { name: 'Fraud and Extortion', range: '341–350', sectionStart: 341 },
          { name: 'Misappropriation and Receiving', range: '352–357', sectionStart: 352 },
          { name: 'Damage to Property', range: '358–366', sectionStart: 358 },
        ],
      },
    ],
  },
  {
    number: 'III',
    name: 'Petty Offences',
    range: '367–447',
    sectionStart: 367,
    titles: [
      {
        name: 'Miscellaneous Petty Offences',
        range: '367–447',
        sectionStart: 367,
        chapters: [
          { name: 'Public Order and Safety', range: '367–398', sectionStart: 367 },
          { name: 'Property and Commerce', range: '399–447', sectionStart: 399 },
        ],
      },
    ],
  },
];

// Map book IDs to their TOC structures
export const BOOK_TOC = {
  criminal: CRIMINAL_TOC,
};

export function searchSections(books, query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const numMatch = q.match(/^(\d+(?:\/\d+)?)$/);
  const results = [];

  for (const book of books) {
    if (!book.sections) continue;
    for (const section of book.sections) {
      // Coerce to string — source JSON mixes numeric and "29/1" string numbers.
      const num = String(section.number);
      if (numMatch) {
        const base = numMatch[1];
        if (num === base) {
          results.push({ section, book, score: 100 });
        } else if (!base.includes('/')) {
          if (num.startsWith(base + '/')) {
            results.push({ section, book, score: 90 });
          }
          else if (num.startsWith(base + ' ')) {
            results.push({ section, book, score: 85 });
          }
        }
      } else {
        const titleLower = String(section.title || '').toLowerCase();
        const textLower = String(section.text || '').toLowerCase();
        if (titleLower.includes(q)) {
          results.push({ section, book, score: 80 });
        } else if (textLower.includes(q)) {
          results.push({ section, book, score: 50 });
        }
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 60);
}

export function extractSectionRefs(text) {
  const refs = new Set();
  const re = /มาตรา\s+(\d+(?:\/\d+)?)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    refs.add(m[1]);
    const afterIdx = m.index + m[0].length;
    const tail = text.slice(afterIdx, afterIdx + 40);
    const extras = tail.match(/^(?:[,\s]+(?:และ\s+)?(\d+(?:\/\d+)?))+/);
    if (extras) {
      const nums = extras[0].match(/\d+(?:\/\d+)?/g) || [];
      nums.forEach(n => refs.add(n));
    }
  }
  return [...refs].slice(0, 8);
}

// Get a readable snippet around a query match
export function getSnippet(text, query, len = 160) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, len) + (text.length > len ? '…' : '');
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + query.length + 100);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}
