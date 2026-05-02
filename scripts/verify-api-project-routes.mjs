#!/usr/bin/env node
/**
 * Comprueba que cada route bajo app/api/projects incluya el patrón estándar
 * de sesión (getAuthenticatedSupabase + 401 si no hay usuario).
 * Ejecutar: npm run verify:api-auth
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiProjectsRoot = path.join(__dirname, "..", "app", "api", "projects");

function walkRouteTs(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) {
    console.error("Missing directory:", dir);
    process.exit(1);
  }
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walkRouteTs(p));
    else if (name.name === "route.ts") out.push(p);
  }
  return out;
}

const AUTH_IMPORT = "getAuthenticatedSupabase";
const AUTH_GATE = "if (!user) return jsonUnauthorized()";

const routes = walkRouteTs(apiProjectsRoot);
let failed = false;
for (const file of routes.sort()) {
  const rel = path.relative(path.join(__dirname, ".."), file);
  const txt = fs.readFileSync(file, "utf8");
  if (!txt.includes(AUTH_IMPORT)) {
    console.error(`[FAIL] ${rel}: missing ${AUTH_IMPORT}`);
    failed = true;
  }
  if (!txt.includes(AUTH_GATE)) {
    console.error(`[FAIL] ${rel}: missing auth gate (${AUTH_GATE})`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log(
  `OK: ${String(routes.length)} route(s) under app/api/projects include the auth gate.`,
);
