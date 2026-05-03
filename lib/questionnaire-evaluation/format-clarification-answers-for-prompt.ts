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
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n---\n\n");
}
