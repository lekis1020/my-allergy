"use client";

import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { useMobileDrawer } from "@/components/layout/mobile-drawer-context";

export function MobileDrawerWrapper() {
  const { open, close } = useMobileDrawer();
  return <MobileDrawer open={open} onClose={close} />;
}
