"use client";

import type { QuestionDefinitionRow } from "@/types/database";
import type { BrandAnswerDraft } from "@/lib/brand-answers/serialize-parse";
import { BrandChoiceOptionGrid } from "@/components/brands/questionnaire/brand-choice-option-grid";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  definition: QuestionDefinitionRow;
  draft: BrandAnswerDraft;
  onDraftChange: (next: BrandAnswerDraft) => void;
  disabled?: boolean;
};

export function BrandQuestionBlock({
  definition,
  draft,
  onDraftChange,
  disabled,
}: Props) {
  const { question_text, help_text, answer_type, options, is_required } =
    definition;

  const labelId = `q-${definition.question_key}`;

  const unsupported = (
    <p className="text-sm text-limbi-muted">
      Este tipo de pregunta ({answer_type}) aún no tiene editor en esta versión.
    </p>
  );

  const hasChoiceOptions = options.length > 0;

  return (
    <div className="space-y-2">
      <div id={labelId} className="block">
        <span className="text-sm font-medium text-limbi-text">
          {question_text}
          {is_required ? (
            <span className="text-limbi-muted"> · obligatoria</span>
          ) : null}
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
          options={options}
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
        <BrandChoiceOptionGrid
          mode="multi"
          options={options}
          selectedValues={
            draft.kind === "multi_choice" ? draft.values : []
          }
          onToggle={(value) => {
            const cur =
              draft.kind === "multi_choice" ? [...draft.values] : [];
            const next = cur.includes(value)
              ? cur.filter((v) => v !== value)
              : [...cur, value];
            onDraftChange({ kind: "multi_choice", values: next });
          }}
          disabled={disabled}
          labelledBy={labelId}
        />
      ) : null}

      {answer_type === "multi_choice" && !hasChoiceOptions ? unsupported : null}

      {answer_type !== "textarea" &&
      answer_type !== "text" &&
      answer_type !== "url" &&
      answer_type !== "single_choice" &&
      answer_type !== "multi_choice"
        ? unsupported
        : null}
    </div>
  );
}
