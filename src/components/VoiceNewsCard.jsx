import { useState } from 'react';
import { speakSampleSection } from '../lib/tts';
import { isAudioEnabled } from '../lib/audioManifest';
import { shouldShowVoiceNews, dismissVoiceNews } from '../lib/whatsNew';

// A sample rather than a paragraph of prose: the change is audible and cannot
// be described. One tap is the whole pitch.
// Criminal code section 59, first paragraph — the real rendered file, not a
// re-reading by the device voice. A card claiming the voice changed has to
// prove it with the thing itself.
const SAMPLE_SECTION_ID = 'cr-59';
const SAMPLE_PARA_INDEX = 0;
const SAMPLE_TEXT =
  'มาตรา 59 บุคคลจะต้องรับผิดในทางอาญาก็ต่อเมื่อได้กระทำโดยเจตนา ' +
  'เว้นแต่จะได้กระทำโดยประมาท ในกรณีที่กฎหมายบัญญัติให้ต้องรับผิดเมื่อได้กระทำโดยประมาท ' +
  'หรือเว้นแต่ในกรณีที่กฎหมายบัญญัติไว้โดยแจ้งชัดให้ต้องรับผิดแม้ได้กระทำโดยไม่มีเจตนา';

export default function VoiceNewsCard() {
  // Nothing changed while the feature is off. Announcing "เสียงอ่านเปลี่ยนใหม่แล้ว"
  // on a build whose voice is bit-for-bit the previous one is a lie, and the
  // ▶ sample would play the same device voice it always did. Worse, the
  // dismissal it invites is not version-scoped: whoever taps ปิด now could
  // never be told when the voice actually does change. Same rule as
  // AudioStorageRow — the whole surface stays dark until AUDIO_BASE_URL is set.
  const enabled = isAudioEnabled();
  const [show, setShow] = useState(() => enabled && shouldShowVoiceNews());
  if (!enabled || !show) return null;

  const close = () => { dismissVoiceNews(); setShow(false); };

  return (
    <div className="mx-5 mt-3 rounded-xl border border-rule dark:border-ink-soft bg-paper dark:bg-dark-bg p-3.5">
      <div className="font-display text-[15px] font-medium">เสียงอ่านเปลี่ยนใหม่แล้ว</div>
      <div className="font-ui text-[12px] opacity-75 mt-1 leading-relaxed">
        ทุกมาตราใช้เสียงอ่านคุณภาพสูงที่บันทึกไว้ล่วงหน้า
        ครั้งแรกที่ฟังแต่ละมาตราต้องมีเน็ต หลังจากนั้นฟังซ้ำได้แบบออฟไลน์
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => speakSampleSection(SAMPLE_SECTION_ID, SAMPLE_PARA_INDEX, SAMPLE_TEXT)}
          className="tap-btn flex-1 py-3.5 rounded-lg bg-ink dark:bg-paper text-paper dark:text-ink font-ui text-[13px]"
        >
          ▶ ฟังตัวอย่าง
        </button>
        <button onClick={close} className="tap-btn hit-44 px-4 py-2 font-ui text-[13px] opacity-60">
          ปิด
        </button>
      </div>
    </div>
  );
}
