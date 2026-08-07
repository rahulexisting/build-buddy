import curriculum from "@/data/curriculum.json";
import type { Candidate, Feedback, InterviewResponse, Mission } from "./interview-types";

type CurriculumDay = {
  day: number;
  title: string;
  type: string;
  tools: string[];
  objectives: string[];
};

const DAYS = (curriculum as { days: CurriculumDay[] }).days;
const MODULES = (curriculum as { modules: { n: number; title: string; days: number[] }[] })
  .modules;

const MIN_QUESTIONS = 8;
const MIN_DAYS = 4;
const MAX_QUESTIONS = 12;

type Turn = { role: "user" | "assistant"; content: string };

type Session = {
  candidate: Candidate;
  turns: Turn[];
  questionsAsked: number;
  daysCovered: number[];
  done: boolean;
  feedback?: Feedback;
  createdAt: number;
};

const sessions = new Map<string, Session>();
const SESSION_TTL = 1000 * 60 * 60 * 3;

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.createdAt > SESSION_TTL) sessions.delete(id);
}

function moduleFor(day: number) {
  return (
    MODULES.find((m) => day >= (m.days[0] ?? 0) && day <= (m.days[1] ?? 0))?.title ?? "General"
  );
}

/** Lightweight retrieval: only the curriculum days this candidate actually touched. */
function retrieveContext(candidate: Candidate) {
  const byDay = new Map<number, Mission>();
  for (const m of candidate.missions ?? []) byDay.set(m.day, m);

  const blocks = [...byDay.keys()]
    .sort((a, b) => a - b)
    .map((day) => {
      const d = DAYS.find((x) => x.day === day);
      const m = byDay.get(day)!;
      const state = m.skipped
        ? "SKIPPED (never attempted)"
        : m.passed === false
          ? `FAILED after ${m.attempts ?? 0} attempts`
          : `passed in ${m.attempts ?? 1} attempt(s)${(m.attempts ?? 1) >= 3 ? " (struggled)" : ""}`;
      return [
        `Day ${day} — ${d?.title ?? m.title} [module: ${moduleFor(day)}] — ${state}`,
        d ? `  tools: ${d.tools.join(", ")}` : "",
        d ? d.objectives.map((o) => `  • ${o}`).join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n");
    });

  return blocks.join("\n\n");
}

function systemPrompt(candidate: Candidate) {
  const m = candidate.member;
  return `You are a senior AI engineer conducting a live, spoken-style technical interview for the ABTalks 31-day AI Cohort. You are talking to ${m.name}, a ${m.jobRole} with ${m.yearsExperience} years of experience (${m.education}).

CANDIDATE LEARNING RECORD (retrieved curriculum context):
${retrieveContext(candidate)}

Engagement signals: ${candidate.signals?.commitDays} commit days, ${candidate.signals?.missionsCompleted} missions completed, ${candidate.signals?.missionsFirstTry} passed first try.

HOW TO INTERVIEW
- Behave like a real human interviewer, never a scripted questionnaire. One question at a time.
- Ground every question in the days above. Probe passed-with-many-attempts and failed days hardest; treat skipped days as gaps you may briefly test conceptually.
- Always react to what the candidate just said before asking the next thing: acknowledge, correct gently, or dig deeper with a follow-up.
- Alternate between conceptual ("why"), practical ("how did you build it"), and trade-off/debugging questions.
- Ask at least ${MIN_QUESTIONS} questions spanning at least ${MIN_DAYS} different curriculum days, then wrap up (hard stop at ${MAX_QUESTIONS}).
- Keep replies short: 2-5 sentences max. No markdown headings, no bullet lists.

OUTPUT
Return json only, matching:
{"reply": string, "targetDay": number|null, "askedQuestion": boolean, "wantToEnd": boolean, "feedback": {"summary": string, "strengths": string[], "gaps": string[], "next": string[]} | null}
"targetDay" = the curriculum day your question is grounded in. "askedQuestion" = true when reply contains a new interview question. Set "wantToEnd" true and fill "feedback" only in the closing turn; strengths/gaps/next hold 2-4 concise, actionable points each and must reference concrete cohort topics.`;
}

type ModelTurn = {
  reply: string;
  targetDay: number | null;
  askedQuestion: boolean;
  wantToEnd: boolean;
  feedback: Feedback | null;
};

async function callModel(session: Session, directive: string): Promise<ModelTurn> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(session.candidate) },
        ...session.turns,
        { role: "system", content: `INTERVIEW STATE: ${directive}` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`AI gateway failed [${res.status}]: ${body}`);
    throw Object.assign(new Error(`AI gateway failed [${res.status}]: ${body}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: Partial<ModelTurn>;
  try {
    parsed = JSON.parse(raw) as Partial<ModelTurn>;
  } catch {
    parsed = { reply: raw, askedQuestion: true, targetDay: null, wantToEnd: false };
  }

  return {
    reply: String(parsed.reply ?? "").trim() || "Could you expand on that a little?",
    targetDay: typeof parsed.targetDay === "number" ? parsed.targetDay : null,
    askedQuestion: parsed.askedQuestion !== false,
    wantToEnd: parsed.wantToEnd === true,
    feedback: parsed.feedback ?? null,
  };
}

function directiveFor(session: Session) {
  const remaining = Math.max(0, MIN_QUESTIONS - session.questionsAsked);
  const daysLeft = Math.max(0, MIN_DAYS - session.daysCovered.length);
  if (session.questionsAsked >= MAX_QUESTIONS) {
    return "You have reached the question limit. Close the interview now: set wantToEnd true and return the full feedback object.";
  }
  if (remaining === 0 && daysLeft === 0) {
    return `Quota met (${session.questionsAsked} questions across days ${session.daysCovered.join(", ")}). You may ask one or two final questions or close the interview now with feedback.`;
  }
  return `Questions asked: ${session.questionsAsked}. Days covered: ${session.daysCovered.join(", ") || "none"}. You still need ${remaining} more question(s) and ${daysLeft} more distinct day(s). Do NOT end yet: wantToEnd must be false and feedback must be null.`;
}

function applyTurn(session: Session, turn: ModelTurn): InterviewResponse {
  session.turns.push({ role: "assistant", content: turn.reply });
  if (turn.askedQuestion) session.questionsAsked += 1;
  if (turn.targetDay && !session.daysCovered.includes(turn.targetDay)) {
    session.daysCovered.push(turn.targetDay);
  }

  const quotaMet =
    session.questionsAsked >= MIN_QUESTIONS && session.daysCovered.length >= MIN_DAYS;
  const hardStop = session.questionsAsked >= MAX_QUESTIONS;
  const end = (turn.wantToEnd && quotaMet) || hardStop;

  if (end) {
    session.done = true;
    session.feedback = turn.feedback ?? {
      summary: `${session.candidate.member.name} completed the interview covering ${session.daysCovered.length} curriculum days.`,
      strengths: ["Engaged with every question asked"],
      gaps: ["Depth could not be fully assessed"],
      next: ["Revisit the cohort days with the highest attempt counts"],
    };
    return {
      reply: turn.reply,
      done: true,
      feedback: session.feedback,
      progress: { questionsAsked: session.questionsAsked, daysCovered: session.daysCovered },
    };
  }

  return {
    reply: turn.reply,
    done: false,
    progress: { questionsAsked: session.questionsAsked, daysCovered: session.daysCovered },
  };
}

export async function startInterview(
  sessionId: string,
  candidate: Candidate,
): Promise<InterviewResponse> {
  sweep();
  const session: Session = {
    candidate,
    turns: [],
    questionsAsked: 0,
    daysCovered: [],
    done: false,
    createdAt: Date.now(),
  };
  sessions.set(sessionId, session);
  session.turns.push({
    role: "user",
    content:
      "[system] The candidate has joined the call. Greet them by name in one or two sentences, mention this is a technical interview based on their cohort work, and ask your first grounded question.",
  });
  const turn = await callModel(session, directiveFor(session));
  return applyTurn(session, turn);
}

export async function continueInterview(
  sessionId: string,
  message: string,
): Promise<InterviewResponse | { notFound: true }> {
  const session = sessions.get(sessionId);
  if (!session) return { notFound: true };
  if (session.done) {
    return {
      reply: "Interview completed.",
      done: true,
      ...(session.feedback ? { feedback: session.feedback } : {}),
      progress: { questionsAsked: session.questionsAsked, daysCovered: session.daysCovered },
    };
  }
  session.turns.push({ role: "user", content: message });
  const turn = await callModel(session, directiveFor(session));
  return applyTurn(session, turn);
}