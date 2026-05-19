"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandDocumentsClient } from "@/components/brands/brand-documents-client";
import {
  BrandAudienceTerritoriesBlock,
  payloadFromTerritoryDrafts,
  territoryDraftsFromRows,
  type TerritoryDraft,
} from "@/components/brands/questionnaire/brand-audience-territories-block";
import { BrandOfferItemsBlock, offerItemDraftsFromRows, payloadFromOfferItemDrafts, type OfferItemDraft } from "@/components/brands/questionnaire/brand-offer-items-block";
import { BrandOfferNatureCards } from "@/components/brands/questionnaire/brand-offer-nature-cards";
import { BrandQuestionBlock } from "@/components/brands/questionnaire/brand-question-block";
import { BrandQuestionnaireActiveBaseNotice } from "@/components/brands/questionnaire/brand-questionnaire-active-base-notice";
import { BrandQuestionnaireIntro } from "@/components/brands/questionnaire/brand-questionnaire-intro";
import { BrandQuestionnaireStaleMaintenanceBanner } from "@/components/brands/questionnaire/brand-questionnaire-stale-maintenance-banner";
import { BrandQuestionSectionNav } from "@/components/brands/questionnaire/brand-question-section-nav";
import { BrandQuestionnaireProgress } from "@/components/brands/questionnaire/brand-questionnaire-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import {
  defaultDraftForQuestion,
  parseBrandAnswer,
  type BrandAnswerDraft,
  serializeBrandAnswer,
} from "@/lib/brand-answers/serialize-parse";
import {
  groupBrandQuestionDefinitionsBySection,
  type BrandQuestionSectionGroup,
} from "@/lib/questions/get-brand-question-definitions";
import { buildBrandQuestionnaireShellSections } from "@/lib/questions/build-brand-questionnaire-shell-sections";
import { cn } from "@/lib/utils";
import type {
  BrandDocumentListRow,
  BrandOfferNature,
  BrandResponseAnswerType,
  BrandResponseRow,
  QuestionDefinitionRow,
} from "@/types/database";

type Props = {
  brandId: string;
  /** True si existen bases activas consolidadas (knowledge + limbic). */
  hasActiveBases?: boolean;
  /** True si hay diagnóstico activo succeeded (habilita «Mejorar con Limbi»). */
  hasActiveDiagnosis?: boolean;
};

const MATERIAL_EMBEDDED_TITLE = "Material de contexto y fuentes de marca";
const MATERIAL_EMBEDDED_INTRO =
  "Este paso es opcional. Puedes subir documentos que ayuden a entender mejor la marca. Limbi los leerá como contexto, pero no tomará su contenido como verdad automática. Primero propondrá hallazgos y tú decidirás qué incluir.";
const MATERIAL_EMBEDDED_FUTURE =
  "Más adelante podrás conectar otras fuentes de marca.";

function isAnswered(def: QuestionDefinitionRow, draft: BrandAnswerDraft): boolean {
  if (draft.kind === "single_choice") return draft.value.trim().length > 0;
  if (draft.kind === "multi_choice") return draft.values.length > 0;
  return draft.text.trim().length > 0;
}

function validateRequiredForQuestions(
  questions: QuestionDefinitionRow[],
  drafts: Record<string, BrandAnswerDraft>,
): string | null {
  for (const def of questions) {
    if (!def.is_required) continue;
    const d = drafts[def.question_key] ?? defaultDraftForQuestion(def);
    if (def.answer_type === "single_choice") {
      if (d.kind !== "single_choice" || !d.value.trim()) {
        return "Completa las preguntas obligatorias de esta sección antes de guardar.";
      }
    } else if (def.answer_type === "multi_choice") {
      if (d.kind !== "multi_choice" || d.values.length === 0) {
        return "Completa las preguntas obligatorias de esta sección antes de guardar.";
      }
    } else if (
      def.answer_type === "textarea" ||
      def.answer_type === "text" ||
      def.answer_type === "url"
    ) {
      if (d.kind !== "text" || !d.text.trim()) {
        return "Completa las preguntas obligatorias de esta sección antes de guardar.";
      }
    }
  }
  return null;
}

export function BrandQuestionnaireShell({
  brandId,
  hasActiveBases = false,
  hasActiveDiagnosis = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brandName, setBrandName] = useState<string | null>(null);
  const [offerNature, setOfferNature] = useState<BrandOfferNature | null>(null);
  const [pickerNature, setPickerNature] = useState<BrandOfferNature | null>(null);
  const [definitions, setDefinitions] = useState<QuestionDefinitionRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, BrandAnswerDraft>>({});
  const [offerItemDrafts, setOfferItemDrafts] = useState<OfferItemDraft[]>([]);
  const [territoryDrafts, setTerritoryDrafts] = useState<TerritoryDraft[]>([]);
  const [brandDocuments, setBrandDocuments] = useState<BrandDocumentListRow[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showCompletionCelebration, setShowCompletionCelebration] =
    useState(false);
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [staleBanner, setStaleBanner] = useState<{
    showDiagnosisCta: boolean;
    showBasesCta: boolean;
  } | null>(null);

  const definitionGroups = useMemo(
    () => groupBrandQuestionDefinitionsBySection(definitions),
    [definitions],
  );

  const sectionPlan = useMemo((): BrandQuestionSectionGroup[] => {
    const base = buildBrandQuestionnaireShellSections(definitionGroups);
    return base.map((s) => {
      if (s.isOfferInventory) {
        return { ...s, navCount: offerItemDrafts.length };
      }
      if (s.isMaterialContext) {
        return { ...s, navCount: brandDocuments.length };
      }
      return { ...s, navCount: s.questions.length };
    });
  }, [definitionGroups, offerItemDrafts.length, brandDocuments.length]);

  const answeredCount = useMemo(() => {
    return definitions.filter((d) => {
      const dr = drafts[d.question_key] ?? defaultDraftForQuestion(d);
      return isAnswered(d, dr);
    }).length;
  }, [definitions, drafts]);

  const lastNavigableIndex =
    sectionPlan.length > 0 ? sectionPlan.length - 1 : 0;

  const loadCatalogForNature = useCallback(
    async (nature: BrandOfferNature) => {
      const [qd, rr, oi, tr, docsRes] = await Promise.all([
        fetch(
          `/api/question-definitions?journey_type=brand&offer_nature=${encodeURIComponent(nature)}`,
        ),
        fetch(`/api/brands/${brandId}/responses`),
        fetch(`/api/brands/${brandId}/offer-items`),
        fetch(`/api/brands/${brandId}/audience-territories`),
        fetch(`/api/brands/${brandId}/documents`, { credentials: "include" }),
      ]);

      if (!qd.ok) {
        const j = await qd.json().catch(() => ({}));
        throw new Error(
          typeof j.error === "string" ? j.error : "Error al cargar preguntas.",
        );
      }
      const qj = await qd.json();
      const defs = qj.definitions as QuestionDefinitionRow[];

      if (!rr.ok) {
        const j = await rr.json().catch(() => ({}));
        throw new Error(
          typeof j.error === "string" ? j.error : "Error al cargar respuestas.",
        );
      }
      const rj = await rr.json();
      const responses = rj.responses as BrandResponseRow[];
      const byKey = new Map(responses.map((r) => [r.question_key, r]));
      const nextDrafts: Record<string, BrandAnswerDraft> = {};
      for (const d of defs) {
        const row = byKey.get(d.question_key);
        if (row) {
          nextDrafts[d.question_key] = parseBrandAnswer(
            d.answer_type as BrandResponseAnswerType,
            row.answer_value,
          );
        } else {
          nextDrafts[d.question_key] = defaultDraftForQuestion(d);
        }
      }

      if (oi.ok) {
        const oj = (await oi.json()) as { items?: unknown };
        setOfferItemDrafts(
          offerItemDraftsFromRows((oj.items ?? []) as import("@/types/database").BrandOfferItemRow[]),
        );
      } else {
        setOfferItemDrafts([]);
      }

      if (tr.ok) {
        const tj = (await tr.json()) as { territories?: unknown };
        setTerritoryDrafts(
          territoryDraftsFromRows(
            (tj.territories ?? []) as import("@/types/database").BrandAudienceTerritoryRow[],
          ),
        );
      } else {
        setTerritoryDrafts([]);
      }

      if (docsRes.ok) {
        const docsJson = (await docsRes.json().catch(() => ({}))) as {
          documents?: BrandDocumentListRow[];
        };
        setBrandDocuments(docsJson.documents ?? []);
      }

      setDefinitions(defs);
      setDrafts(nextDrafts);
    },
    [brandId],
  );

  useEffect(() => {
    setPickerNature(offerNature);
  }, [offerNature]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const br = await fetch(`/api/brands/${brandId}`);
        if (!br.ok) {
          if (br.status === 404) throw new Error("Marca no encontrada.");
          const j = await br.json().catch(() => ({}));
          throw new Error(
            typeof j.error === "string" ? j.error : "Error al cargar la marca.",
          );
        }
        const bj = await br.json();
        const b = bj.brand;
        if (cancelled) return;
        setBrandName(b.name);
        const nature = (b.offer_nature ?? null) as BrandOfferNature | null;
        setOfferNature(nature);
        if (!nature) {
          setDefinitions([]);
          setDrafts({});
          setOfferItemDrafts([]);
          setTerritoryDrafts([]);
          setBrandDocuments([]);
          setLoading(false);
          return;
        }
        await loadCatalogForNature(nature);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId, loadCatalogForNature]);

  useEffect(() => {
    if (sectionPlan.length === 0) return;
    if (activeSectionIndex >= sectionPlan.length) {
      setActiveSectionIndex(sectionPlan.length - 1);
    }
  }, [activeSectionIndex, sectionPlan.length]);

  useEffect(() => {
    if (loading || sectionPlan.length === 0) return;
    if (searchParams.get("step") === "material_context") {
      setShowCompletionCelebration(false);
      const idx = sectionPlan.findIndex((s) => s.isMaterialContext);
      if (idx >= 0) setActiveSectionIndex(idx);
      return;
    }
    const sectionParam = searchParams.get("section")?.trim();
    if (sectionParam) {
      setShowCompletionCelebration(false);
      const idx = sectionPlan.findIndex((s) => s.section_key === sectionParam);
      if (idx >= 0) setActiveSectionIndex(idx);
    }
  }, [loading, searchParams, sectionPlan]);

  const activeSection = sectionPlan[activeSectionIndex];
  const onMaterialStep = Boolean(activeSection?.isMaterialContext);
  const hasProcessingDocument = brandDocuments.some(
    (d) => d.processing_status === "processing",
  );

  const selectSection = useCallback(
    (index: number) => {
      setShowCompletionCelebration(false);
      setActiveSectionIndex(index);
      const sec = sectionPlan[index];
      if (sec?.isMaterialContext) {
        router.replace(
          `/brands/${brandId}/questionnaire?step=material_context`,
          { scroll: false },
        );
      } else if (sec?.section_key) {
        router.replace(
          `/brands/${brandId}/questionnaire?section=${encodeURIComponent(sec.section_key)}`,
          { scroll: false },
        );
      } else {
        router.replace(`/brands/${brandId}/questionnaire`, { scroll: false });
      }
    },
    [sectionPlan, router, brandId],
  );

  const saveCurrentSection = useCallback(async () => {
    if (!offerNature || !activeSection) return;

    if (activeSection.isMaterialContext) return;

    setSaving(true);
    setSaveMessage(null);
    setError(null);

    try {
      if (activeSection.isOfferInventory) {
        const sorted = [...offerItemDrafts].sort(
          (a, b) => a.display_order - b.display_order,
        );
        const incomplete = sorted.some((it) => it.title.trim().length === 0);
        if (incomplete) {
          throw new Error(
            "Cada ítem de oferta necesita título o debes eliminar la fila vacía.",
          );
        }
        const payload = { items: payloadFromOfferItemDrafts(offerItemDrafts) };
        const res = await fetch(`/api/brands/${brandId}/offer-items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          items?: import("@/types/database").BrandOfferItemRow[];
        };
        if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la oferta.");
        if (data.items) {
          setOfferItemDrafts(offerItemDraftsFromRows(data.items));
        }
        setSaveMessage("Oferta guardada.");
      } else {
        const reqErr = validateRequiredForQuestions(
          activeSection.questions,
          drafts,
        );
        if (reqErr) throw new Error(reqErr);

        if (activeSection.showOfferNaturePicker && pickerNature && pickerNature !== offerNature) {
          const pr = await fetch(`/api/brands/${brandId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offer_nature: pickerNature }),
          });
          const pj = await pr.json().catch(() => ({}));
          if (!pr.ok) {
            throw new Error(
              typeof pj.error === "string" ? pj.error : "No se pudo actualizar la naturaleza de marca.",
            );
          }
          setOfferNature(pickerNature);
          await loadCatalogForNature(pickerNature);
        }

        if (activeSection.showTerritoriesBlock) {
          const sortedT = [...territoryDrafts].sort(
            (a, b) => a.display_order - b.display_order,
          );
          const incompleteT = sortedT.some((t) => !t.name.trim());
          if (incompleteT) {
            throw new Error(
              "Cada territorio necesita nombre o debes eliminar la fila vacía.",
            );
          }
          const tPayload = {
            territories: payloadFromTerritoryDrafts(territoryDrafts),
          };
          const tr = await fetch(`/api/brands/${brandId}/audience-territories`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tPayload),
          });
          const tj = await tr.json().catch(() => ({}));
          if (!tr.ok) {
            throw new Error(
              typeof tj.error === "string" ? tj.error : "No se pudieron guardar los territorios.",
            );
          }
          if (tj.territories) {
            setTerritoryDrafts(
              territoryDraftsFromRows(tj.territories as import("@/types/database").BrandAudienceTerritoryRow[]),
            );
          }
        }

        const answers: { question_definition_id: string; answer_value: unknown }[] =
          [];
        const skipped: string[] = [];
        for (const def of activeSection.questions) {
          const draft = drafts[def.question_key] ?? defaultDraftForQuestion(def);
          const ser = serializeBrandAnswer(
            def.answer_type as BrandResponseAnswerType,
            draft,
            def.options,
          );
          if ("error" in ser) {
            skipped.push(def.question_key);
            continue;
          }
          answers.push({
            question_definition_id: def.id,
            answer_value: ser.answer_value,
          });
        }
        if (skipped.length > 0) {
          setSaveMessage(`Omitidas (sin editor en UI): ${skipped.join(", ")}.`);
        }
        if (answers.length > 0) {
          const res = await fetch(`/api/brands/${brandId}/responses`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers }),
          });
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            throw new Error(data.error ?? "No se pudo guardar.");
          }
        }
        setSaveMessage((m) =>
          m ? `${m} Cambios guardados.` : "Cambios guardados.",
        );
        if (hasActiveDiagnosis) {
          setStaleBanner({
            showDiagnosisCta: true,
            showBasesCta: hasActiveBases,
          });
        }
      }

      if (activeSectionIndex < lastNavigableIndex) {
        setActiveSectionIndex((i) => i + 1);
        const next = sectionPlan[activeSectionIndex + 1];
        if (next?.isMaterialContext) {
          router.replace(
            `/brands/${brandId}/questionnaire?step=material_context`,
            { scroll: false },
          );
        } else {
          router.replace(`/brands/${brandId}/questionnaire`, { scroll: false });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [
    activeSection,
    activeSectionIndex,
    brandId,
    drafts,
    lastNavigableIndex,
    loadCatalogForNature,
    offerItemDrafts,
    offerNature,
    pickerNature,
    router,
    sectionPlan,
    territoryDrafts,
    hasActiveDiagnosis,
    hasActiveBases,
  ]);

  const onCompleteNatureGate = useCallback(async () => {
    if (!pickerNature) {
      setError("Elige un tipo de marca para continuar.");
      return;
    }
    setGateSubmitting(true);
    setError(null);
    try {
      const pr = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_nature: pickerNature }),
      });
      const pj = await pr.json().catch(() => ({}));
      if (!pr.ok) {
        throw new Error(
          typeof pj.error === "string"
            ? pj.error
            : "No se pudo guardar la naturaleza de marca.",
        );
      }
      setOfferNature(pickerNature);
      setLoading(true);
      await loadCatalogForNature(pickerNature);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGateSubmitting(false);
      setLoading(false);
    }
  }, [brandId, loadCatalogForNature, pickerNature]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-limbi-muted">
        Cargando cuestionario…
      </div>
    );
  }

  if (!offerNature) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
          <Link href={`/brands/${brandId}`}>
            <ArrowLeft className="size-4" aria-hidden />
            Marca
          </Link>
        </Button>
        <BrandQuestionnaireIntro hasActiveDiagnosis={hasActiveDiagnosis} />
        <Card className={cn(limbiDocumentCardClass, "mt-8 border-limbi-border")}>
          <CardHeader>
            <CardTitle id="gate-nature-title" className="text-lg text-limbi-text">
              ¿Qué tipo de marca estás construyendo o describiendo?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-limbi-muted">
              Esto no es una respuesta del cuestionario: define la naturaleza en el perfil
              de la marca y sirve para adaptar etiquetas y el inventario de oferta.
            </p>
            <BrandOfferNatureCards
              value={pickerNature}
              onSelect={setPickerNature}
              disabled={gateSubmitting}
              labelledBy="gate-nature-title"
            />
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              className={limbiPrimaryButtonClass}
              disabled={gateSubmitting || !pickerNature}
              onClick={() => void onCompleteNatureGate()}
            >
              {gateSubmitting ? "Guardando…" : "Continuar al cuestionario"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && definitions.length === 0 && offerNature) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
        <Button variant="outline" className={cn(limbiOutlineButtonClass, "mt-6")} asChild>
          <Link href={`/brands/${brandId}`}>Volver a la marca</Link>
        </Button>
      </div>
    );
  }

  const showIntro = !showCompletionCelebration && !onMaterialStep;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-64">
        <Button variant="ghost" size="sm" className="mb-4 gap-1 rounded-xl" asChild>
          <Link href={`/brands/${brandId}`}>
            <ArrowLeft className="size-4" aria-hidden />
            Marca
          </Link>
        </Button>
        <BrandQuestionSectionNav
          sections={sectionPlan}
          activeIndex={activeSectionIndex}
          onSelectSection={selectSection}
          disabled={saving}
          materialContextDocumentCount={brandDocuments.length}
        />
      </aside>
      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">
            Cuestionario de marca
          </h1>
          {brandName ? (
            <p className="mt-1 text-sm text-limbi-muted">{brandName}</p>
          ) : null}
        </div>

        {hasActiveBases ? <BrandQuestionnaireActiveBaseNotice brandId={brandId} /> : null}

        {staleBanner ? (
          <BrandQuestionnaireStaleMaintenanceBanner
            brandId={brandId}
            showDiagnosisCta={staleBanner.showDiagnosisCta}
            showBasesCta={staleBanner.showBasesCta}
          />
        ) : null}

        {showIntro ? (
          <BrandQuestionnaireIntro hasActiveDiagnosis={hasActiveDiagnosis} />
        ) : null}

        {!showCompletionCelebration ? (
          <BrandQuestionnaireProgress
            answeredCount={answeredCount}
            totalCount={definitions.length}
            sectionLabel={
              activeSection
                ? brandQuestionnaireSectionLabelEs(activeSection.section_key)
                : undefined
            }
          />
        ) : null}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {saveMessage && !showCompletionCelebration ? (
          <p className="text-sm text-[var(--limbi-green)]">{saveMessage}</p>
        ) : null}

        {showCompletionCelebration ? (
          <Card className={cn(limbiDocumentCardClass, "border-limbi-border")}>
            <CardHeader>
              <CardTitle className="text-lg text-limbi-text">
                Listo: guardaste el cuestionario y el material de contexto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-limbi-muted">
              <p>
                Puedes volver a editar cualquier parte del cuestionario o subir más
                documentos desde el menú de secciones a la izquierda.
              </p>
              <p>
                Más adelante, la generación del diagnóstico de marca estará
                disponible desde esta misma área.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button className={limbiPrimaryButtonClass} asChild>
                  <Link href={`/brands/${brandId}`}>Volver a la marca</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {onMaterialStep ? (
              <BrandDocumentsClient
                brandId={brandId}
                brandName={brandName ?? "Marca"}
                initialDocuments={brandDocuments}
                mode="embedded"
                embeddedSectionTitle={MATERIAL_EMBEDDED_TITLE}
                embeddedSectionIntro={MATERIAL_EMBEDDED_INTRO}
                embeddedFutureNote={MATERIAL_EMBEDDED_FUTURE}
                onDocumentsChange={(docs) => setBrandDocuments(docs)}
              />
            ) : (
              <Card className={cn(limbiDocumentCardClass, "border-limbi-border")}>
                <CardContent className="space-y-8 p-6 sm:p-8">
                  {activeSection?.showOfferNaturePicker ? (
                    <div className="space-y-4 border-b border-limbi-border pb-8">
                      <div id="identity-nature-title">
                        <h2 className="text-base font-semibold text-limbi-text">
                          ¿Qué tipo de marca estás construyendo o describiendo?
                        </h2>
                        <p className="mt-1 text-sm text-limbi-muted">
                          Se guarda en el perfil de la marca, no como respuesta del
                          cuestionario. Puedes cambiarlo aquí si hace falta.
                        </p>
                      </div>
                      <BrandOfferNatureCards
                        value={pickerNature}
                        onSelect={setPickerNature}
                        disabled={saving}
                        labelledBy="identity-nature-title"
                      />
                    </div>
                  ) : null}

                  {activeSection?.isOfferInventory && offerNature ? (
                    <div className="space-y-2">
                      <h2 className="text-base font-semibold text-limbi-text">Oferta</h2>
                      <BrandOfferItemsBlock
                        offerNature={offerNature}
                        items={offerItemDrafts}
                        onItemsChange={setOfferItemDrafts}
                        disabled={saving}
                      />
                    </div>
                  ) : null}

                  {activeSection?.showTerritoriesBlock ? (
                    <BrandAudienceTerritoriesBlock
                      territories={territoryDrafts}
                      onTerritoriesChange={setTerritoryDrafts}
                      disabled={saving}
                    />
                  ) : null}

                  {activeSection?.section_key === "brand_limbic_base" &&
                  activeSection.questions.length > 0 ? (
                    <p className="rounded-xl border border-limbi-border/80 bg-limbi-bg-soft/50 p-4 text-sm leading-relaxed text-limbi-muted">
                      Estas elecciones no se usarán de forma literal. Limbi las interpreta
                      como señales de tono, ritmo, atmósfera y energía de la marca.
                    </p>
                  ) : null}

                  {activeSection?.questions.map((def) => (
                    <BrandQuestionBlock
                      key={def.question_key}
                      brandId={brandId}
                      definition={def}
                      draft={
                        drafts[def.question_key] ?? defaultDraftForQuestion(def)
                      }
                      onDraftChange={(next) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [def.question_key]: next,
                        }))
                      }
                      disabled={saving}
                      hasActiveDiagnosis={hasActiveDiagnosis}
                      onFieldImproveApplied={() => {
                        if (hasActiveDiagnosis) {
                          setStaleBanner({
                            showDiagnosisCta: true,
                            showBasesCta: hasActiveBases,
                          });
                        }
                      }}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
            {onMaterialStep ? (
              <div className="space-y-3">
                {hasProcessingDocument ? (
                  <p className="text-xs text-limbi-muted">
                    Puedes volver a la marca. La lectura del documento continuará y el estado se
                    actualizará cuando esté lista.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className={limbiPrimaryButtonClass}
                    onClick={() => {
                      setShowCompletionCelebration(true);
                      router.replace(`/brands/${brandId}`, {
                        scroll: false,
                      });
                    }}
                  >
                    Terminar y volver a la marca
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={limbiOutlineButtonClass}
                    onClick={() => {
                      const input = document.querySelector<HTMLInputElement>(
                        "#brand-material-upload-input",
                      );
                      input?.click();
                    }}
                  >
                    Subir otro documento
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className={limbiPrimaryButtonClass}
                  disabled={saving || !activeSection}
                  onClick={() => void saveCurrentSection()}
                >
                  {saving ? "Guardando…" : "Guardar esta sección"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
