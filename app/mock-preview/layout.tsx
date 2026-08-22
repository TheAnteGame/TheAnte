import { notFound } from "next/navigation";

// One gate for every harness page, current and future (review D-036): a page added
// under /mock-preview without its own NODE_ENV check still 404s in production, so a
// forgotten line can never ship service-role reads on a public route.
export default function MockPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
