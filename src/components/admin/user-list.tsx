"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  perPage: number;
}

export function AdminUserList() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchUsers = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?page=${p}&perPage=${perPage}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(page);
  }, [page, fetchUsers]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!data || data.users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-gray-400">
        <Users className="h-10 w-10" />
        <p>등록된 사용자가 없습니다.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / perPage);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>총 {data.total}명</span>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                사용자
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                이메일
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:table-cell">
                Provider
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
                가입일
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
                최근 로그인
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
            {data.users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.full_name || "User"}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {(user.full_name || user.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.full_name || "-"}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {user.email}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 sm:table-cell">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {user.provider || "-"}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400 md:table-cell">
                  {formatDate(user.created_at)}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400 md:table-cell">
                  {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
