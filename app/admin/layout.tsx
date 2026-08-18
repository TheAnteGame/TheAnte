import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommissioner } from "@/lib/admin";

// The console: same visual language, calmer and denser (art §7). 404, not 403 —
// the route's existence is not advertised (ANTE-ADMIN §2).

export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Ops"],
  ["/admin/week", "Week"],
  ["/admin/players", "Players"],
  ["/admin/content", "Content"],
  ["/admin/feeds", "Feeds"],
  ["/admin/promo", "Promo"],
  ["/admin/notifications", "Notifications"],
  ["/admin/settings", "Settings"],
  ["/admin/audit", "Audit"],
  ["/admin/season-close", "Season close"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCommissioner();
  if (!ctx) notFound();

  return (
    <div className="flex min-h-screen">
      <nav className="w-44 shrink-0 border-r border-[color:var(--color-border)] px-3 py-6">
        <Link href="/dashboard" className="mb-6 block px-2 font-[family-name:var(--font-display)] font-bold italic text-[color:var(--color-chrome)]">
          ANTE
        </Link>
        <p className="mb-2 px-2 text-[10px] uppercase tracking-widest text-[color:var(--color-gold)]">Commissioner</p>
        <ul className="space-y-1">
          {NAV.map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                className="block px-2 py-1.5 text-sm text-[color:var(--color-text-mid)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text-hi)]"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 px-6 py-6">{children}</div>
    </div>
  );
}
