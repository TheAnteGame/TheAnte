// Shared console primitives — instrumentation, not decoration (art §7).

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 border border-[color:var(--color-border)]">
      <h2 className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] px-4 py-2 font-[family-name:var(--font-display)] text-sm font-bold uppercase text-[color:var(--color-chrome)]">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: "gold" | "loss" }) {
  return (
    <div className="flex flex-col">
      <span className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{label}</span>
      <span
        className={`nums text-lg font-semibold ${
          accent === "gold"
            ? "text-[color:var(--color-gold)]"
            : accent === "loss"
              ? "text-[color:var(--color-loss)]"
              : "text-[color:var(--color-text-hi)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export const inputCls =
  "bg-[color:var(--color-surface-2)] px-3 py-1.5 text-sm text-[color:var(--color-text-hi)] outline-none " +
  "placeholder:text-[color:var(--color-text-low)] focus:outline-2 focus:outline-[color:var(--color-chrome)]";

export const thCls = "px-2 py-1.5 text-left text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-text-low)]";
export const tdCls = "px-2 py-1.5 text-sm";
