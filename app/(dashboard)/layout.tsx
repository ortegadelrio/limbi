import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/layout/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-transparent">
      <header className="sticky top-0 z-40 border-b border-limbi-border/90 bg-limbi-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-limbi-surface/80 dark:bg-limbi-surface/85">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
          <DashboardNav />
          <span
            className="ml-auto hidden min-w-0 max-w-[14rem] truncate text-xs text-limbi-muted sm:block sm:text-sm"
            title={user.email ?? undefined}
          >
            {user.email}
          </span>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
