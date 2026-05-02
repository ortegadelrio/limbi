import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Accede con tu correo y contraseña de Limbi.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <LoginForm />
      </Suspense>
      <Button variant="ghost" className="w-full" asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
