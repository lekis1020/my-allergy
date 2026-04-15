"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, RotateCcw, Settings as SettingsIcon, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFeedback } from "@/hooks/use-feedback";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { resetAll } = useFeedback();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = async () => {
    setResetting(true);
    setErrorMessage(null);
    try {
      await resetAll();
      setResetDone(true);
      setConfirming(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
        <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
        <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <SettingsIcon className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Sign in to manage settings
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-gray-900 dark:text-gray-100" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Settings
            </h1>
          </div>
        </div>

        <section className="border-b border-gray-200 px-4 py-5 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Reset recommendation history
            </h2>
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Removes every 👍/👎 you gave on papers. Journal subscriptions, bookmarks, and
            keyword alerts are not affected.
          </p>

          {resetDone ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Your feedback history has been cleared.
            </p>
          ) : !confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/70 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              <RotateCcw className="h-4 w-4" /> Reset recommendation history
            </button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/70 dark:bg-red-900/20">
              <p className="mb-3 text-sm font-medium text-red-800 dark:text-red-200">
                This will permanently remove all your paper feedback. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={resetting}
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {resetting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Yes, reset
                </button>
                <button
                  type="button"
                  disabled={resetting}
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
              {errorMessage && (
                <p className="mt-3 text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
