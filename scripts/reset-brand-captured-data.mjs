#!/usr/bin/env node
/**
 * Reset controlado de datos capturados del Journey de Marca.
 *
 * No se ejecuta automáticamente. Requiere:
 *   CONFIRM_RESET_BRAND_CAPTURED_DATA=true
 *
 * Y al menos uno:
 *   RESET_BRAND_IDS=uuid1,uuid2
 *   RESET_BRAND_USER_EMAIL=user@example.com
 *
 * Por defecto conserva `brands` y `brand_offer_profiles`.
 * Para borrar también las marcas filtradas:
 *   DELETE_BRANDS=true
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const BRAND_DOCUMENTS_BUCKET = "brand-documents";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
    process.env[key] = value;
  }
}

loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env"));

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta variable de entorno requerida: ${name}`);
  }
  return value;
}

function parseCsvEnv(name) {
  return (process.env[name] ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function assertSafetyGuards() {
  if (process.env.CONFIRM_RESET_BRAND_CAPTURED_DATA !== "true") {
    throw new Error(
      "Abortado: define CONFIRM_RESET_BRAND_CAPTURED_DATA=true para confirmar el reset.",
    );
  }

  const brandIds = parseCsvEnv("RESET_BRAND_IDS");
  const email = process.env.RESET_BRAND_USER_EMAIL?.trim();
  if (brandIds.length === 0 && !email) {
    throw new Error(
      "Abortado: define RESET_BRAND_IDS o RESET_BRAND_USER_EMAIL para acotar el reset.",
    );
  }
}

async function findUserIdByEmail(supabase, email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const users = data.users ?? [];
    const found = users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (found) return found.id;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function loadTargetBrands(supabase) {
  const byId = new Map();
  const requestedBrandIds = parseCsvEnv("RESET_BRAND_IDS");

  if (requestedBrandIds.length > 0) {
    const { data, error } = await supabase
      .from("brands")
      .select("id, user_id, name")
      .in("id", requestedBrandIds);
    if (error) throw error;
    for (const row of data ?? []) byId.set(row.id, row);
  }

  const email = process.env.RESET_BRAND_USER_EMAIL?.trim();
  if (email) {
    const userId = await findUserIdByEmail(supabase, email);
    if (!userId) {
      throw new Error(`No se encontró usuario con email: ${email}`);
    }
    const { data, error } = await supabase
      .from("brands")
      .select("id, user_id, name")
      .eq("user_id", userId);
    if (error) throw error;
    for (const row of data ?? []) byId.set(row.id, row);
  }

  return [...byId.values()];
}

async function deleteByBrandId(supabase, table, brandIds) {
  if (brandIds.length === 0) return 0;
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .in("brand_id", brandIds);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function deleteImprovementMessages(supabase, brandIds) {
  const { data: sessions, error: sessionError } = await supabase
    .from("brand_improvement_sessions")
    .select("id")
    .in("brand_id", brandIds);
  if (sessionError) throw sessionError;

  const sessionIds = (sessions ?? []).map((row) => row.id).filter(Boolean);
  if (sessionIds.length === 0) return 0;

  const { error, count } = await supabase
    .from("brand_improvement_messages")
    .delete({ count: "exact" })
    .in("session_id", sessionIds);
  if (error) throw new Error(`brand_improvement_messages: ${error.message}`);
  return count ?? 0;
}

async function listStoragePathsRecursive(supabase, prefix) {
  const out = [];

  async function walk(currentPrefix) {
    let offset = 0;
    const limit = 100;
    while (true) {
      const { data, error } = await supabase.storage
        .from(BRAND_DOCUMENTS_BUCKET)
        .list(currentPrefix, {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (error) throw error;

      const entries = data ?? [];
      for (const entry of entries) {
        const fullPath = currentPrefix ? `${currentPrefix}/${entry.name}` : entry.name;
        if (entry.id === null && entry.metadata === null) {
          await walk(fullPath);
        } else {
          out.push(fullPath);
        }
      }

      if (entries.length < limit) break;
      offset += limit;
    }
  }

  await walk(prefix);
  return out;
}

async function deleteStorageObjects(supabase, brands, documentStoragePaths) {
  const paths = new Set(documentStoragePaths.filter(Boolean));

  for (const brand of brands) {
    const prefix = `${brand.user_id}/${brand.id}`;
    try {
      const listed = await listStoragePathsRecursive(supabase, prefix);
      for (const item of listed) paths.add(item);
    } catch (error) {
      console.warn(
        `[storage] No se pudo listar ${BRAND_DOCUMENTS_BUCKET}/${prefix}; se continuará. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const allPaths = [...paths];
  if (allPaths.length === 0) {
    console.log("[storage] No se encontraron archivos para borrar.");
    return;
  }

  for (let i = 0; i < allPaths.length; i += 100) {
    const chunk = allPaths.slice(i, i + 100);
    const { error } = await supabase.storage
      .from(BRAND_DOCUMENTS_BUCKET)
      .remove(chunk);
    if (error) {
      console.warn(
        `[storage] No se pudieron borrar algunos archivos; se continuará. ${error.message}`,
      );
    }
  }
  console.log(`[storage] Intento de borrado para ${allPaths.length} archivo(s).`);
}

async function main() {
  assertSafetyGuards();

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const brands = await loadTargetBrands(supabase);
  if (brands.length === 0) {
    throw new Error("No hay marcas que coincidan con el filtro indicado.");
  }

  const brandIds = brands.map((brand) => brand.id);
  const deleteBrands = process.env.DELETE_BRANDS === "true";

  console.log("Marcas objetivo:");
  for (const brand of brands) {
    console.log(`- ${brand.id} (${brand.name}) user=${brand.user_id}`);
  }
  console.log(
    deleteBrands
      ? "Modo: borrar datos capturados y también brands filtradas."
      : "Modo: borrar solo datos capturados; conservar brands y brand_offer_profiles.",
  );

  const { data: docs, error: docsError } = await supabase
    .from("brand_documents")
    .select("storage_path")
    .in("brand_id", brandIds);
  if (docsError) throw docsError;

  await deleteStorageObjects(
    supabase,
    brands,
    (docs ?? []).map((doc) => doc.storage_path),
  );

  const counts = [];
  counts.push([
    "brand_improvement_messages",
    await deleteImprovementMessages(supabase, brandIds),
  ]);
  for (const table of [
    "brand_section_improvements",
    "brand_improvement_sessions",
    "brand_evaluations",
    "brand_source_facts",
    "brand_document_analysis_runs",
    "brand_document_analysis_batches",
    "brand_document_extractions",
    "brand_documents",
    "brand_responses",
    "brand_offer_items",
    "brand_audience_territories",
  ]) {
    counts.push([table, await deleteByBrandId(supabase, table, brandIds)]);
  }

  if (deleteBrands) {
    const { error, count } = await supabase
      .from("brands")
      .delete({ count: "exact" })
      .in("id", brandIds);
    if (error) throw error;
    counts.push(["brands", count ?? 0]);
  }

  console.log("Reset completado:");
  for (const [table, count] of counts) {
    console.log(`- ${table}: ${count}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
