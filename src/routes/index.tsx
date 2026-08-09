import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CandidatePicker } from "@/components/CandidatePicker";
import { InterviewChat } from "@/components/InterviewChat";
import type { Candidate } from "@/lib/interview-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Interview Agent · 31-Day AI Cohort" },
      {
        name: "description",
        content:
          "Adaptive, multi-turn technical interviews grounded in each candidate's 31-day AI Cohort learning record, with structured feedback at the end.",
      },
      { property: "og:title", content: "AI Interview Agent · 31-Day AI Cohort" },
      {
        property: "og:description",
        content:
          "Adaptive, multi-turn technical interviews grounded in each candidate's 31-day AI Cohort learning record, with structured feedback at the end.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          ABTalks AI Cohort · POST /api/interview
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">AI Interview Agent</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          An adaptive interviewer that reads a candidate's 31-day cohort record — passed, failed and
          skipped missions — then runs a real multi-turn technical interview and closes with
          structured feedback.
        </p>
      </div>

      {candidate ? (
        <InterviewChat candidate={candidate} onExit={() => setCandidate(null)} />
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Pick a candidate</h2>
          <CandidatePicker onSelect={setCandidate} />
        </section>
      )}
    </main>
  );
}
