import type {
  ClarificationAnswer,
  ClarificationQuestion,
} from "@/lib/questionnaire-evaluation/schema";

export function formatClarificationAnswersForEvaluationPrompt(
  questions: ClarificationQuestion[],
  answers: ClarificationAnswer[],
): string {
  const byId = new Map(questions.map((q) => [q.id, q] as const));
  const blocks: string[] = [];

  for (const a of answers) {
    const q = byId.get(a.question_id);
    const lines: string[] = [];
    lines.push(`question_id: ${a.question_id}`);
    if (q?.question_text) lines.push(`question_text_es: ${q.question_text}`);
    if (a.selected_option_id && q?.options) {
      const opt = q.options.find((o) => o.id === a.selected_option_id);
      lines.push(
        `selected_option: ${opt?.label?.trim() ?? a.selected_option_id}`,
      );
    }
    const ft = (a.free_text ?? "").trim();
    if (ft.length > 0) lines.push(`free_text_es: ${ft}`);
    if (a.answer_status && a.answer_status !== "normal") {
      lines.push(`answer_status: ${a.answer_status}`);
    }
    if (a.should_update_master !== undefined) {
      lines.push(`should_update_master: ${String(a.should_update_master)}`);
    }
    if (a.confidence_level) {
      lines.push(`confidence_level: ${a.confidence_level}`);
    }
    if (a.strategic_topic && a.strategic_topic.trim().length > 0) {
      lines.push(`strategic_topic_es: ${a.strategic_topic.trim()}`);
    }
    if (a.target_master_fields && a.target_master_fields.length > 0) {
      lines.push(`target_master_fields: ${a.target_master_fields.join(", ")}`);
    }
    if (a.claim_limits && a.claim_limits.trim().length > 0) {
      lines.push(`claim_limits_es: ${a.claim_limits.trim()}`);
    }
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n---\n\n");
}
