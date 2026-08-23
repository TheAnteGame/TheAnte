import { RuleBookQA } from "@/components/dash/RuleBookQA";

// LOCAL PREVIEW HARNESS — segment layout 404s this in production.
export const dynamic = "force-dynamic";

export default function FaqPreview() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <RuleBookQA />
    </main>
  );
}
