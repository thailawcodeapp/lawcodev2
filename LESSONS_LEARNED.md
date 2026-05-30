# Lessons Learned — ประมวลกฎหมาย Pro (Law Code)
> React Native / Expo / EAS Build / Google Play Store
> บันทึกข้อผิดพลาดและวิธีแก้ไขสำหรับใช้ในโปรเจกต์ถัดไป

---

## 1. react-native-iap (In-App Purchase)

### ปัญหา: API เปลี่ยนใน v15 — ทำให้เกิด "Error: Unknown" และ "Undefined is not a function"

| v14 (เก่า) | v15 (ใหม่) |
|---|---|
| `getProducts([sku])` | `fetchProducts({ skus: [sku] })` |
| `requestPurchase({ sku })` | `requestPurchase({ request: { android: { skus: [sku] } } })` |

**วิธีแก้:**
```js
// โหลด product
const products = await fetchProducts({ skus: [IAP_PRODUCT_ID] });

// ซื้อ
await requestPurchase({ request: { android: { skus: [IAP_PRODUCT_ID] } } });
```

### ปัญหา: Clear Data แล้วยังเป็น Pro อยู่
- **สาเหตุ:** `getAvailablePurchases()` ดึงข้อมูลจาก Google server ทุกครั้งที่เปิดแอพ (ไม่ใช่แค่ local storage)
- **วิธีแก้สำหรับ dev:** เพิ่ม "Test Free Mode" toggle ใน settings เป็น session-only state

### ปัญหา: ราคาไม่แสดง (iapProduct = null)
- **สาเหตุ:** `getProducts` เป็น undefined (ใช้ API เก่า) → ไม่ถูกเรียก → ไม่ได้ข้อมูล product
- **วิธี debug:** เพิ่ม toast แสดง `[IAP] connected ✓` และ `[IAP] products: X` เพื่อดู lifecycle

---

## 2. Edge-to-Edge / Status Bar / Navigation Bar

### ปัญหา: เนื้อหาทะลุ Status Bar และ Navigation Bar
- **สาเหตุ:** `edgeToEdgeEnabled: true` ใน app.json โดยไม่มี SafeAreaProvider

**วิธีแก้ทั้งหมด:**
```json
// app.json
"edgeToEdgeEnabled": false
```
```js
// App.js
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar'; // แทน react-native StatusBar

// wrap return ด้วย
<SafeAreaProvider>
  <ThemeContext.Provider value={...}>
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {/* content */}
    </SafeAreaView>
  </ThemeContext.Provider>
</SafeAreaProvider>
```

**หมายเหตุ:** ใช้ `expo-status-bar` แทน `react-native` StatusBar เพื่อหลีกเลี่ยง deprecated API warnings

---

## 3. EAS Build & Google Play

### ปัญหา: versionCode ซ้ำ — upload ไม่ได้
- **กฎ:** versionCode ต้องเพิ่มขึ้นทุก upload ไม่ว่าจะ track ไหน (Internal / Closed / Production)
- **วิธีแก้:** track ใน app.json และเพิ่มทุกครั้งก่อน build

### ปัญหา: "This release does not add or remove any app bundles"
- **สาเหตุ:** พยายาม upload AAB ที่มี versionCode เดียวกับที่ upload ไปแล้ว
- **วิธีแก้:** ใช้ "Promote release" จาก Internal Testing แทนการ upload ใหม่

### ปัญหา: EAS build ใช้ image เก่า — 16KB page alignment warning
```json
// eas.json
"production": {
  "android": {
    "buildType": "app-bundle",
    "image": "latest"   // ← เพิ่มบรรทัดนี้
  }
}
```

### Closed Testing requirement (บัญชีหลัง Nov 13, 2023)
- ต้องมีผู้ทดสอบอย่างน้อย **12 คน** ยอมรับคำเชิญ
- ต้องผ่าน **14 วัน** จึงจะขอเข้า Production ได้
- ทำก่อนขึ้น Production เสมอ

---

## 4. AdMob

### ปัญหา: โฆษณาไม่แสดงเลย
- **สาเหตุหลัก:** บัญชี AdMob อยู่ในสถานะ "Requires review" — Google ยังไม่ approve
- **วิธีตรวจสอบ:** AdMob Console → Apps → ดู App status
- **วิธีแก้:** รอ Google approve (ต้องมี traffic จากผู้ใช้จริง)

### ปัญหา: Interstitial ไม่ขึ้นเลย
- **สาเหตุที่ 1:** `interstitialReady = false` เพราะ ad โหลดไม่สำเร็จ (account ไม่ approved)
- **สาเหตุที่ 2:** ต้องเปิดมาตรา **3 ครั้ง** ก่อนถึงจะโชว์ (INTERSTITIAL_EVERY = 3)
- **วิธี debug:** ดู console log จาก `AdEventType.LOADED` / `AdEventType.FAILED_TO_LOAD`

### Pattern AdBanner ที่ถูกต้อง
```
HomeScreen:    AdBanner ล่างสุด
BookScreen:    AdBanner บนสุด (เหนือ header)
SectionScreen: AdBanner บนสุด (เหนือ header), navBar ล่างสุดเสมอ
```

---

## 5. Dark / Light Theme

### วิธีทำ Theme Context
```js
// src/theme.js
export const ThemeContext = createContext(DARK_THEME);
export const useTheme = () => useContext(ThemeContext);

// ทุก screen ใช้:
const T = useTheme();
```

### ปัญหา: lightColor ไม่ทำงาน (วิอาญาไม่เปลี่ยนสีใน light mode)
- **สาเหตุ:** `loadBundledBooks()` ใน App.js ไม่ได้ copy `lightColor` จาก LAW_BOOKS_META
- **วิธีแก้:** เพิ่ม `lightColor: meta.lightColor` ใน object ที่ return จาก loadBundledBooks

```js
// App.js — loadBundledBooks
return {
  id:         meta.id,
  color:      meta.color,
  lightColor: meta.lightColor,  // ← ต้องใส่ด้วย!
  ...
};

// useMemo apply color
const displayBooks = useMemo(() =>
  lawData.books.map(book => ({
    ...book,
    color: (!isDarkMode && book.lightColor) ? book.lightColor : book.color,
  })),
[lawData.books, isDarkMode]);
```

---

## 6. Keyboard & ScrollView (Android)

### ปัญหา: Keyboard บัง TextInput (โดยเฉพาะ note section ที่อยู่ด้านล่าง)
- **สาเหตุ:** `KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — Android ไม่ทำอะไรเลย

**วิธีแก้:**
```js
// ใช้ behavior="padding" ทั้งสองแพลตฟอร์ม
<KeyboardAvoidingView behavior="padding">

// เพิ่ม ref และ auto-scroll
const scrollRef = useRef();
const scrollToNote = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);

<ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled">
<TextInput onFocus={scrollToNote} ... />
```

---

## 7. Navigation & Screen Transitions

### ปัญหา: ภาพกระพริบ/flash เมื่อเปลี่ยนมาตรา (Free mode)
- **สาเหตุ:** `key={activeSection.id}` บน SectionScreen ทำให้ remount ทุกครั้ง → AdBanner re-render → flash
- **วิธีแก้:** ลบ `key` prop ออก และรีเซ็ต state ด้วย useEffect แทน

```js
// ลบออก: <SectionScreen key={activeSection.id} ...>
// เพิ่มใน SectionScreen:
useEffect(() => {
  setNoteText(notes[section.id] || '');
}, [section.id]);
```

### ปัญหา: navBar ลอยสูงใน Free mode
- **สาเหตุ:** AdBanner อยู่ใต้ navBar → navBar ถูกดันขึ้น
- **วิธีแก้:** ย้าย AdBanner ขึ้นไปอยู่บนสุด → navBar อยู่ล่างสุดเสมอ

### ปัญหา: BackHandler — กด back แล้วปิดแอพทันทีแทนที่จะ navigate กลับ
- **กฎ:** ต้อง register BackHandler ใน **ทุก screen** ที่มี sub-navigation (tabs, etc.)
- **App.js level:** จัดการ screenStack navigation
- **HomeScreen level:** จัดการ tab navigation (browse / bookmarks / history)

```js
useEffect(() => {
  const onBack = () => {
    if (tab !== 'browse') { setTab('browse'); return true; }
    return false;
  };
  const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
  return () => sub.remove();
}, [tab]);
```

---

## 8. App Icon

### ปัญหา: Icon render ไม่ตรงแบบ — font ผิด, text หายไป
- **สาเหตุ:** Generate PNG จาก SVG โดยไม่มี font Sarabun ติดตั้งในระบบ → ใช้ system fallback font
- **วิธีแก้:** ใช้ `generate_icon.html` เปิดใน Chrome (โหลด Sarabun จาก Google Fonts) แล้ว Download PNG
- **ขั้นตอน:**
  1. เปิด `generate_icon.html` ใน Chrome (ต้องมี internet)
  2. รอ 2–3 วินาที ให้ font โหลด
  3. กด **Redraw** → ดูว่า ก และ กฎหมาย แสดงถูกต้อง
  4. กด **Download icon.png**
  5. Copy ไปแทน `assets/icon.png`
  6. Build ใหม่

---

## 9. Play Store Setup (ขั้นตอนสำคัญ)

### ลำดับที่ถูกต้องก่อนขึ้น Production
1. Internal Testing — upload AAB ทดสอบ functionality
2. Closed Testing — ต้องทำถ้าบัญชีหลัง Nov 13, 2023
3. รอ 12 testers + 14 วัน
4. Content Rating → Data Safety → Privacy Policy
5. Apply for Production access

### Advertising ID
- ถ้าใช้ AdMob → ต้องตอบ **Yes** ใช้ Advertising ID
- เลือก: **In-app advertising** เท่านั้น (ไม่ต้องติ้ก External marketing)

### Privacy Policy
- ต้องมี URL ที่ใช้งานได้จริง
- สร้างฟรีได้ที่ privacypolicygenerator.info หรือ app-privacy-policy-generator.firebaseapp.com

---

## 10. Android Compatibility

### Android 15+ (Edge-to-Edge enforcement)
- ปิด `edgeToEdgeEnabled` ใน app.json + ใช้ SafeAreaProvider แก้ได้

### Android 17 (Beta) — ผลกระทบต่อแอพนี้
- **Resizability บน tablet:** portrait lock อาจถูก override → impact ต่ำ (supportsTablet: false)
- **Certificate Transparency:** ไม่กระทบ (ใช้แค่ Google APIs)
- **อื่นๆ:** ไม่กระทบ

---

## 11. React Native Patterns ที่ควรจำ

### loadBundledBooks — ต้อง copy ทุก field
```js
// ผิด — ลืม field ใหม่
return { id, shortName, color, ... };

// ถูก — ใช้ spread แล้วค่อย override
return { ...meta, sections: [...], totalSections: ... };
```

### useMemo dependency
```js
// ถ้า dependency ไม่ครบ → stale data
const displayBooks = useMemo(() => ..., [lawData.books, isDarkMode]); // ← ครบทั้งคู่
```

### FlatList getItemLayout
- ต้องกำหนด `ITEM_HEIGHTS` ให้ตรงกับ style จริงทุกครั้งที่เปลี่ยน layout
- ถ้าผิด → scroll to index จะพาไปผิดตำแหน่ง

---

*อัพเดทล่าสุด: ver 10*
