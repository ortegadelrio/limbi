"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandDocumentsClient } from "@/components/brands/brand-documents-client";
import { BrandQuestionBlock } from "@/components/brands/questionnaire/brand-question-block";
import { BrandQuestionnaireIntro } from "@/components/brands/questionnaire/brand-questionnaire-intro";
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
import { cn } from "@/lib/utils";
import type {
  BrandDocumentListRow,
  BrandOfferNature,
  BrandResponseAnswerType,
  BrandResponseRow,
  QuestionDefinitionRow,
} from "@/types/database";

type Props = { brandId: string };

function isAnswered(
  def: QuestionDefinitionRow,
  draft: BrandAnswerDraft,
): boolean {
  if (draft.kind === "single_choice") return draft.value.trim().length > 0;
  if (draft.kind === "multi_choice") return draft.values.length > 0;
  return draft.text.trim().length > 0;
}

export function BrandQuestionnaireShell({ brandId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brandName, setBrandName] = useState<string | null>(null);
  const [offerNature, setOfferNature] = useState<BrandOfferNature | null>(null);
  const [definitions, setDefinitions] = useState<QuestionDefinitionRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, BrandAnswerDraft>>({});
  const [brandDocuments, setBrandDocuments] = useState<BrandDocumentListRow[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showCompletionCelebration, setShowCompletionCelebration] =
    useState(false);

  const sections = useMemo(
    () => groupBrandQuestionDefinitionsBySection(definitions),
    [definitions],
  );

  const extendedSections = useMemo((): BrandQuestionSectionGroup[] => {
    if (!offerNature) return [];
    return [
      ...sections,
      { section_key: "material_context", questions: [] },
    ];
  }, [sections, offerNature]);

  const answeredCount = useMemo(() => {
    return definitions.filter((d) => {
      const dr = drafts[d.question_key] ?? defaultDraftForQuestion(d);
      return isAnswered(d, dr);
    }).length;
  }, [definitions, drafts]);

  const lastQuestionSectionIndex =
    sections.length > 0 ? sections.length - 1 : -1;

  useEffect(() => {
    if (extendedSections.length === 0) return;
    if (activeSectionIndex >= extendedSections.length) {
      setActiveSectionIndex(extendedSections.length - 1);
    }
  }, [activeSectionIndex, extendedSections.length]);

  useEffect(() => {
    if (loading || extendedSections.length === 0) return;
    if (searchParams.get("step") === "material_context") {
      setShowCompletionCelebration(false);
      setActiveSectionIndex(extendedSections.length - 1);
    }
  }, [loading, searchParams, extendedSections.length]);

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
        const nature = b.offer_nature ?? null;
        setOfferNature(nature);
        if (!nature) {
          setDefinitions([]);
          setDrafts({});
          setBrandDocuments([]);
          setLoading(false);
          return;
        }

        const qd = await fetch(
          `/api/question-definitions?journey_type=brand&offer_nature=${encodeURIComponent(nature)}`,
        );
        if (!qd.ok) {
          const j = await qd.json().catch(() => ({}));
          throw new Error(
            typeof j.error === "string" ? j.error : "Error al cargar preguntas.",
          );
        }
        const qj = await qd.json();
        const defs = qj.definitions as QuestionDefinitionRow[];
        if (cancelled) return;
        setDefinitions(defs);

        const rr = await fetch(`/api/brands/${brandId}/responses`);
        if (!rr.ok) {
          const j = await rr.json().catch(() => ({}));
          throw new Error(
            typeof j.error === "string"
              ? j.error
              : "Error al cargar respuestas.",
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
        setDrafts(nextDrafts);

        const docsRes = await fetch(`/api/brands/${brandId}/documents`, {
          credentials: "include",
        });
        if (!cancelled && docsRes.ok) {
          const docsJson = (await docsRes.json().catch(() => ({}))) as {
            documents?: BrandDocumentListRow[];
          };
          setBrandDocuments(docsJson.documents ?? []);
        }
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
  }, [brandId]);

  const activeSection = extendedSections[activeSectionIndex];
  const onMaterialStep = activeSection?.section_key === "material_context";
  const hasProcessingDocument = brandDocuments.some(
    (d) => d.processing_status === "processing",
  );

  const selectSection = useCallback(
    (index: number) => {
      setShowCompletionCelebration(false);
      setActiveSectionIndex(index);
      const sec = extendedSections[index];
      if (sec?.section_key === "material_context") {
        router.replace(
          `/brands/${brandId}/questionnaire?step=material_context`,
          { scroll: false },
        );
      } else {
        router.replace(`/brands/${brandId}/questionnaire`, { scroll: false });
      }
    },
    [extendedSections, router, brandId],
  );

  const saveCurrentSection = useCallback(async () => {
    if (!offerNature || !activeSection || activeSection.questions.length === 0) {
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
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
      let savedOk = false;
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
        savedOk = true;
        setSaveMessage((m) =>
          m ? `${m} Cambios guardados.` : "Cambios guardados.",
        );
      } else if (skipped.length === activeSection.questions.length) {
        savedOk = true;
        setSaveMessage("Sección sin campos editables aquí; avanzamos.");
      }
      if (savedOk && sections.length > 0) {
        if (activeSectionIndex < lastQuestionSectionIndex) {
          setActiveSectionIndex((i) => i + 1);
          router.replace(`/brands/${brandId}/questionnaire`, { scroll: false });
        } else if (activeSectionIndex === lastQuestionSectionIndex) {
          setActiveSectionIndex(sections.length);
          router.replace(
            `/brands/${brandId}/questionnaire?step=material_context`,
            { scroll: false },
          );
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
    lastQuestionSectionIndex,
    offerNature,
    router,
    sections.length,
  ]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-limbi-muted">
        Cargando cuestionario…
      </div>
    );
  }

  if (!offerNature) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Card className={cn(limbiDocumentCardClass, "border-limbi-border")}>
          <CardHeader>
            <CardTitle className="text-lg text-limbi-text">
              Naturaleza de oferta requerida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-limbi-muted">
            <p>
              Esta marca necesita una naturaleza de oferta antes de responder el
              cuestionario.
            </p>
            <Button variant="outline" className={limbiOutlineButtonClass} asChild>
              <Link href={`/brands/${brandId}`}>Volver a la marca</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && definitions.length === 0) {
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
          sections={extendedSections}
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

        {showIntro ? <BrandQuestionnaireIntro /> : null}

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
                Pueden volver a editar cualquier parte del cuestionario o subir más
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
                onDocumentsChange={(docs) => setBrandDocuments(docs)}
              />
            ) : (
              <Card className={cn(limbiDocumentCardClass, "border-limbi-border")}>
                <CardContent className="space-y-8 p-6 sm:p-8">
                  {activeSection?.questions.map((def) => (
                    <BrandQuestionBlock
                      key={def.question_key}
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
