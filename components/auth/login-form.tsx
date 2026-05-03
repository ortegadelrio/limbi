"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/auth/safe-next-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type LoginFormProps = {
  /** Oculta el enlace a /signup; usa `onRequestSignup` para cambiar de tab en el home. */
  embedded?: boolean;
  onRequestSignup?: () => void;
  submitButtonClassName?: string;
};

export function LoginForm(props: LoginFormProps = {}) {
  const {
    embedded = false,
    onRequestSignup,
    submitButtonClassName,
  } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const next = safeInternalPath(nextRaw);
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    urlError === "auth"
      ? "No pudimos completar el inicio de sesión. Intenta de nuevo."
      : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) {
        setError(signError.message);
        return;
      }
      router.refresh();
      router.push(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <label htmlFor="login-email" className="text-sm font-medium">
          Correo
        </label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="login-password" className="text-sm font-medium">
          Contraseña
        </label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={loading}
        className={cn("w-full", submitButtonClassName)}
      >
        {loading ? "Entrando…" : "Entrar"}
      </Button>
      {embedded ? (
        onRequestSignup ? (
          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={onRequestSignup}
            >
              Crear cuenta
            </button>
          </p>
        ) : null
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="font-medium text-foreground underline">
            Crear cuenta
          </Link>
        </p>
      )}
    </form>
  );
}
