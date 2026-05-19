import {
  buildOperationalSummarySections,
  formatOperationalSummaryListItems,
  hasOperationalSummaryContent,
  type OperationalSummarySection,
} from "@/lib/brainstormer/operational-summary";
import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";

const EMPTY_MESSAGE =
  "Todavía no hay resumen operativo. A medida que conversemos, Limbi irá ordenando el reto, decisiones y próximos pasos.";

export function OperationalSummaryCard(props: {
  progress: BrainstormerSessionProgressPayload;
}) {
  const hasContent = hasOperationalSummaryContent(props.progress);
  const sections = buildOperationalSummarySections(props.progress);

  return (
    <details
      open={hasContent}
      className="mb-4 rounded-xl border border-limbi-border bg-limbi-bg-soft/30 px-3 py-2 text-sm"
    >
      <summary className="cursor-pointer font-medium text-limbi-text">Resumen operativo</summary>
      {!hasContent ? (
        <p className="mt-2 text-xs leading-relaxed text-limbi-muted">{EMPTY_MESSAGE}</p>
      ) : (
        <dl className="mt-3 space-y-3">
          {sections.map((section) => (
            <SummarySection key={section.id} section={section} />
          ))}
        </dl>
      )}
    </details>
  );
}

function SummarySection(props: { section: OperationalSummarySection }) {
  const { section } = props;
  const items =
    section.variant === "list" ? formatOperationalSummaryListItems(section.value) : null;

  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-limbi-muted">
        {section.label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-limbi-text">
        {items && items.length > 1 ? (
          <ul className="list-inside list-disc space-y-0.5 pl-0.5">
            {items.map((item, i) => (
              <li key={`${section.id}-${i}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="whitespace-pre-wrap">{section.value}</p>
        )}
      </dd>
    </div>
  );
}

