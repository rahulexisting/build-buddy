import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const missionSchema = z.object({
  day: z.number(),
  title: z.string(),
  passed: z.boolean().optional(),
  skipped: z.boolean().optional(),
  attempts: z.number().optional(),
});

const candidateSchema = z.object({
  member: z.object({
    id: z.string(),
    name: z.string(),
    jobRole: z.string(),
    yearsExperience: z.number(),
    education: z.string(),
    status: z.string(),
  }),
  missions: z.array(missionSchema).max(60),
  signals: z
    .object({
      commitDays: z.number(),
      missionsCompleted: z.number(),
      missionsFirstTry: z.number(),
    })
    .default({ commitDays: 0, missionsCompleted: 0, missionsFirstTry: 0 }),
});

const bodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  candidate: candidateSchema.optional(),
  message: z.string().min(1).max(4000).optional(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });

export const Route = createFileRoute("/api/interview")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "Invalid request", details: parsed.error.issues }, 400);
        }
        const { sessionId, candidate, message } = parsed.data;

        const { startInterview, continueInterview } = await import(
          "@/lib/interview-engine.server"
        );

        try {
          if (candidate) {
            return json(await startInterview(sessionId, candidate));
          }
          if (!message) {
            return json({ error: "Provide `candidate` to start or `message` to continue" }, 400);
          }
          const result = await continueInterview(sessionId, message);
          if ("notFound" in result) {
            return json({ error: "Unknown sessionId. Start with a `candidate` payload." }, 404);
          }
          return json(result);
        } catch (error) {
          const status = (error as { status?: number }).status;
          const msg = error instanceof Error ? error.message : "Interview failed";
          console.error(msg);
          if (status === 429) return json({ error: "Rate limited, please retry shortly." }, 429);
          if (status === 402)
            return json({ error: "AI credits exhausted. Add credits to continue." }, 402);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});