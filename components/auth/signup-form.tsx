"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function isSignupEmailRateLimitMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("email rate limit") ||
    m.includes("too many requests") ||
    m.includes("over_email_send_rate_limit") ||
    m.includes("security purposes")
  );
}

export type SignupFormProps = {
  embedded?: boolean;
  onRequestLogin?: () => void;
  submitButtonClassName?: string;
};

export function SignupForm(props: SignupFormProps = {}) {
  const {
    embedded = false,
    onRequestLogin,
    submitButtonClassName,
  } = props;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] =
    useState(false);
  const [rateLimitBlocked, setRateLimitBlocked] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRateLimitBlocked(false);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (signError) {
        if (isSignupEmailRateLimitMessage(signError.message)) {
          setRateLimitBlocked(true);
          return;
        }
        setError(signError.message);
        return;
      }
      if (data.session) {
        router.refresh();
        router.push("/dashboard");
        return;
      }
      setAwaitingEmailConfirmation(true);
    } finally {
      setLoading(false);
    }
  }

  if (rateLimitBlocked) {
    return (
      <div className="flex flex-col gap-4" role="alert">
        <div className="space-y-2">
          <h3 className="font-heading text-base font-semibold text-limbi-text">
            Límite temporal de correos alcanzado
          </h3>
          <p className="text-sm leading-relaxed text-limbi-muted">
            Alcanzamos el límite temporal de envío de correos de confirmación.
            Espera un rato antes de intentarlo nuevamente. Si ya confirmaste tu
            cuenta, intenta iniciar sesión.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            setRateLimitBlocked(false);
            setError(null);
          }}
        >
          Entendido
        </Button>
        {embedded && onRequestLogin ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-limbi-muted"
            onClick={onRequestLogin}
          >
            Ir a iniciar sesión
          </Button>
        ) : !embedded ? (
          <Button asChild variant="ghost" className="w-full text-muted-foreground">
            <Link href="/login">Ir a iniciar sesión</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  if (awaitingEmailConfirmation) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-semibold text-limbi-text">
            Revisa tu correo
          </h3>
          <p className="text-sm leading-relaxed text-limbi-text">
            Te enviamos un enlace de confirmación para activar tu cuenta. Abre
            tu correo, confirma el acceso y luego vuelve a iniciar sesión en
            Limbi.
          </p>
          <p className="text-sm leading-relaxed text-limbi-muted">
            Si no lo ves, revisa spam, promociones o correo no deseado.
          </p>
        </div>
        {embedded && onRequestLogin ? (
          <Button type="button" variant="outline" onClick={onRequestLogin}>
            Ir a iniciar sesión
          </Button>
        ) : !embedded ? (
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Ir a iniciar sesión</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <label htmlFor="signup-email" className="text-sm font-medium">
          Correo
        </label>
        <Input
          id="signup-email"
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
        <label htmlFor="signup-password" className="text-sm font-medium">
          Contraseña
        </label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Mínimo 6 caracteres (ajusta políticas en Supabase si hace falta).
        </p>
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
        {loading ? "Creando…" : "Crear cuenta"}
      </Button>
      {embedded ? (
        onRequestLogin ? (
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={onRequestLogin}
            >
              Iniciar sesión
            </button>
          </p>
        ) : null
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Iniciar sesión
          </Link>
        </p>
      )}
    </form>
  );
}
