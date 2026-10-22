import { notFound } from "next/navigation";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

// LOCAL PREVIEW HARNESS — never ships (404 in production). The loading screens
// (D-118) flash by too fast to inspect on a real navigation; this holds one still.
//   /mock-preview/skeleton            → the single-column board/profile skeleton
//   /mock-preview/skeleton?layout=two → the dashboard skeleton
export default async function SkeletonPreview({ searchParams }: { searchParams: Promise<{ layout?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { layout } = await searchParams;
  return <PageSkeleton layout={layout === "two" ? "two-column" : "single"} />;
}
