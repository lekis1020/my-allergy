"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface MobileDrawerState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const MobileDrawerContext = createContext<MobileDrawerState>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export const useMobileDrawer = () => useContext(MobileDrawerContext);

export function MobileDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <MobileDrawerContext.Provider value={{ open, toggle, close }}>
      {children}
    </MobileDrawerContext.Provider>
  );
}
