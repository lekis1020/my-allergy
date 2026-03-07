"use client";

import Link from "next/link";
import { Bell, Bookmark, CalendarDays, Home, Menu, Stethoscope } from "lucide-react";
import { useMobileDrawer } from "@/components/layout/mobile-drawer-context";
import { AuthButton } from "@/components/layout/auth-button";

export function Header() {
  const { toggle } = useMobileDrawer();

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
          </Link>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="hidden items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 sm:inline-flex"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link
            href="/bookmarks"
            className="hidden items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 sm:inline-flex"
          >
            <Bookmark className="h-4 w-4" />
            Bookmarks
          </Link>
          <Link
            href="/calendar"
            className="hidden items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 sm:inline-flex"
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Link>
          <Link
            href="/alerts"
            className="hidden items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 sm:inline-flex"
          >
            <Bell className="h-4 w-4" />
            Alerts
          </Link>
          <div className="ml-1 border-l border-gray-200 pl-2 dark:border-gray-700 sm:ml-2 sm:pl-3">
            <AuthButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
