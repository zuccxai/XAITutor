"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getStoredTheme,
  getSystemTheme,
  setTheme as applyThemePreference,
  subscribeToThemeChanges,
  type Theme,
} from "@/lib/theme";
import {
  ACTIVE_SESSION_EVENT,
  ACTIVE_SESSION_STORAGE_KEY,
  LANGUAGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  readStoredActiveSessionId,
  readStoredLanguage,
  readStoredSidebarCollapsed,
  writeStoredActiveSessionId,
  writeStoredLanguage,
  writeStoredSidebarCollapsed,
  type AppLanguage,
} from "@/context/app-shell-storage";

interface AppShellContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

/**
 * 订阅语言本地存储变化。
 *
 * 输入：
 *   onStoreChange: React 外部存储变更通知回调。
 * 输出：返回取消订阅函数。
 */
function subscribeLanguage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LANGUAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LANGUAGE_EVENT, onStoreChange);
  };
}

/**
 * 订阅侧边栏折叠状态本地存储变化。
 *
 * 输入：
 *   onStoreChange: React 外部存储变更通知回调。
 * 输出：返回取消订阅函数。
 */
function subscribeSidebarCollapsed(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
  };
}

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? getSystemTheme();
  });
  const language = useSyncExternalStore<AppLanguage>(
    subscribeLanguage,
    readStoredLanguage,
    () => "en",
  );
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(
    () => readStoredActiveSessionId(),
  );
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    readStoredSidebarCollapsed,
    () => false,
  );

  useEffect(() => {
    return subscribeToThemeChanges((nextTheme) => {
      setThemeState(nextTheme);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_SESSION_STORAGE_KEY) {
        setActiveSessionIdState(event.newValue);
      }
    };

    const onActiveSession = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string | null }>)
        .detail;
      setActiveSessionIdState(detail?.sessionId ?? null);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(ACTIVE_SESSION_EVENT, onActiveSession);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ACTIVE_SESSION_EVENT, onActiveSession);
    };
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    applyThemePreference(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    writeStoredLanguage(nextLanguage);
  }, []);

  const setActiveSessionId = useCallback((sessionId: string | null) => {
    writeStoredActiveSessionId(sessionId);
    setActiveSessionIdState(sessionId);
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    writeStoredSidebarCollapsed(collapsed);
  }, []);

  const value = useMemo<AppShellContextValue>(
    () => ({
      theme,
      setTheme,
      language,
      setLanguage,
      activeSessionId,
      setActiveSessionId,
      sidebarCollapsed,
      setSidebarCollapsed,
    }),
    [
      activeSessionId,
      language,
      setActiveSessionId,
      setLanguage,
      setSidebarCollapsed,
      setTheme,
      sidebarCollapsed,
      theme,
    ],
  );

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used inside AppShellProvider");
  }
  return context;
}
