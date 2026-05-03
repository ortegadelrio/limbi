"use client";

import { useState, type ComponentProps } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

type Props = {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
};

export function LogoutButton({
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error(error);
      }
      window.location.assign("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => void handleLogout()}
      disabled={loading}
    >
      {loading ? "Saliendo…" : "Cerrar sesión"}
    </Button>
  );
}
