import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Brainstormer — resumen operativo (contrato)", () => {
  it("POST mensajes inserta snapshot y devuelve session_progress", () => {
    const src = readFileSync(
      path.join(__dirname, "../../app/api/brainstormer/sessions/[sessionId]/messages/route.ts"),
      "utf8",
    );
    const turnSrc = readFileSync(
      path.join(__dirname, "run-brainstormer-assistant-turn.ts"),
      "utf8",
    );
    expect(turnSrc).toContain('from("brainstorm_session_snapshots").insert');
    expect(turnSrc).toContain("session_progress: merged");
    expect(src).toContain("session_progress: turn.session_progress");
    expect(src).toContain("snapshot: turn.snapshot");
  });

  it("GET sesión devuelve el snapshot strategic_summary más reciente", () => {
    const src = readFileSync(
      path.join(__dirname, "../../app/api/brainstormer/sessions/[sessionId]/route.ts"),
      "utf8",
    );
    expect(src).toContain('eq("snapshot_kind", "strategic_summary")');
    expect(src).toContain('order("created_at", { ascending: false })');
    expect(src).toContain("limit(1)");
  });

  it("panel usa OperationalSummaryCard y actualiza snapshot tras enviar", () => {
    const src = readFileSync(
      path.join(__dirname, "../../components/brainstormer/brainstormer-session-panel.tsx"),
      "utf8",
    );
    expect(src).toContain("OperationalSummaryCard");
    expect(src).toContain("applyTurnSnapshotUpdate");
    expect(src).toContain("session_progress");
    expect(src).not.toContain("JSON.stringify(snapshot.snapshot_payload");
  });

  it("OperationalSummaryCard muestra empty state sin JSON", () => {
    const src = readFileSync(
      path.join(__dirname, "../../components/brainstormer/operational-summary-card.tsx"),
      "utf8",
    );
    expect(src).toContain("Todavía no hay resumen operativo");
    expect(src).not.toContain("JSON.stringify");
  });
});
