"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { LimbiLogo } from "@/components/brand/limbi-logo";
import {
  limbiDocumentCardClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

type AuthTab = "login" | "signup";

export function AuthHomePanel() {
  const [tab, setTab] = useState<AuthTab>("login");

  return (
    <div
      className={cn(
        limbiDocumentCardClass,
        "w-full max-w-md justify-self-end space-y-6 p-6 sm:p-8 lg:max-w-none",
      )}
    >
      <header className="space-y-3">
        <LimbiLogo variant="wordmark" size="md" />
        <h2 className="font-heading text-xl font-semibold tracking-tight text-limbi-text sm:text-2xl">
          Accede o crea tu cuenta
        </h2>
        <p className="text-sm leading-relaxed text-limbi-muted">
          Accede a tus Sistemas Límbicos o crea una cuenta para empezar.
        </p>
      </header>

      <div
        className="grid grid-cols-2 gap-1 rounded-xl border border-limbi-border/90 bg-limbi-bg-soft/70 p-1"
        role="tablist"
        aria-label="Acceso a Limbi"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "login"}
          className={cn(
            "rounded-lg py-2.5 text-sm font-medium transition-all duration-200",
            tab === "login"
              ? "bg-limbi-surface text-limbi-text shadow-sm ring-1 ring-limbi-border/80"
              : "text-limbi-muted hover:text-limbi-text",
          )}
          onClick={() => setTab("login")}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signup"}
          className={cn(
            "rounded-lg py-2.5 text-sm font-medium transition-all duration-200",
            tab === "signup"
              ? "bg-limbi-surface text-limbi-text shadow-sm ring-1 ring-limbi-border/80"
              : "text-limbi-muted hover:text-limbi-text",
          )}
          onClick={() => setTab("signup")}
        >
          Crear cuenta
        </button>
      </div>

      <div
        role="tabpanel"
        aria-live="polite"
        className="min-h-[12rem]"
        id={tab === "login" ? "home-panel-login" : "home-panel-signup"}
      >
        {tab === "login" ? (
          <Suspense
            fallback={
              <p className="text-sm text-limbi-muted" aria-busy="true">
                Cargando…
              </p>
            }
          >
            <LoginForm
              embedded
              onRequestSignup={() => setTab("signup")}
              submitButtonClassName={limbiPrimaryButtonClass}
            />
          </Suspense>
        ) : (
          <SignupForm
            embedded
            onRequestLogin={() => setTab("login")}
            submitButtonClassName={limbiPrimaryButtonClass}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-limbi-border/80 pt-4 text-center text-xs text-limbi-muted">
        <Link
          href="/login"
          className="underline decoration-limbi-border underline-offset-2 hover:text-limbi-text"
        >
          Solo iniciar sesión
        </Link>
        <span className="text-limbi-border" aria-hidden>
          ·
        </span>
        <Link
          href="/signup"
          className="underline decoration-limbi-border underline-offset-2 hover:text-limbi-text"
        >
          Solo registro
        </Link>
      </div>
    </div>
  );
}
