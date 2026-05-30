import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LAW_BOOKS_META } from '../data/lawMeta';

const AppContext = createContext(null);

const STORAGE_KEYS = {
  bookmarks: 'lawcode-eng-bookmarks',
  history:   'lawcode-eng-history',
  settings:  'lawcode-eng-settings',
};

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function AppProvider({ children }) {
  const [books, setBooks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Persistent state
  const [bookmarks, setBookmarksState] = useState(() =>
    loadStorage(STORAGE_KEYS.bookmarks, {}),
  );
  const [history, setHistoryState] = useState(() =>
    loadStorage(STORAGE_KEYS.history, []),
  );
  const [settings, setSettingsState] = useState(() =>
    loadStorage(STORAGE_KEYS.settings, {
      isDarkMode: false,
      fontScale: 'M',
      isPro: false,
      justified: true,
      showThaiOriginal: false,
    }),
  );

  // Ad tracking (session-only)
  const [sectionOpenCount, setSectionOpenCount] = useState(0);
  const AD_EVERY = 5; // show ad every N section opens

  // Load available law data on mount
  useEffect(() => {
    const loadBooks = async () => {
      const loaded = [];
      for (const meta of LAW_BOOKS_META) {
        if (meta.available && meta.dataFile) {
          try {
            const res = await fetch(meta.dataFile);
            const json = await res.json();
            loaded.push({
              ...meta,
              sections: (json.sections || []).map(s => ({ ...s, bookId: meta.id })),
              totalSections: json.totalSections || json.sections?.length || meta.totalSections,
            });
          } catch {
            loaded.push({ ...meta, sections: [] });
          }
        } else {
          loaded.push({ ...meta, sections: [] });
        }
      }
      setBooks(loaded);
      setLoadingData(false);
    };
    loadBooks();
  }, []);

  // Persist bookmarks
  const setBookmarks = useCallback((updater) => {
    setBookmarksState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveStorage(STORAGE_KEYS.bookmarks, next);
      return next;
    });
  }, []);

  // Persist history
  const setHistory = useCallback((updater) => {
    setHistoryState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveStorage(STORAGE_KEYS.history, next);
      return next;
    });
  }, []);

  // Persist settings
  const setSettings = useCallback((updater) => {
    setSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveStorage(STORAGE_KEYS.settings, next);
      return next;
    });
  }, []);

  const toggleBookmark = useCallback((section, folder = 'General') => {
    setBookmarks(prev => {
      const key = section.id;
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          sectionId: section.id,
          number: section.number,
          title: section.title,
          bookId: section.bookId,
          folder,
          savedAt: Date.now(),
        },
      };
    });
  }, [setBookmarks]);

  const isBookmarked = useCallback((sectionId) => !!bookmarks[sectionId], [bookmarks]);

  const addHistory = useCallback((section) => {
    setHistory(prev => {
      const filtered = prev.filter(h => h.sectionId !== section.id);
      return [
        { sectionId: section.id, number: section.number, title: section.title, bookId: section.bookId, viewedAt: Date.now() },
        ...filtered,
      ].slice(0, 50);
    });
  }, [setHistory]);

  const trackSectionOpen = useCallback(() => {
    setSectionOpenCount(c => c + 1);
    return sectionOpenCount > 0 && sectionOpenCount % AD_EVERY === 0;
  }, [sectionOpenCount]);

  const value = {
    books,
    loadingData,
    bookmarks,
    history,
    settings,
    setSettings,
    toggleBookmark,
    isBookmarked,
    addHistory,
    trackSectionOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
