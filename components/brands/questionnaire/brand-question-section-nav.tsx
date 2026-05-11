"use client";

import type { BrandQuestionSectionGroup } from "@/lib/questions/get-brand-question-definitions";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import { cn } from "@/lib/utils";

type Props = {
  sections: BrandQuestionSectionGroup[];
  activeIndex: number;
  onSelectSection: (index: number) => void;
  disabled?: boolean;
};

export function BrandQuestionSectionNav({
  sections,
  activeIndex,
  onSelectSection,
  disabled,
}: Props) {
  return (
    <nav aria-label="Secciones del cuestionario" className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
        Secciones
      </p>
      <ul className="flex flex-col gap-1">
        {sections.map((s, idx) => {
          const label = brandQuestionnaireSectionLabelEs(s.section_key);
          const active = idx === activeIndex;
          return (
            <li key={s.section_key}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectSection(idx)}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-limbi-bg-soft font-medium text-limbi-text ring-1 ring-limbi-border"
                    : "text-limbi-muted hover:bg-limbi-bg-soft/80 hover:text-limbi-text",
                )}
              >
                <span className="mr-2 tabular-nums text-limbi-muted">
                  {idx + 1}.
                </span>
                {label}
                <span className="ml-1 text-xs text-limbi-muted">
                  ({s.questions.length})
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
