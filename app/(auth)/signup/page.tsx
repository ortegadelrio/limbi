import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Regístrate con correo y contraseña. Si tu proyecto Supabase exige
          confirmación por email, te llegará un enlace a esta app.
        </p>
      </div>
      <SignupForm />
      <Button variant="ghost" className="w-full" asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
