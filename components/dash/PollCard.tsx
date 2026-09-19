"use client";

import { useState, useTransition } from "react";
import { castVote } from "@/app/actions/poll";

// The poll in the room (D-095). Before voting: the question and its options as
// buttons. After voting, or once closed: bars with whole percentages and nothing
// else — no names, ever, in the room. A vote can be changed until the poll closes.

export interface PollView {
  id: string;
  question: string;
  options: string[];
  percents: number[];
  total: number;
  myVote: number | null;
  phase: "open" | "closed";
  closesLabel: string;
}

export function PollCard({
  poll,
  copy,
}: {
  poll: PollView;
  copy: { eyebrow: string; closes: string; closed: string; votes: string; change: string; yourVote: string };
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [changing, setChanging] = useState(false);
  const showBars = poll.phase === "closed" || (poll.myVote !== null && !changing);

  const vote = (i: number) =>
    start(async () => {
      setError("");
      const r = await castVote(poll.id, i);
      if (!r.ok) setError(r.error ?? "");
      else setChanging(false);
    });

  return (
    <section aria-label={poll.question} className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-gold)]">{copy.eyebrow}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--color-text-hi)]">{poll.question}</p>

      {showBars ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {poll.options.map((label, i) => (
            <li key={i} className="text-xs">
              <span className="flex items-baseline justify-between gap-2">
                <span className={i === poll.myVote ? "font-semibold text-[color:var(--color-text-hi)]" : "text-[color:var(--color-text-mid)]"}>
                  {label}
                  {i === poll.myVote ? <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[color:var(--color-gold)]">{copy.yourVote}</span> : null}
                </span>
                <span className="nums text-[color:var(--color-text-mid)]">{poll.percents[i]}%</span>
              </span>
              <span className="mt-0.5 block h-1.5 w-full bg-[color:var(--color-surface-3)]">
                <span
                  className={`block h-full ${i === poll.myVote ? "bg-[color:var(--color-gold)]" : "bg-[color:var(--color-text-low)]"}`}
                  style={{ width: `${poll.percents[i]}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {poll.options.map((label, i) => (
            <button
              key={i}
              type="button"
              disabled={pending}
              onClick={() => vote(i)}
              className="chamfer border border-[color:var(--color-border)] px-3 py-1.5 text-left text-sm text-[color:var(--color-text-hi)] hover:border-[color:var(--color-gold)] hover:bg-[color:var(--color-surface-3)] disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[11px] text-[color:var(--color-text-low)]">
        <span>{copy.votes.replace("{n}", String(poll.total))}</span>
        <span>{poll.phase === "closed" ? copy.closed : copy.closes.replace("{when}", poll.closesLabel)}</span>
        {poll.phase === "open" && poll.myVote !== null && !changing && (
          <button type="button" onClick={() => setChanging(true)} className="underline underline-offset-2 hover:text-[color:var(--color-text-mid)]">
            {copy.change}
          </button>
        )}
      </p>
      {error && <p role="alert" className="mt-1 text-xs text-[color:var(--color-loss)]">{error}</p>}
    </section>
  );
}
