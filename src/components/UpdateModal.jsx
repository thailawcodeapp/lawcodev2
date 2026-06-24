import { PLAY_STORE_URL } from '../config';

export default function UpdateModal({ type, message, onDismiss }) {
  const isForce = type === 'force';

  const openStore = () => {
    window.open(PLAY_STORE_URL, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} />
      <div
        className="relative bg-paper dark:bg-dark-bg rounded-2xl shadow-2xl p-5 max-w-xs w-full text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-[28px] mb-2">🔄</div>
        <div className="font-display text-[18px] font-medium italic">
          {isForce ? 'ต้องอัปเดตแอป' : 'มีเวอร์ชันใหม่'}
        </div>
        <div className="font-serif text-[13px] italic text-ink-soft dark:text-rule-soft mt-1.5 leading-snug">
          {message || 'กรุณาอัปเดตเพื่อรับเนื้อหาและฟีเจอร์ล่าสุด'}
        </div>
        <button
          onClick={openStore}
          className="mt-4 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper"
        >
          อัปเดตเลย
        </button>
        {!isForce && (
          <button
            onClick={onDismiss}
            className="mt-2 w-full font-ui text-[10px] text-ink-soft dark:text-rule-soft py-1.5"
          >
            ภายหลัง
          </button>
        )}
      </div>
    </div>
  );
}
