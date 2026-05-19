import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BrainstormerSessionPanel } from "@/components/brainstormer/brainstormer-session-panel";
import type {
  BrainstormMessageRow,
  BrainstormSessionRow,
  BrainstormSessionSnapshotRow,
} from "@/types/database";

type PageProps = { params: Promise<{ sessionId: string }> };

export const dynamic = "force-dynamic";

export default async function BrainstormerSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error: sErr } = await supabase
    .from("brainstorm_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sErr || !session) notFound();

  const row = session as BrainstormSessionRow;

  const [{ data: brand }, { data: messages }, { data: snaps }] = await Promise.all([
    supabase.from("brands").select("id, name").eq("id", row.brand_id).maybeSingle(),
    supabase
      .from("brainstorm_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("brainstorm_session_snapshots")
      .select("*")
      .eq("session_id", sessionId)
      .eq("snapshot_kind", "strategic_summary")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const brandName = String(brand?.name ?? "").trim() || "Marca";
  const snapshot = (snaps?.[0] ?? null) as BrainstormSessionSnapshotRow | null;
  const messageRows = (messages ?? []) as BrainstormMessageRow[];

  return (
    <BrainstormerSessionPanel
      sessionId={sessionId}
      initialSession={row}
      initialMessages={messageRows}
      initialSnapshot={snapshot}
      brandName={brandName}
    />
  );
}
