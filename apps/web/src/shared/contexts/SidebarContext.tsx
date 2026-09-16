import { useCallback, useMemo, useState, type PropsWithChildren } from "react";
import { SidebarContext } from "@/shared/contexts/sidebarContextValue";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";

// Pre-prefix key. Read once as a fallback so a returning user keeps the
// sidebar state they chose; the next toggle writes the new key and drops it.
const LEGACY_SIDEBAR_KEY = "sidebar-collapsed";

function getInitialState(): boolean {
  try {
    const stored =
      localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) ??
      localStorage.getItem(LEGACY_SIDEBAR_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

export function SidebarProvider({ children }: PropsWithChildren) {
  const [isCollapsed, setIsCollapsed] = useState(getInitialState);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(next));
        localStorage.removeItem(LEGACY_SIDEBAR_KEY);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ isCollapsed, toggleSidebar }), [isCollapsed, toggleSidebar]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
