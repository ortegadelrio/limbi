"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LimbiLogo } from "@/components/brand/limbi-logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";

export function DashboardNav() {
  const pathname = usePathname();
  const onDashboard = pathname === "/dashboard";
  const onProjects = pathname.startsWith("/projects");
  const onBrands = pathname.startsWith("/brands");

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
      <Link
        href="/dashboard"
        className="shrink-0 rounded-xl py-1 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35 focus-visible:ring-offset-2 focus-visible:ring-offset-limbi-surface"
        aria-label="Limbi — Ir al panel"
      >
        <LimbiLogo variant="wordmark" size="sm" />
      </Link>
      <nav
        className="flex items-center gap-1 rounded-2xl border border-limbi-border bg-limbi-surface/90 p-1 shadow-sm dark:bg-limbi-surface/80"
        aria-label="Principal"
      >
        <Link
          href="/dashboard"
          className={cn(
            "rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35",
            onDashboard
              ? "bg-limbi-green/[0.08] text-limbi-green shadow-sm ring-1 ring-limbi-green/20"
              : "text-limbi-muted hover:bg-limbi-bg-soft hover:text-limbi-text",
          )}
        >
          Mi Limbi
        </Link>
        <Link
          href="/brands"
          className={cn(
            "rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35",
            onBrands
              ? "bg-limbi-green/[0.08] text-limbi-green shadow-sm ring-1 ring-limbi-green/20"
              : "text-limbi-muted hover:bg-limbi-bg-soft hover:text-limbi-text",
          )}
        >
          Marcas
        </Link>
        <Link
          href="/projects"
          className={cn(
            "rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35",
            onProjects
              ? "bg-limbi-green/[0.08] text-limbi-green shadow-sm ring-1 ring-limbi-green/20"
              : "text-limbi-muted hover:bg-limbi-bg-soft hover:text-limbi-text",
          )}
        >
          Mis Sistemas
        </Link>
      </nav>
      <LogoutButton
        variant="ghost"
        size="sm"
        className="shrink-0 rounded-xl text-limbi-muted hover:bg-limbi-bg-soft hover:text-limbi-text"
      />
    </div>
  );
}
