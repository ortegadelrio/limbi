import { QuestionnaireClarifyClient } from "@/components/projects/questionnaire-clarify-client";

export default async function QuestionnaireClarifyPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <QuestionnaireClarifyClient projectId={projectId} />
    </div>
  );
}
