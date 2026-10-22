import { PageSkeleton } from "@/components/ui/PageSkeleton";

// Shown the instant this page is clicked, while the server builds it (D-118).
export default function Loading() {
  return <PageSkeleton layout="two-column" />;
}
