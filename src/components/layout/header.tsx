"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Clock, Home, Menu, MessagesSquare, Microscope, Stethoscope, TrendingUp } from "lucide-react";
import { useMobileDrawer } from "@/components/layout/mobile-drawer-context";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AuthButton } from "@/components/layout/auth-button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UnreadRepliesBadge } from "@/components/comments/unread-badge";

class NotificationErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[NotificationBell] crash:", error, info);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function Header() {
  const { toggle } = useMobileDrawer();
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `hidden items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:inline-flex ${
      isActive
        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
    }`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              My Allergy
            </span>
            <span className="ml-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium italic tracking-wide text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              beta
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/" className={linkClass("/")}>
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link href="/trending" className={linkClass("/trending")}>
            <TrendingUp className="h-4 w-4" />
            Trending
          </Link>
          <Link href="/clinical-trials" className={linkClass("/clinical-trials")}>
            <Microscope className="h-4 w-4" />
            Trials
          </Link>
          <Link href="/agora" className={linkClass("/agora")}>
            <MessagesSquare className="h-4 w-4" />
            Agora
          </Link>
          <Link href="/bookmarks" className={linkClass("/bookmarks")}>
            <Clock className="h-4 w-4" />
            History
            <UnreadRepliesBadge />
          </Link>
          <Link href="/calendar" className={linkClass("/calendar")}>
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Link>
          <Link href="/alerts" className={linkClass("/alerts")}>
            <Bell className="h-4 w-4" />
            Alerts
          </Link>
          <NotificationErrorBoundary>
            <NotificationBell />
          </NotificationErrorBoundary>
          <div className="ml-1 border-l border-gray-200 pl-2 dark:border-gray-700 sm:ml-2 sm:pl-3">
            <AuthButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
