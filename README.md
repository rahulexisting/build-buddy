# AI Interview Agent

My submission for Challenge 2 of the ABTalks AI Cohort. It's an interviewer that
actually reads the candidate's record before it opens its mouth: which of the 31
curriculum days they passed, which they skipped, how many attempts each mission
took. Then it runs a real conversation on top of that — and speaks it out loud.

I wrote most of this by hand and used Lovable for the parts that are faster to
describe than to type (roughly a 70/30 split — see [Credits](#credits) below).

## Why it works the way it does

A generic "tell me about vector databases" bot is useless here. The interesting
signal is in the gaps: if someone breezed through Day 9 on embeddings but
skipped Day 17 on agent tool-calling, that's exactly where the questions should
land. So the engine builds a per-candidate question plan from the mission
history first, and the model only ever sees curriculum objectives it's allowed
to ask about. Less hallucinated syllabus, more grounded probing.

The follow-up logic is deliberately unforgiving: a vague answer gets pushed on
once before the interview moves along, the same way a human interviewer would
rather dig than tick a box.

## What it does

- Multi-turn conversational interview, one question at a time
- Minimum 8 questions spanning at least 4 different curriculum days (enforced
  server-side, hard stop at 12 so it can't ramble forever)
- Adaptive follow-ups generated from the candidate's actual answer
- Full context retained for the whole session
- Structured feedback at the end: summary, strengths, gaps, recommended next steps
- Voice output — each candidate gets a deterministic interviewer voice, with a
  mute toggle in the UI

## The endpoint

`POST /api/interview` — stateless client, session state keyed by `sessionId`.

First call (opens the interview, send the candidate profile):

```json
{
  "sessionId": "abc-123",
  "candidate": {
    "member": { "id": "m_01", "name": "...", "jobRole": "...", "yearsExperience": 3, "education": "...", "status": "active" },
    "missions": [{ "day": 9, "title": "Embeddings", "passed": true, "attempts": 1 }],
    "signals": { "commitDays": 21, "missionsCompleted": 24, "missionsFirstTry": 15 }
  }
}
```

Every call after that:

```json
{ "sessionId": "abc-123", "message": "Candidate's answer goes here" }
```

The response carries the next interviewer turn, the days covered so far, and —
once the interview closes — the structured feedback object. `POST /api/tts`
turns any interviewer turn into MP3 audio.

Quick smoke test:

```sh
curl -X POST http://localhost:8080/api/interview \
  -H 'content-type: application/json' \
  -d '{"sessionId":"test-1","candidate":'"$(jq -c '.[0]' src/data/candidates.json)"'}'
```

## Layout

```text
src/lib/interview-engine.server.ts   interview state machine, retrieval, prompting
src/lib/interview-types.ts           shared types for the API contract
src/routes/api/interview.ts          POST /api/interview (Zod-validated)
src/routes/api/tts.ts                POST /api/tts  (voice output)
src/components/CandidatePicker.tsx   pick one of the 20 synthetic candidates
src/components/InterviewChat.tsx     the chat + audio playback UI
src/data/                            curriculum.json, candidates.json
```

## Running it

```sh
npm i
npm run dev     # http://localhost:8080
```

Stack: TanStack Start, React, TypeScript, Tailwind. Model calls go through the
Lovable AI gateway (Gemini Flash for the interview loop), so there's no API key
to paste in.

## Notes and limits

- Session state lives in memory — fine for a demo, swap for a store if this ever
  needs to survive a restart. Persistence was out of scope for the challenge.
- Curriculum and candidate data are the synthetic sets provided with the brief.
- No auth, no accounts — also out of scope.

## Credits

~70% written by me: the interview engine, the retrieval and question-planning
logic, the API contract, the prompt design, and the tuning it took to stop the
model from ending the interview early or repeating itself.

~30% [Lovable](https://lovable.dev): scaffolding, the chat and candidate-picker
UI, the TTS route wiring, and general boilerplate. Worth being upfront about —
it saved me a day, and the interesting decisions were still mine to make.
