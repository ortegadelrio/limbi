import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { limbiOutlineButtonClass } from "@/components/projects/limbi-ui";

export type SystemContextBreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  breadcrumb: SystemContextBreadcrumbItem[];
  eyebrow: string;
  /** Título principal (nombre del sistema o frase completa en el panel). */
  title: string;
  /** Sección actual (p. ej. Marco Estratégico Límbico). */
  sectionLabel?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function SystemContextHeader({
  breadcrumb,
  eyebrow,
  title,
  sectionLabel,
  description,
  actions,
  className,
}: Props) {
  return (
    <header
      className={cn(
        "border-b border-limbi-border/90 bg-limbi-surface/95 pb-5 pt-2 backdrop-blur-sm dark:bg-limbi-surface/90",
        className,
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 sm:px-6">
        <nav
          aria-label="Ubicación en la plataforma"
          className="-mx-1 flex min-w-0 items-center gap-x-1 overflow-x-auto overscroll-x-contain px-1 text-[11px] leading-snug text-limbi-muted sm:text-xs"
        >
          {breadcrumb.map((item, index) => (
            <span
              key={`${item.label}-${String(index)}`}
              className="flex shrink-0 items-center gap-x-1"
            >
              {index > 0 ? (
                <span className="text-limbi-border" aria-hidden>
                  /
                </span>
              ) : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="whitespace-nowrap text-limbi-muted underline decoration-limbi-border underline-offset-2 transition-colors hover:text-limbi-text"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="whitespace-nowrap font-medium text-limbi-text">
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
              {eyebrow}
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-limbi-text sm:text-3xl">
              {title}
            </h1>
            {sectionLabel ? (
              <p className="text-sm font-semibold text-limbi-text/90">
                {sectionLabel}
              </p>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-limbi-muted">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** Enlace con aspecto de botón outline Limbi (para usar dentro de `actions`). */
export function SystemContextHeaderLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 shrink-0 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-all duration-200",
        limbiOutlineButtonClass,
        className,
      )}
    >
      {children}
    </Link>
  );
}
