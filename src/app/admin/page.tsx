import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";
import { AdminUserList } from "@/components/admin/user-list";

export const metadata = {
  title: "Admin - User Management | My Allergy",
};

export default async function AdminPage() {
  const authClient = await createServerAuthClient();
  const { data: { session } } = await authClient.auth.getSession();

  if (!session?.user || !isAdmin(session.user.email)) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        User Management
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        가입한 사용자 계정 목록을 조회합니다.
      </p>
      <div className="mt-6">
        <AdminUserList />
      </div>
    </div>
  );
}
