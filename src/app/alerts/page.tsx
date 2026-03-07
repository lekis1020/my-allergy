"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Plus, Trash2, X, Mail, Tag, Loader2 } from "lucide-react";
import { JOURNALS } from "@/lib/constants/journals";
import { useAuth } from "@/hooks/use-auth";

interface Subscription {
  id: string;
  journal_slug: string;
  created_at: string;
}

interface KeywordAlertItem {
  id: string;
  keyword: string;
  active: boolean;
  created_at: string;
}

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [keywords, setKeywords] = useState<KeywordAlertItem[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [loadingKeywords, setLoadingKeywords] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [togglingJournal, setTogglingJournal] = useState<string | null>(null);
  const [removingKeyword, setRemovingKeyword] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions);
      }
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch("/api/keyword-alerts");
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.alerts);
      }
    } finally {
      setLoadingKeywords(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLoadingSubs(false);
      setLoadingKeywords(false);
      return;
    }
    fetchSubscriptions();
    fetchKeywords();
  }, [user, fetchSubscriptions, fetchKeywords]);

  const toggleJournal = async (slug: string) => {
    setTogglingJournal(slug);
    const isSubscribed = subscriptions.some((s) => s.journal_slug === slug);
    try {
      if (isSubscribed) {
        await fetch("/api/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journalSlug: slug }),
        });
        setSubscriptions((prev) =>
          prev.filter((s) => s.journal_slug !== slug),
        );
      } else {
        await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journalSlug: slug }),
        });
        setSubscriptions((prev) => [
          ...prev,
          { id: crypto.randomUUID(), journal_slug: slug, created_at: new Date().toISOString() },
        ]);
      }
    } finally {
      setTogglingJournal(null);
    }
  };

  const addKeyword = async () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (keywords.some((k) => k.keyword.toLowerCase() === trimmed.toLowerCase())) return;

    setAddingKeyword(true);
    try {
      const res = await fetch("/api/keyword-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trimmed }),
      });
      if (res.ok) {
        setKeywords((prev) => [
          { id: crypto.randomUUID(), keyword: trimmed, active: true, created_at: new Date().toISOString() },
          ...prev,
        ]);
        setNewKeyword("");
      }
    } finally {
      setAddingKeyword(false);
    }
  };

  const removeKeyword = async (keyword: string) => {
    setRemovingKeyword(keyword);
    try {
      await fetch("/api/keyword-alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      setKeywords((prev) => prev.filter((k) => k.keyword !== keyword));
    } finally {
      setRemovingKeyword(null);
    }
  };

  const toggleKeywordActive = async (keyword: string, active: boolean) => {
    try {
      await fetch("/api/keyword-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, active }),
      });
      setKeywords((prev) =>
        prev.map((k) => (k.keyword === keyword ? { ...k, active } : k)),
      );
    } catch {
      // silently fail
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
            <Bell className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Sign in to set up alerts
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get notified when new papers are published in your favorite journals or match your keywords.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const subscribedSlugs = new Set(subscriptions.map((s) => s.journal_slug));

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        {/* Header */}
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-900 dark:text-gray-100" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Email Alerts
            </h1>
          </div>
        </div>

        {/* Journal Subscriptions */}
        <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Journal Subscriptions
            </h2>
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Get email notifications when new papers are published in these journals.
          </p>

          {loadingSubs ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {JOURNALS.map((journal) => {
                const isSubscribed = subscribedSlugs.has(journal.slug);
                const isToggling = togglingJournal === journal.slug;
                return (
                  <button
                    key={journal.slug}
                    onClick={() => toggleJournal(journal.slug)}
                    disabled={isToggling}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isSubscribed
                        ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: journal.color }}
                    />
                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                      {journal.name}
                    </span>
                    {journal.impactFactor && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        IF {journal.impactFactor}
                      </span>
                    )}
                    {isToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      <div
                        className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                          isSubscribed
                            ? "bg-blue-600"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                            isSubscribed ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Keyword Alerts */}
        <div className="px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Keyword Alerts
            </h2>
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Get notified when new papers match your keywords in title or abstract.
          </p>

          {/* Add keyword */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addKeyword();
            }}
            className="mb-4 flex gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="e.g. atopic dermatitis, IL-4, dupilumab"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                maxLength={200}
              />
              {newKeyword && (
                <button
                  type="button"
                  onClick={() => setNewKeyword("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={!newKeyword.trim() || addingKeyword}
              className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {addingKeyword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
            </button>
          </form>

          {/* Keyword list */}
          {loadingKeywords ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : keywords.length === 0 ? (
            <div className="py-8 text-center">
              <Tag className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No keyword alerts yet. Add keywords above to get notified.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {keywords.map((kw) => (
                <div
                  key={kw.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                    kw.active
                      ? "bg-purple-50 dark:bg-purple-900/20"
                      : "bg-gray-50 opacity-60 dark:bg-gray-800/50"
                  }`}
                >
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {kw.keyword}
                  </span>
                  <button
                    onClick={() => toggleKeywordActive(kw.keyword, !kw.active)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <div
                      className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                        kw.active
                          ? "bg-purple-600"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          kw.active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                  <button
                    onClick={() => removeKeyword(kw.keyword)}
                    disabled={removingKeyword === kw.keyword}
                    className="text-gray-400 transition-colors hover:text-red-500 dark:hover:text-red-400"
                  >
                    {removingKeyword === kw.keyword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
