import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotesForSection, addNote, updateNote, deleteNote } from '../lib/notes';

// isPro: if false, existing notes are read-only and adding is locked (#2)
export default function NoteDrawer({ sectionId, visible, onClose, isPro = false }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible && sectionId) {
      setNotes(getNotesForSection(sectionId));
      setNewText('');
      setEditingId(null);
      if (isPro) setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible, sectionId, isPro]);

  if (!visible) return null;

  const handleAdd = () => {
    if (!isPro || !newText.trim()) return;
    const note = addNote(sectionId, newText.trim());
    setNotes(prev => [...prev, note]);
    setNewText('');
    inputRef.current?.focus();
  };

  const handleDelete = (noteId) => {
    if (!isPro) return;
    deleteNote(sectionId, noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleEditStart = (note) => {
    if (!isPro) return;
    setEditingId(note.id);
    setEditText(note.text);
  };

  const handleEditSave = () => {
    if (!isPro || !editText.trim() || !editingId) return;
    updateNote(sectionId, editingId, editText.trim());
    setNotes(prev => prev.map(n => n.id === editingId ? { ...n, text: editText.trim() } : n));
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0" style={{ zIndex: 30 }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute bottom-0 left-0 right-0 bg-paper dark:bg-dark-bg rounded-t-2xl max-h-[70vh] flex flex-col shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-rule-soft dark:bg-ink-soft" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-2 border-b border-rule dark:border-ink-soft">
          <div className="font-display text-[18px] font-medium text-ink dark:text-paper">
            บันทึก
          </div>
          <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">
            {notes.length} รายการ{!isPro && ' · Pro เท่านั้น'}
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {notes.length === 0 && (
            <div className="text-center py-6">
              <div className="font-serif text-[13px] italic text-ink-soft dark:text-rule-soft">
                {isPro ? 'ยังไม่มีบันทึกสำหรับมาตรานี้' : 'ยังไม่มีบันทึก'}
              </div>
            </div>
          )}

          {notes.map((note) => (
            <div
              key={note.id}
              className="py-2.5 border-b border-rule-soft/50 dark:border-ink-soft/50"
            >
              {isPro && editingId === note.id ? (
                <div className="flex gap-2">
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="flex-1 bg-card dark:bg-dark-card text-ink dark:text-paper font-serif text-[13px] rounded px-2.5 py-2 outline-none border border-rule-soft dark:border-ink-soft resize-none"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={handleEditSave} className="font-ui text-[10px] font-bold text-accent px-2 py-1">บันทึก</button>
                    <button onClick={() => setEditingId(null)} className="font-ui text-[10px] text-ink-soft dark:text-rule-soft px-2 py-1">ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 font-serif text-[13px] text-ink dark:text-paper leading-relaxed">
                    {note.text}
                  </div>
                  {isPro && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleEditStart(note)} className="text-ink-soft dark:text-rule-soft p-1" aria-label="แก้ไข">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(note.id)} className="text-ink-soft dark:text-rule-soft p-1 hover:text-accent" aria-label="ลบ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom bar — input (Pro) or upsell (free) */}
        {isPro ? (
          <div className="px-5 py-3 border-t border-rule dark:border-ink-soft flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="เพิ่มบันทึก…"
              className="flex-1 bg-card dark:bg-dark-card text-ink dark:text-paper font-serif text-[13px] rounded-lg px-3 py-2.5 outline-none border border-rule-soft dark:border-ink-soft placeholder:text-ink-soft/50"
            />
            <button
              onClick={handleAdd}
              disabled={!newText.trim()}
              className="font-ui text-[11px] font-bold uppercase tracking-wide px-3.5 py-2.5 bg-ink dark:bg-paper text-paper dark:text-ink rounded-lg disabled:opacity-30"
            >
              เพิ่ม
            </button>
          </div>
        ) : (
          <div className="px-5 py-3 border-t border-rule dark:border-ink-soft">
            <div className="bg-card dark:bg-dark-card rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-[13px] font-medium italic text-ink dark:text-paper">
                  จดบันทึก — ฟีเจอร์ Pro
                </div>
                <div className="font-serif text-[11px] italic text-ink-soft dark:text-rule-soft mt-0.5">
                  สมัครสมาชิกเพื่อจดบันทึกประกอบมาตรา
                </div>
              </div>
              <button
                onClick={() => { onClose(); navigate('/settings'); }}
                className="font-ui text-[11px] font-bold px-3 py-1.5 bg-accent text-paper rounded-lg flex-shrink-0"
              >
                ดู Pro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
