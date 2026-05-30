import { useNavigate, useLocation } from 'react-router-dom';

const TABS = [
  {
    id: 'home',
    label: 'หน้าแรก',
    path: '/',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'select',
    label: 'เลือกฟัง',
    path: '/select',
    icon: (
      // speaker / volume icon (#5)
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'สถิติ',
    path: '/stats',
    icon: (
      // bar-chart icon (#15)
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <line x1="6" y1="20" x2="6" y2="12" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="18" y1="20" x2="18" y2="9" />
      </svg>
    ),
  },
  {
    id: 'bookmarks',
    label: 'บุ๊กมาร์ก',
    path: '/bookmarks',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M5 4h11l3 3v13a1 1 0 0 1-1.5.87L12 18l-5.5 2.87A1 1 0 0 1 5 20Z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'ตั้งค่า',
    path: '/settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeId =
    pathname === '/' ? 'home'
    : pathname.startsWith('/select') ? 'select'
    : pathname.startsWith('/stats') ? 'stats'
    : pathname.startsWith('/bookmarks') ? 'bookmarks'
    : pathname.startsWith('/settings') ? 'settings'
    : null;

  return (
    <div className="border-t-2 border-rule bg-paper dark:bg-dark-bg dark:border-ink-soft flex-shrink-0">
      <div className="flex">
        {TABS.map((tab, i) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={[
                'flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-colors',
                i < TABS.length - 1 ? 'border-r border-rule-soft dark:border-ink-soft' : '',
                active
                  ? 'bg-ink dark:bg-paper text-paper dark:text-ink'
                  : 'bg-transparent text-ink dark:text-paper',
              ].join(' ')}
            >
              <span className={active ? '' : 'opacity-70'}>{tab.icon}</span>
              <span
                className="font-display text-[10px] leading-none"
                style={{ fontStyle: active ? 'italic' : 'normal', fontWeight: active ? 600 : 400 }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
