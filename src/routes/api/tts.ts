import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
] as const;

const bodySchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.enum(VOICES).default("alloy"),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
            status: 500,
            headers: { "content-type": "application/json", ...cors },
          });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json", ...cors },
          });
        }

        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid request" }), {
            status: 400,
            headers: { "content-type": "application/json", ...cors },
          });
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: parsed.data.text,
            voice: parsed.data.voice,
            response_format: "mp3",
            instructions:
              "You are a calm, professional technical interviewer. Speak naturally and conversationally, at a measured pace.",
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          console.error(`TTS failed [${res.status}]: ${body}`);
          return new Response(JSON.stringify({ error: `TTS failed (${res.status})` }), {
            status: res.status,
            headers: { "content-type": "application/json", ...cors },
          });
        }

        return new Response(res.body, {
          headers: { "content-type": "audio/mpeg", ...cors },
        });
      },
    },
  },
});