import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Brainstormer API — aislamiento por usuario (contrato)", () => {
  it("GET sesión y POST mensajes filtran por user_id del autenticado", () => {
    const root = path.join(__dirname, "../../app/api/brainstormer/sessions");
    const getSrc = readFileSync(path.join(root, "[sessionId]/route.ts"), "utf8");
    const postSrc = readFileSync(path.join(root, "[sessionId]/messages/route.ts"), "utf8");
    expect(getSrc).toContain('.eq("user_id", user.id)');
    expect(postSrc).toContain('.eq("user_id", user.id)');
  });
});
