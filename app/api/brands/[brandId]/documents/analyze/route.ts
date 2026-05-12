import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { buildBrandDocumentAnalysisUserContent } from "@/lib/brands/build-brand-document-analysis-user-content";
import { applyBrandDocumentAnalysisGuardrails } from "@/lib/brands/brand-document-analysis-guardrail";
import {
  buildDefinitionIndex,
  filterAndCapFindings,
  findingDuplicatesBrandResponse,
} from "@/lib/brands/brand-document-analysis-filter";
import {
  BRAND_DOCUMENT_ANALYSIS_MAX_DOC_TEXT_CHARS,
  BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_PER_SECTION,
  BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_TOTAL,
} from "@/lib/brands/brand-document-analysis-limits";
import { getApprovedBrandSourceFacts } from "@/lib/brands/get-approved-brand-source-facts";
import { findingDuplicatesStructuredBrandContext } from "@/lib/brands/brand-document-finding-dedupe-context";
import { buildBrandSourceFactFingerprint } from "@/lib/brands/brand-source-facts-dedupe";
import { buildBrandDocumentAnalysisSystemInstructions } from "@/lib/prompts/brand-document-analysis";
import { generateBrandDocumentAnalysisJson } from "@/lib/openai/brand-document-analysis";
import {
  BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE,
  BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
  brandDocumentAnalysisOutputSchema,
  type BrandDocumentAnalysisFindingParsed,
  type BrandDocumentAnalysisResultCode,
} from "@/lib/schemas/brand-document-analysis";
import {
  BRAND_ANALYSIS_NO_USEFUL_HINT,
  BRAND_ANALYSIS_NO_USEFUL_PRIMARY,
} from "@/lib/brands/brand-document-analysis-empty-copy";
import { fetchAllowedBrandQuestionDefinitions } from "@/lib/questions/fetch-allowed-brand-questions";
import type {
  BrandDocumentAnalysisBatchRow,
  BrandDocumentType,
  BrandOfferNature,
  BrandResponseRow,
  BrandSourceFactRow,
} from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ brandId: string }> };

function attachAnalysisStructureCode(message: string): Error {
  const err = new Error(message);
  (err as Error & { code?: string }).code =
    BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE;
  return err;
}

function previewFirstFindingForDevLog(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const findings = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(findings) || findings.length === 0) return null;
  const f = findings[0];
  if (!f || typeof f !== "object") return null;
  const o = f as Record<string, unknown>;
  const preview: Record<string, unknown> = { keys: Object.keys(o) };
  for (const [k, v] of Object.entries(o)) {
    if (k === "extracted_fact" && typeof v === "string") {
      const t = v.trim();
      preview.extracted_fact_head = t.length <= 100 ? t : `${t.slice(0, 100)}…`;
      preview.extracted_fact_len = v.length;
      continue;
    }
    if (typeof v === "string" && v.length > 160) {
      preview[k] = { type: "string", len: v.length };
    } else {
      preview[k] = v;
    }
  }
  return preview;
}

function logDevBrandAnalysisFailure(args: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.error("[brand-document-analysis]", args);
}

function defensiveKeepCompleteFindings(
  findings: BrandDocumentAnalysisFindingParsed[],
): BrandDocumentAnalysisFindingParsed[] {
  return findings.filter(
    (f) =>
      Boolean(f.relationship_type) &&
      f.section_key.trim().length > 0 &&
      f.extracted_fact.trim().length > 0 &&
      f.proposed_inclusion.trim().length > 0,
  );
}

async function assertBrandOwned(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

type EligibleDoc = {
  brand_document_id: string;
  brand_document_extraction_id: string;
  file_name: string;
  document_type: BrandDocumentType;
  extracted_text: string;
};

export async function POST(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  const offerNature = profile?.offer_nature as BrandOfferNature | null | undefined;
  if (!offerNature) {
    return jsonBadRequest(
      "La marca necesita una naturaleza de oferta antes de analizar documentos.",
      { code: "offer_nature_required", stage: "analyze" },
    );
  }

  const { count: pendingCount, error: pendingErr } = await supabase
    .from("brand_source_facts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "pending_review");

  if (pendingErr) {
    return NextResponse.json({ error: pendingErr.message }, { status: 500 });
  }
  if ((pendingCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Hay hallazgos pendientes de revisión. Revísalos antes de lanzar un nuevo análisis.",
        code: "pending_review_blocking",
      },
      { status: 409 },
    );
  }

  const { rows: definitions, error: defErr } =
    await fetchAllowedBrandQuestionDefinitions(supabase, offerNature);
  if (defErr) {
    return NextResponse.json({ error: defErr.message }, { status: 500 });
  }
  const defIndex = buildDefinitionIndex(definitions);

  const { data: responses, error: respErr } = await supabase
    .from("brand_responses")
    .select(
      "id, brand_id, question_definition_id, section_key, module_key, question_key, answer_value, answer_text, answer_type, is_required, is_sensitive, source_type, created_at, updated_at",
    )
    .eq("brand_id", brandId);

  if (respErr) {
    return NextResponse.json({ error: respErr.message }, { status: 500 });
  }
  const responseRows = (responses ?? []) as BrandResponseRow[];

  const { facts: approvedFacts, error: afErr } = await getApprovedBrandSourceFacts(
    supabase,
    brandId,
  );
  if (afErr) {
    return NextResponse.json({ error: afErr.message }, { status: 500 });
  }

  const [{ data: offerItemsRows }, { data: territoryRows }] = await Promise.all([
    supabase
      .from("brand_offer_items")
      .select("item_type, title, description")
      .eq("brand_id", brandId)
      .order("display_order", { ascending: true }),
    supabase
      .from("brand_audience_territories")
      .select("territory_type, name")
      .eq("brand_id", brandId)
      .order("display_order", { ascending: true }),
  ]);

  const structuredOfferItems = (offerItemsRows ?? []).map((r) => {
    const row = r as { item_type: string; title: string; description: string | null };
    return {
      item_type: row.item_type,
      title: row.title,
      description: row.description,
    };
  });

  const structuredTerritories = (territoryRows ?? []).map((r) => {
    const row = r as { territory_type: string; name: string };
    return {
      territory_type: row.territory_type,
      name: row.name,
    };
  });

  const { data: fpRows, error: fpErr } = await supabase
    .from("brand_source_facts")
    .select("dedupe_fingerprint")
    .eq("brand_id", brandId)
    .in("status", ["approved", "pending_review"]);

  if (fpErr) {
    return NextResponse.json({ error: fpErr.message }, { status: 500 });
  }

  const existingFingerprints = new Set(
    (fpRows ?? [])
      .map((r) => (r as { dedupe_fingerprint: string }).dedupe_fingerprint)
      .filter(Boolean),
  );

  const { data: blockedDocRows, error: bdErr } = await supabase
    .from("brand_source_facts")
    .select("brand_document_id")
    .eq("brand_id", brandId)
    .not("brand_document_id", "is", null)
    .in("status", ["pending_review", "approved"]);

  if (bdErr) {
    return NextResponse.json({ error: bdErr.message }, { status: 500 });
  }
  const blockedDocumentIds = new Set(
    (blockedDocRows ?? [])
      .map((r) => (r as { brand_document_id: string | null }).brand_document_id)
      .filter((id): id is string => Boolean(id)),
  );

  const { data: docs, error: docsErr } = await supabase
    .from("brand_documents")
    .select("id, file_name, document_type, processing_status, brand_id")
    .eq("brand_id", brandId)
    .eq("processing_status", "ready");

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 });
  }

  const docIds = (docs ?? []).map((d) => d.id);
  if (docIds.length === 0) {
    return jsonBadRequest(
      "No hay documentos listos (processing_status = ready). Sube y extrae texto antes de analizar.",
      { code: "no_ready_documents", stage: "analyze" },
    );
  }

  const { data: extractions, error: exErr } = await supabase
    .from("brand_document_extractions")
    .select("id, brand_document_id, extraction_status, extracted_text")
    .eq("brand_id", brandId)
    .in("brand_document_id", docIds)
    .eq("extraction_status", "succeeded");

  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 });
  }

  const eligible: EligibleDoc[] = [];
  const skipped: { brand_document_id: string; reason: string }[] = [];

  for (const d of docs ?? []) {
    const ex = (extractions ?? []).find((e) => e.brand_document_id === d.id);
    if (!ex || ex.extraction_status !== "succeeded") {
      skipped.push({
        brand_document_id: d.id,
        reason: "Sin extracción con texto (no succeeded o sin fila de extracción).",
      });
      continue;
    }
    const text = (ex.extracted_text ?? "").trim();
    if (text.length === 0) {
      skipped.push({
        brand_document_id: d.id,
        reason: "Texto extraído vacío.",
      });
      continue;
    }
    eligible.push({
      brand_document_id: d.id,
      brand_document_extraction_id: ex.id,
      file_name: d.file_name,
      document_type: d.document_type as BrandDocumentType,
      extracted_text: text,
    });
  }

  const toAnalyze: EligibleDoc[] = [];
  for (const e of eligible) {
    if (blockedDocumentIds.has(e.brand_document_id)) {
      skipped.push({
        brand_document_id: e.brand_document_id,
        reason:
          "Este documento ya tiene hallazgos aprobados o pendientes; no se reanaliza en esta versión.",
      });
      continue;
    }
    toAnalyze.push(e);
  }

  if (eligible.length === 0) {
    return jsonBadRequest(
      "No hay documentos con texto extraído analizable (ready + extracción succeeded con texto).",
      { code: "no_analyzable_documents", stage: "analyze" },
    );
  }

  if (toAnalyze.length === 0) {
    return NextResponse.json({
      ok: true,
      batch: null,
      message:
        "Todos los documentos elegibles ya fueron analizados (hay hallazgos aprobados asociados) o no quedan candidatos.",
      skipped_documents: skipped,
      facts_created: [],
      section_counts: {},
    });
  }

  const { data: batchInsert, error: batchInsErr } = await supabase
    .from("brand_document_analysis_batches")
    .insert({
      brand_id: brandId,
      status: "running",
      documents_count: toAnalyze.length,
      analyzed_documents_count: 0,
      skipped_documents_count: 0,
      findings_count: 0,
      useful_sections_count: 0,
      prompt_version: BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
    })
    .select("*")
    .single();

  if (batchInsErr || !batchInsert) {
    return NextResponse.json(
      { error: batchInsErr?.message ?? "No se pudo crear el lote de análisis." },
      { status: 500 },
    );
  }

  const batch = batchInsert as BrandDocumentAnalysisBatchRow;
  const batchId = batch.id;

  const perSectionCounts = new Map<string, number>();
  let totalInserted = 0;
  const batchFindingsSoFar: { section_key: string; proposed_inclusion: string }[] = [];
  const runsOut: {
    id: string;
    brand_document_id: string;
    status: string;
    findings_count: number;
    error_message: string | null;
    model_used: string | null;
  }[] = [];
  const factsCreated: BrandSourceFactRow[] = [];
  const sectionsUsed = new Set<string>();
  let batchFailedMessage: string | null = null;
  let batchFailureCode: string | null = null;

  const systemText = buildBrandDocumentAnalysisSystemInstructions();

  for (const doc of toAnalyze) {
    if (totalInserted >= BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_TOTAL) {
      skipped.push({
        brand_document_id: doc.brand_document_id,
        reason: "Se alcanzó el máximo de hallazgos del lote (25).",
      });
      continue;
    }

    const { data: runRow, error: runInsErr } = await supabase
      .from("brand_document_analysis_runs")
      .insert({
        brand_id: brandId,
        batch_id: batchId,
        brand_document_id: doc.brand_document_id,
        brand_document_extraction_id: doc.brand_document_extraction_id,
        status: "running",
        prompt_version: BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
      })
      .select("*")
      .single();

    if (runInsErr || !runRow) {
      skipped.push({
        brand_document_id: doc.brand_document_id,
        reason: runInsErr?.message ?? "No se pudo crear la corrida de análisis.",
      });
      continue;
    }

    const runId = (runRow as { id: string }).id;

    const docText = doc.extracted_text.slice(0, BRAND_DOCUMENT_ANALYSIS_MAX_DOC_TEXT_CHARS);

    const remainingTotal = BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_TOTAL - totalInserted;
    const remainingBySection: Record<string, number> = {};
    for (const sk of defIndex.sectionKeys) {
      const used = perSectionCounts.get(sk) ?? 0;
      remainingBySection[sk] = Math.max(
        0,
        BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_PER_SECTION - used,
      );
    }

    const userContent = buildBrandDocumentAnalysisUserContent({
      brandName: brandRow?.name ?? "Marca",
      offerNature,
      document: {
        id: doc.brand_document_id,
        file_name: doc.file_name,
        document_type: doc.document_type,
      },
      documentText: docText,
      definitions,
      responses: responseRows,
      structuredOfferItems,
      structuredTerritories,
      approvedFactSummaries: approvedFacts.map((f) => ({
        section_key: f.section_key,
        proposed_inclusion: f.proposed_inclusion,
      })),
      batchFindingsSoFar,
      remainingTotal,
      remainingBySection,
    });

    const fullInput = `${systemText}\n\n---\n\n${userContent}`;

    let runModelUsed: string | null = null;

    try {
      const { model_used, raw_json_text } =
        await generateBrandDocumentAnalysisJson(fullInput);
      runModelUsed = model_used;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw_json_text) as unknown;
      } catch {
        logDevBrandAnalysisFailure({
          reason: "json_parse",
          prompt_version: BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
          model_used: runModelUsed,
          raw_json_length: raw_json_text.length,
        });
        throw attachAnalysisStructureCode(
          "Salida IA inválida: el JSON no se pudo interpretar.",
        );
      }

      const parsed = brandDocumentAnalysisOutputSchema.safeParse(parsedJson);
      if (!parsed.success) {
        const guess =
          parsedJson &&
          typeof parsedJson === "object" &&
          "analysis_result" in parsedJson
            ? String((parsedJson as { analysis_result?: unknown }).analysis_result)
            : null;
        const fc =
          parsedJson &&
          typeof parsedJson === "object" &&
          Array.isArray((parsedJson as { findings?: unknown }).findings)
            ? (parsedJson as { findings: unknown[] }).findings.length
            : undefined;
        logDevBrandAnalysisFailure({
          reason: "zod_validation",
          prompt_version: BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
          model_used: runModelUsed,
          zod_error: parsed.error.message,
          analysis_result: guess,
          findings_count: fc,
          first_finding_preview: previewFirstFindingForDevLog(parsedJson),
          raw_json_length: raw_json_text.length,
        });
        throw attachAnalysisStructureCode(
          `Salida IA inválida: ${parsed.error.message}`,
        );
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[brand-document-analysis] parsed", {
          prompt_version: BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
          model_used,
          analysis_result: parsed.data.analysis_result,
          findings_count: parsed.data.findings.length,
          first_finding_preview: previewFirstFindingForDevLog(parsed.data),
        });
      }

      const docAnalysis = parsed.data;
      const rawFindings =
        docAnalysis.analysis_result === "no_useful_findings"
          ? []
          : [...docAnalysis.findings];
      // Hallazgos con campos mínimos (relationship_type, section_key, textos no vacíos).
      // Si el modelo devolvió findings_found pero aquí queda vacío → salida incompleta / no usable como facts (error estructural).
      const afterDefense = defensiveKeepCompleteFindings(rawFindings);
      if (
        docAnalysis.analysis_result === "findings_found" &&
        rawFindings.length > 0 &&
        afterDefense.length < rawFindings.length
      ) {
        logDevBrandAnalysisFailure({
          reason: "defensive_drop_incomplete_findings",
          prompt_version: BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
          model_used: runModelUsed,
          dropped: rawFindings.length - afterDefense.length,
          kept: afterDefense.length,
        });
      }
      if (
        docAnalysis.analysis_result === "findings_found" &&
        rawFindings.length > 0 &&
        afterDefense.length === 0
      ) {
        logDevBrandAnalysisFailure({
          reason: "findings_found_but_empty_after_validation",
          prompt_version: BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
          model_used: runModelUsed,
          raw_findings_count: rawFindings.length,
        });
        throw attachAnalysisStructureCode(
          "Salida IA inválida: los hallazgos no cumplen el contrato mínimo (campos clave vacíos o incompletos).",
        );
      }

      // Guardrail de calidad (meta-frases en proposed_inclusion, falsos contradicts, etc.).
      // Si descarta todos los hallazgos que SÍ pasaron la capa anterior, NO es error estructural:
      // el run sigue como succeeded con 0 facts (el lote puede quedar no_useful_findings al agregar).
      const guardrailed = applyBrandDocumentAnalysisGuardrails(
        afterDefense,
        brandRow?.name ?? "Marca",
      );

      if (
        process.env.NODE_ENV === "development" &&
        docAnalysis.analysis_result === "findings_found" &&
        afterDefense.length > guardrailed.length
      ) {
        console.info("[brand-document-analysis] guardrail_meta_discard", {
          before: afterDefense.length,
          after: guardrailed.length,
        });
      }
      if (
        process.env.NODE_ENV === "development" &&
        docAnalysis.analysis_result === "findings_found" &&
        afterDefense.length > 0 &&
        guardrailed.length === 0
      ) {
        console.info(
          "[brand-document-analysis] guardrail_discarded_all_complete_findings (valid zero-yield, not ai_output_structure_invalid)",
          { complete_before_guardrail: afterDefense.length },
        );
      }

      const findingsFromModel = guardrailed;

      const findings = findingsFromModel.filter(
        (f) =>
          !findingDuplicatesBrandResponse(f, responseRows) &&
          !findingDuplicatesStructuredBrandContext(f, {
            offerItems: structuredOfferItems,
            territories: structuredTerritories,
          }),
      );

      const capped = filterAndCapFindings({
        findings,
        index: defIndex,
        existingFingerprints,
        perSectionCounts,
        totalSoFar: totalInserted,
      });

      if (capped.length === 0) {
        await supabase
          .from("brand_document_analysis_runs")
          .update({
            status: "succeeded",
            model_used,
            findings_count: 0,
            useful_sections_count: 0,
            analysis_summary: docAnalysis.analysis_summary,
          })
          .eq("id", runId);
        runsOut.push({
          id: runId,
          brand_document_id: doc.brand_document_id,
          status: "succeeded",
          findings_count: 0,
          error_message: null,
          model_used,
        });
        continue;
      }

      const sortBase = totalInserted;
      const rowsToInsert = capped.map((f, idx) => {
        const fp = buildBrandSourceFactFingerprint({
          proposed_inclusion: f.proposed_inclusion,
          extracted_fact: f.extracted_fact,
          section_key: f.section_key,
          question_key: f.question_key,
        });
        return {
          brand_id: brandId,
          source_type: "document" as const,
          brand_document_id: doc.brand_document_id,
          brand_document_extraction_id: doc.brand_document_extraction_id,
          analysis_batch_id: batchId,
          analysis_run_id: runId,
          section_key: f.section_key,
          module_key: f.module_key,
          question_key: f.question_key,
          relationship_type: f.relationship_type,
          fact_type: f.fact_type,
          source_excerpt: f.source_excerpt,
          source_reference: f.source_reference,
          source_document_name: doc.file_name,
          supporting_documents: [
            { brand_document_id: doc.brand_document_id, file_name: doc.file_name },
          ],
          extracted_fact: f.extracted_fact,
          ai_interpretation: f.ai_interpretation,
          existing_response_summary: f.existing_response_summary,
          proposed_inclusion: f.proposed_inclusion,
          status: "pending_review" as const,
          confidence_score: f.confidence_score,
          dedupe_fingerprint: fp,
          sort_order: sortBase + idx,
        };
      });

      const { data: insertedFacts, error: insFactsErr } = await supabase
        .from("brand_source_facts")
        .insert(rowsToInsert)
        .select("*");

      if (insFactsErr || !insertedFacts) {
        throw new Error(insFactsErr?.message ?? "No se pudieron guardar los hallazgos.");
      }

      const inserted = insertedFacts as BrandSourceFactRow[];
      factsCreated.push(...inserted);
      totalInserted += inserted.length;
      for (const f of capped) {
        batchFindingsSoFar.push({
          section_key: f.section_key,
          proposed_inclusion: f.proposed_inclusion,
        });
      }
      for (const row of inserted) {
        sectionsUsed.add(row.section_key);
      }

      await supabase
        .from("brand_document_analysis_runs")
        .update({
          status: "succeeded",
          model_used,
          findings_count: inserted.length,
          useful_sections_count: new Set(capped.map((c) => c.section_key)).size,
          analysis_summary: docAnalysis.analysis_summary,
        })
        .eq("id", runId);

      runsOut.push({
        id: runId,
        brand_document_id: doc.brand_document_id,
        status: "succeeded",
        findings_count: inserted.length,
        error_message: null,
        model_used,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido al analizar.";
      const errCode =
        e &&
        typeof e === "object" &&
        "code" in e &&
        typeof (e as { code?: unknown }).code === "string"
          ? (e as { code: string }).code
          : null;
      if (errCode === BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE) {
        batchFailureCode = BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE;
      }
      batchFailedMessage = batchFailedMessage ?? msg;
      await supabase
        .from("brand_document_analysis_runs")
        .update({
          status: "failed",
          error_message: msg,
          model_used: runModelUsed,
        })
        .eq("id", runId);
      runsOut.push({
        id: runId,
        brand_document_id: doc.brand_document_id,
        status: "failed",
        findings_count: 0,
        error_message: msg,
        model_used: runModelUsed,
      });
    }
  }

  const analyzedCount = runsOut.filter((r) => r.status === "succeeded").length;
  const failedCount = runsOut.filter((r) => r.status === "failed").length;
  const batchStatus =
    analyzedCount === 0 && failedCount > 0 ? "failed" : "succeeded";

  const section_counts: Record<string, number> = {};
  for (const f of factsCreated) {
    section_counts[f.section_key] = (section_counts[f.section_key] ?? 0) + 1;
  }

  const responseCode =
    batchStatus === "failed" &&
    batchFailureCode === BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE
      ? BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE
      : undefined;

  const summaryParts: string[] = [];
  if (factsCreated.length > 0) {
    summaryParts.push(
      `Se propusieron ${factsCreated.length} hallazgos para revisión en ${sectionsUsed.size} secciones.`,
    );
  } else if (failedCount === 0 && analyzedCount > 0) {
    summaryParts.push(
      `${BRAND_ANALYSIS_NO_USEFUL_PRIMARY}\n\n${BRAND_ANALYSIS_NO_USEFUL_HINT}`,
    );
  } else {
    summaryParts.push(
      "No se generaron hallazgos en este lote (revisa errores por documento si aplica).",
    );
  }
  if (failedCount > 0) {
    summaryParts.push(`${failedCount} documento(s) tuvieron error en el análisis.`);
  }

  let batchAnalysisResult: BrandDocumentAnalysisResultCode | null = null;
  if (batchStatus === "succeeded" && analyzedCount > 0) {
    batchAnalysisResult =
      factsCreated.length > 0 ? "findings_found" : "no_useful_findings";
  }

  await supabase
    .from("brand_document_analysis_batches")
    .update({
      status: batchStatus,
      analyzed_documents_count: analyzedCount,
      skipped_documents_count: skipped.length,
      findings_count: factsCreated.length,
      useful_sections_count: sectionsUsed.size,
      analysis_summary: summaryParts.join(" "),
      error_message: batchStatus === "failed" ? batchFailedMessage : null,
      model_used: runsOut.find((r) => r.model_used)?.model_used ?? null,
    })
    .eq("id", batchId);

  const factsResponse = factsCreated.map((f) => ({
    id: f.id,
    section_key: f.section_key,
    module_key: f.module_key,
    question_key: f.question_key,
    relationship_type: f.relationship_type,
    fact_type: f.fact_type,
    extracted_fact: f.extracted_fact,
    ai_interpretation: f.ai_interpretation,
    existing_response_summary: f.existing_response_summary,
    proposed_inclusion: f.proposed_inclusion,
    source_document_name: f.source_document_name,
    source_excerpt: f.source_excerpt,
    status: f.status,
  }));

  return NextResponse.json({
    ok: batchStatus === "succeeded",
    code: responseCode,
    analysis_result: batchAnalysisResult,
    empty_findings:
      batchAnalysisResult === "no_useful_findings"
        ? {
            primary: BRAND_ANALYSIS_NO_USEFUL_PRIMARY,
            hint: BRAND_ANALYSIS_NO_USEFUL_HINT,
          }
        : null,
    batch: {
      id: batchId,
      status: batchStatus,
      documents_count: toAnalyze.length,
      analyzed_documents_count: analyzedCount,
      skipped_documents_count: skipped.length,
      findings_count: factsCreated.length,
      useful_sections_count: sectionsUsed.size,
      prompt_version: BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION,
      analysis_summary: summaryParts.join(" "),
      error_message: batchStatus === "failed" ? batchFailedMessage : null,
      analysis_result: batchAnalysisResult,
    },
    runs: runsOut.map((r) => ({
      id: r.id,
      brand_document_id: r.brand_document_id,
      status: r.status,
      findings_count: r.findings_count,
      error_message: r.error_message,
    })),
    facts_created: factsResponse,
    skipped_documents: skipped,
    section_counts,
  });
}
