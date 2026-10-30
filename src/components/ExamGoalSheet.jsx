// Setting the exam the Stats screen counts down to: what it is called, its
// date, and which laws it covers. Saved in settings, so it follows the account.
import { useState } from 'react';
import BottomSheet from './BottomSheet';
import { CODE_BOOK_IDS } from '../data/lawMeta';
import { dayKey } from '../lib/listenTime';

export default function ExamGoalSheet({ exam, books, onSave, onClose }) {
  const [name, setName] = useState(exam?.name ?? '');
  const [date, setDate] = useState(exam?.date ?? '');
  const [bookIds, setBookIds] = useState(() => new Set(exam?.bookIds ?? CODE_BOOK_IDS));

  const toggle = (id) => setBookIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const ready = date && bookIds.size > 0;
  const save = () => {
    onSave({ name: name.trim() || 'วันสอบ', date, bookIds: [...bookIds] });
    onClose();
  };

  return (
    <BottomSheet height="78%" onClose={onClose}>
      {({ dragHandlers }) => (
        <>
          <div className="px-5 pt-1 pb-3 select-none flex-shrink-0" {...dragHandlers}>
            <div className="font-display text-[19px] font-bold">ตั้งวันสอบ</div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-3 font-ui">
            <label className="block text-[12px] font-semibold text-ink-soft dark:text-rule-soft mb-1" htmlFor="exam-name">ชื่อสนามสอบ</label>
            <input id="exam-name" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ผู้ช่วยผู้พิพากษา" className="st-input" />
            <label className="block text-[12px] font-semibold text-ink-soft dark:text-rule-soft mt-4 mb-1" htmlFor="exam-date">วันสอบ</label>
            <input id="exam-date" type="date" value={date} min={dayKey(new Date())} onChange={e => setDate(e.target.value)} className="st-input" />
            <div className="text-[12px] font-semibold text-ink-soft dark:text-rule-soft mt-4 mb-1.5">กฎหมายที่ต้องสอบ</div>
            <div className="flex flex-wrap gap-1.5">
              {books.map(b => (
                <button key={b.id} type="button" className="tap-btn st-chip" aria-pressed={bookIds.has(b.id)} onClick={() => toggle(b.id)}>
                  <i style={{ background: b.waveColor }} />{b.shortLabel}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 pt-2 pb-3 flex items-center gap-2 flex-shrink-0">
            <button onClick={save} disabled={!ready} className="tap-btn flex-1 h-12 rounded-full bg-accent text-paper font-ui text-[14px] font-bold disabled:opacity-40">
              บันทึก
            </button>
            {exam && (
              <button onClick={() => { onSave(null); onClose(); }} className="tap-btn h-12 px-4 font-ui text-[13px] font-semibold text-accent">
                ลบ
              </button>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
