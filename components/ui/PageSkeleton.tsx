// The instant answer to a click (D-118). A route with a loading.tsx shows this the
// moment a link is pressed — and Next prefetches it ahead of time — so the page
// responds at once while the server builds the real one. Before it, nothing changed on
// screen until the whole server render finished; owner: "it doesn't even have a load
// bar". No data, no client JS: shapes only, in the site's own panels.

function Bar({ w, h = "h-3" }: { w: string; h?: string }) {
  return <span className={`block ${h} ${w} rounded-sm bg-[color:var(--color-surface-3)]`} />;
}

function PanelShape({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel">
      <div className="panel-head px-4 py-3">
        <Bar w="w-32" />
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        {Array.from({ length: rows }, (_, i) => (
          <Bar key={i} w={i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-5/6" : "w-2/3"} />
        ))}
      </div>
    </div>
  );
}

/** "two-column" mirrors the dashboard; "single" suits the board, results and profiles. */
export function PageSkeleton({ layout = "single" }: { layout?: "single" | "two-column" }) {
  return (
    <div className="min-h-screen" role="status" aria-live="polite" aria-label="Loading">
      <div className="mx-auto max-w-6xl animate-pulse px-4 pt-5 motion-reduce:animate-none sm:px-6">
        <div className="rail flex items-center justify-between px-6 py-4">
          <Bar w="w-24" h="h-8" />
          <Bar w="w-40" />
        </div>
        <div className="mt-6 flex flex-col gap-6 pb-24">
          <Bar w="w-full" h="h-16" />
          {layout === "two-column" ? (
            <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[62fr_38fr]">
              <div className="flex flex-col gap-6">
                <PanelShape rows={8} />
                <PanelShape rows={5} />
              </div>
              <div className="flex flex-col gap-6">
                <PanelShape rows={6} />
                <PanelShape rows={4} />
              </div>
            </div>
          ) : (
            <>
              <PanelShape rows={7} />
              <PanelShape rows={5} />
            </>
          )}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
