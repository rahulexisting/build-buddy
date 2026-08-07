import candidatesData from "@/data/candidates.json";
import type { Candidate } from "@/lib/interview-types";

const candidates = (candidatesData as { candidates: Candidate[] }).candidates;

function stats(c: Candidate) {
  const missions = c.missions ?? [];
  return {
    days: missions.length,
    skipped: missions.filter((m) => m.skipped).length,
    failed: missions.filter((m) => m.passed === false).length,
  };
}

export function CandidatePicker({ onSelect }: { onSelect: (c: Candidate) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {candidates.map((c) => {
        const s = stats(c);
        return (
          <button
            key={c.member.id}
            onClick={() => onSelect(c)}
            className="panel group text-left p-5 transition-all hover:border-primary/60 hover:shadow-[0_0_0_1px_var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{c.member.name}</h3>
                <p className="text-sm text-muted-foreground">{c.member.jobRole}</p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.member.id}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs">
              <div>
                <dt className="text-muted-foreground">days</dt>
                <dd className="text-signal">{s.days}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">skipped</dt>
                <dd className="text-warn">{s.skipped}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">failed</dt>
                <dd className="text-destructive">{s.failed}</dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-muted-foreground">
              {c.member.yearsExperience} yrs · {c.member.education} ·{" "}
              {c.signals?.commitDays ?? 0} commit days
            </p>
            <p className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Start interview →
            </p>
          </button>
        );
      })}
    </div>
  );
}