// Stats, for both themes: how much is remembered, the exam countdown, time
// listened, then each law as a card that opens its sections
// (StatsBookScreen). Colours and shape come from styles/stats.css.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import ConfirmDialog from '../components/ConfirmDialog';
import ExamGoalSheet from '../components/ExamGoalSheet';
import TransportGlyph from '../components/wave/TransportGlyph';
import { getAllStats, clearStats } from '../lib/stats';
import { getAllMemory, clearAllMemory } from '../lib/memory';
import { clearForgottenFolder, getFolders, PERM_GROUP_IDS } from '../lib/folders';
import { useFolderPlayback } from '../hooks/useFolderPlayback';
import { bookProgress, examPlan, percent, sumProgress } from '../lib/statsSummary';
import { clearListenTime, formatDuration, listenTotals } from '../lib/listenTime';
import { resolveTheme } from '../lib/theme';

const GREEN = '#2d8c4a';
const ORANGE = '#e8821e';

function Donut({ p }) {
  const r = 44, c = 2 * Math.PI * r;
  const parts = [[p.remembered, GREEN], [p.forgotten, ORANGE], [p.unrated, 'rgb(var(--c-ochre))']];
  let offset = 0;
  return (
    <span className="st-donut" aria-hidden="true">
      <svg width="116" height="116" viewBox="0 0 116 116">
        <circle cx="58" cy="58" r={r} fill="none" className="st-track" strokeWidth="13" />
        {parts.map(([n, color]) => {
          const len = p.heard ? (n / p.heard) * c : 0;
          const seg = (
            <circle key={color} cx="58" cy="58" r={r} fill="none" stroke={color} strokeWidth="13"
              strokeDasharray={`${len} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 58 58)" />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <b>{percent(p.remembered, p.heard)}%</b>
      <small>จำได้</small>
    </span>
  );
}

function Legend({ color, label, n }) {
  return (
    <div className="st-legend">
      <i style={{ background: color }} />
      <span>{label}</span>
      <b>{n.toLocaleString()}</b>
    </div>
  );
}

export default function StatsScreen() {
  const navigate = useNavigate();
  const { books, settings, setSettings } = useApp();
  const [, setTick] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingExam, setEditingExam] = useState(false);
  const wave = resolveTheme(settings) === 'wave';

  const ready = books.filter(b => b.sections?.length);
  const heardIds = new Set(Object.keys(getAllStats()));
  const memory = getAllMemory();
  const rows = ready.map(b => ({ book: b, p: bookProgress(b, heardIds, memory) }));
  const sum = sumProgress(rows.map(r => r.p));
  const time = listenTotals();
  const exam = settings.exam ?? null;
  const plan = exam ? examPlan(exam, ready, heardIds, memory) : null;
  const folders = getFolders();
  const play = useFolderPlayback({ books, folders });
  const reviewing = play.isPlayingSource(`group:${PERM_GROUP_IDS.forgotten}`);

  // Clear listening stats AND the จำได้/จำไม่ได้ marks (+ the "จำไม่ได้" folder
  // they populate) so every figure here resets together.
  const handleClear = () => {
    clearStats();
    clearAllMemory();
    clearForgottenFolder();
    clearListenTime();
    setConfirmClear(false);
    setTick(t => t + 1);
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">
      {wave ? (
        <div className="px-[18px] pt-3 pb-1 flex-shrink-0 font-display text-[22px] font-bold">สถิติการฟัง</div>
      ) : (
        <div className="px-5 pt-3.5 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
          <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">สถิติการฟัง</div>
          <div className="font-display font-light leading-none mt-0.5" style={{ fontSize: 38, letterSpacing: -1, lineHeight: 0.9 }}>
            สถิติ<span className="italic">การฟัง</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 font-ui">
        <section className="st-card st-memory">
          <div className="st-memory-top">
            <Donut p={sum} />
            <div className="flex-1 min-w-0">
              <Legend color={GREEN} label="จำได้" n={sum.remembered} />
              <Legend color={ORANGE} label="จำไม่ได้" n={sum.forgotten} />
              <Legend color="rgb(var(--c-ochre))" label="ยังไม่ประเมิน" n={sum.unrated} />
            </div>
          </div>
          <div className="st-note">
            {sum.heard
              ? `ฟังแล้ว ${sum.heard.toLocaleString()} จาก ${sum.total.toLocaleString()} มาตรา (${percent(sum.heard, sum.total)}%)`
              : 'ฟังมาตราใดก็ได้ แล้วกลับมาดูที่นี่'}
          </div>
          {sum.forgotten > 0 && (
            <button className="tap-btn st-review" onClick={() => play.playGroup(PERM_GROUP_IDS.forgotten)}>
              <TransportGlyph stopping={reviewing} size={12} />
              {reviewing ? 'หยุด' : `ฟังทบทวนที่จำไม่ได้ ${sum.forgotten.toLocaleString()} มาตรา`}
            </button>
          )}
        </section>

        <button className={`tap-btn st-card st-exam${exam ? '' : ' is-empty'}`} onClick={() => setEditingExam(true)}>
          {!exam ? (
            <>
              <b className="st-exam-add">＋ ตั้งวันสอบ</b>
              <span>นับถอยหลัง และคำนวณว่าต้องฟังวันละกี่มาตรา</span>
            </>
          ) : (
            <>
              <span className="st-exam-days">
                <b>{plan.days > 0 ? plan.days.toLocaleString() : plan.days === 0 ? 'วันนี้' : '–'}</b>
                {plan.days > 0 && <small>วัน</small>}
              </span>
              <span className="st-exam-info">
                <b>{exam.name}</b>
                <span>
                  {plan.days < 0 ? 'ผ่านวันสอบแล้ว แตะเพื่อตั้งสนามใหม่'
                    : plan.days === 0 ? 'ขอให้โชคดีในการสอบ'
                      : plan.left === 0 ? 'ฟังครบทุกมาตราแล้ว'
                        : `ต้องฟังวันละ ${plan.perDay.toLocaleString()} มาตรา`}
                </span>
                {plan.days > 0 && plan.left > 0 && <small>เหลือ {plan.left.toLocaleString()} มาตรา ใน {plan.books} ฉบับ</small>}
              </span>
            </>
          )}
        </button>

        <div className="st-times">
          {[['วันนี้', time.today], ['7 วันล่าสุด', time.week], ['ทั้งหมด', time.all]].map(([label, sec]) => (
            <div key={label} className="st-card st-time">
              <span>{label}</span>
              <b>{formatDuration(sec)}</b>
            </div>
          ))}
        </div>

        {rows.some(r => r.p.heard) && <h3 className="st-head">แยกตามฉบับ</h3>}
        {rows.filter(r => r.p.heard).map(({ book, p }) => (
          <button key={book.id} className="tap-btn st-card st-law" style={{ '--lc': book.waveColor }} onClick={() => navigate(`/stats/${book.id}`)}>
            <span className="st-law-top">
              <b>{book.shortLabel}</b>
              <span>ฟังแล้ว {percent(p.heard, p.total)}%</span>
            </span>
            <span className="st-bar" aria-hidden="true">
              <i style={{ width: `${(p.remembered / p.total) * 100}%`, background: GREEN }} />
              <i style={{ width: `${(p.forgotten / p.total) * 100}%`, background: ORANGE }} />
              <i style={{ width: `${(p.unrated / p.total) * 100}%`, background: 'var(--lc)' }} />
            </span>
            <span className="st-law-sub">จำได้ {p.remembered} · จำไม่ได้ {p.forgotten} · ยังไม่ประเมิน {p.unrated}</span>
          </button>
        ))}

        {sum.heard > 0 && (
          <div className="pt-4 text-center">
            <button onClick={() => setConfirmClear(true)} className="tap-btn text-[11px] text-accent underline">ล้างสถิติทั้งหมด</button>
          </div>
        )}
      </div>

      {editingExam && (
        <ExamGoalSheet
          exam={exam}
          books={ready}
          onSave={(next) => setSettings(s => ({ ...s, exam: next }))}
          onClose={() => setEditingExam(false)}
        />
      )}
      {confirmClear && (
        <ConfirmDialog
          title="ล้างสถิติทั้งหมด?"
          body="สถิติการฟัง เวลาฟัง และสถานะจำได้/จำไม่ได้ทั้งหมดจะถูกล้าง รวมถึงโฟลเดอร์ “จำไม่ได้”"
          confirmLabel="ล้างทั้งหมด"
          onConfirm={handleClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      <TabBar />
    </div>
  );
}
