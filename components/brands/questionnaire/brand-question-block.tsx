"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { QuestionDefinitionRow } from "@/types/database";
import type { BrandAnswerDraft } from "@/lib/brand-answers/serialize-parse";
import { canShowLimbiFieldImprove } from "@/lib/brands/brand-field-improve-eligibility";
import { orderedOptionsForQuestionnaireUi } from "@/lib/brands/questionnaire-choice-option-order";
import { applyExclusiveMultiChoiceRules } from "@/lib/brands/exclusive-multi-choice";
import { BrandChoiceOptionGrid } from "@/components/brands/questionnaire/brand-choice-option-grid";
import { BrandQuestionFieldImproveDialog } from "@/components/brands/questionnaire/brand-question-field-improve-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { limbiOutlineButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";

type Props = {
  brandId: string;
  definition: QuestionDefinitionRow;
  draft: BrandAnswerDraft;
  onDraftChange: (next: BrandAnswerDraft) => void;
  disabled?: boolean;
  hasActiveDiagnosis?: boolean;
  onFieldImproveApplied?: (args: { questionKey: string; proposedText: string }) => void;
};

export function BrandQuestionBlock({
  brandId,
  definition,
  draft,
  onDraftChange,
  disabled,
  hasActiveDiagnosis = false,
  onFieldImproveApplied,
}: Props) {
  const [improveOpen, setImproveOpen] = useState(false);
  const { question_text, help_text, answer_type, options, is_required } =
    definition;

  const choiceOptions = orderedOptionsForQuestionnaireUi(
    definition.question_key,
    options,
  );

  const labelId = `q-${definition.question_key}`;

  const unsupported = (
    <p className="text-sm text-limbi-muted">
      Este tipo de pregunta ({answer_type}) aún no tiene editor en esta versión.
    </p>
  );

  const hasChoiceOptions = choiceOptions.length > 0;
  const isLimbicSection = definition.section_key === "brand_limbic_base";
  const hasOtherOption = choiceOptions.some((o) => o.value === "other");
  const multiDraft = draft.kind === "multi_choice" ? draft : null;
  const showOtherField =
    answer_type === "multi_choice" &&
    hasOtherOption &&
    multiDraft &&
    multiDraft.values.includes("other");

  const showFieldImprove = canShowLimbiFieldImprove({
    hasActiveDiagnosis,
    answerType: answer_type,
    sectionKey: definition.section_key,
  });

  return (
    <div className="space-y-2">
      <div id={labelId} className="block">
        <span className="text-sm font-medium text-limbi-text">
          {question_text}
          {is_required ? (
            <span className="text-limbi-muted"> · obligatoria</span>
          ) : (
            <span className="text-limbi-muted"> · opcional</span>
          )}
        </span>
        {help_text ? (
          <span className="mt-1 block text-sm text-limbi-muted">{help_text}</span>
        ) : null}
      </div>

      {answer_type === "textarea" ? (
        <Textarea
          aria-labelledby={labelId}
          value={draft.kind === "text" ? draft.text : ""}
          onChange={(e) =>
            onDraftChange({ kind: "text", text: e.target.value })
          }
          disabled={disabled}
          rows={4}
          className={cn(
            "rounded-xl border-limbi-border bg-limbi-surface",
            "min-h-[100px] resize-y",
          )}
        />
      ) : null}

      {answer_type === "text" ? (
        <Input
          aria-labelledby={labelId}
          value={draft.kind === "text" ? draft.text : ""}
          onChange={(e) =>
            onDraftChange({ kind: "text", text: e.target.value })
          }
          disabled={disabled}
          className="rounded-xl border-limbi-border bg-limbi-surface"
        />
      ) : null}

      {answer_type === "url" ? (
        <Input
          aria-labelledby={labelId}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://…"
          value={draft.kind === "text" ? draft.text : ""}
          onChange={(e) =>
            onDraftChange({ kind: "text", text: e.target.value })
          }
          disabled={disabled}
          className="rounded-xl border-limbi-border bg-limbi-surface"
        />
      ) : null}

      {answer_type === "single_choice" && hasChoiceOptions ? (
        <BrandChoiceOptionGrid
          mode="single"
          options={choiceOptions}
          selectedValues={
            draft.kind === "single_choice" && draft.value
              ? [draft.value]
              : []
          }
          onToggle={(value) =>
            onDraftChange({ kind: "single_choice", value })
          }
          disabled={disabled}
          labelledBy={labelId}
          visualEmphasis={isLimbicSection ? "limbic" : undefined}
        />
      ) : null}

      {answer_type === "single_choice" && !hasChoiceOptions ? (
        <select
          aria-labelledby={labelId}
          value={draft.kind === "single_choice" ? draft.value : ""}
          onChange={(e) =>
            onDraftChange({ kind: "single_choice", value: e.target.value })
          }
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2 text-sm text-limbi-text",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/40",
          )}
        >
          <option value="">Seleccionar…</option>
        </select>
      ) : null}

      {answer_type === "multi_choice" && hasChoiceOptions ? (
        <>
          <BrandChoiceOptionGrid
            mode="multi"
            options={choiceOptions}
            selectedValues={
              draft.kind === "multi_choice" ? draft.values : []
            }
            onToggle={(value) => {
              const cur =
                draft.kind === "multi_choice" ? [...draft.values] : [];
              const next = applyExclusiveMultiChoiceRules(choiceOptions, cur, value);
              const otherOn = next.includes("other");
              const prevOtherText =
                draft.kind === "multi_choice" ? draft.otherText ?? "" : "";
              onDraftChange({
                kind: "multi_choice",
                values: next,
                otherText: otherOn ? prevOtherText : "",
              });
            }}
            disabled={disabled}
            labelledBy={labelId}
            visualEmphasis={isLimbicSection ? "limbic" : undefined}
          />
          {showOtherField ? (
            <div className="space-y-1 pt-2">
              <label
                htmlFor={`${labelId}-other`}
                className="text-sm font-medium text-limbi-text"
              >
                Especifica cuál
              </label>
              <Input
                id={`${labelId}-other`}
                value={multiDraft?.otherText ?? ""}
                onChange={(e) =>
                  onDraftChange({
                    kind: "multi_choice",
                    values: multiDraft?.values ?? [],
                    otherText: e.target.value,
                  })
                }
                disabled={disabled}
                maxLength={2000}
                className="rounded-xl border-limbi-border bg-limbi-surface"
                placeholder="Breve, en tus palabras"
              />
            </div>
          ) : null}
        </>
      ) : null}

      {answer_type === "multi_choice" && !hasChoiceOptions ? unsupported : null}

      {answer_type !== "textarea" &&
      answer_type !== "text" &&
      answer_type !== "url" &&
      answer_type !== "single_choice" &&
      answer_type !== "multi_choice"
        ? unsupported
        : null}

      {showFieldImprove ? (
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(limbiOutlineButtonClass, "gap-1.5 rounded-xl")}
            disabled={disabled}
            onClick={() => setImproveOpen(true)}
          >
            <Sparkles className="size-3.5 text-limbi-green" aria-hidden />
            Mejorar con Limbi
          </Button>
          <BrandQuestionFieldImproveDialog
            brandId={brandId}
            definition={definition}
            open={improveOpen}
            onOpenChange={setImproveOpen}
            onApplied={({ proposedText }) => {
              onDraftChange({ kind: "text", text: proposedText });
              onFieldImproveApplied?.({
                questionKey: definition.question_key,
                proposedText,
              });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
