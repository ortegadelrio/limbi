import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getAuthenticatedSupabase() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export function jsonUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function jsonBadRequest(
  message: string,
  meta?: { code?: string; stage?: string; detail?: string },
) {
  return NextResponse.json(
    meta ? { error: message, ...meta } : { error: message },
    { status: 400 },
  );
}

export function jsonNotFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
