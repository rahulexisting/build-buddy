import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, RotateCcw, Loader2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { speak, voiceForCandidate } from "@/lib/voice";
import type { Candidate, Feedback, InterviewResponse } from "@/lib/interview-types";

type ChatMessage = { role: "interviewer" | "candidate"; text: string };

export function InterviewChat({
  candidate,
  onExit,
}: {
  candidate: Candidate;
  onExit: () => void;
}) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [progress, setProgress] = useState({ questionsAsked: 0, daysCovered: [] as number[] });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [audioOn, setAudioOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voice = useMemo(() => voiceForCandidate(candidate.member.id), [candidate.member.id]);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  const say = useCallback(
    async (text: string) => {
      stopAudio();
      setSpeaking(true);
      try {
        const audio = await speak(text, voice);
        audioRef.current = audio;
        audio.addEventListener("ended", () => setSpeaking(false));
      } catch {
        setSpeaking(false);
      }
    },
    [voice, stopAudio],
  );

  useEffect(() => stopAudio, [stopAudio]);

  const post = async (body: Record<string, unknown>) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, ...body }),
      });
      const data = (await res.json()) as InterviewResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setMessages((m) => [...m, { role: "interviewer", text: data.reply }]);
      if (audioOn) void say(data.reply);
      if (data.progress) setProgress(data.progress);
      if (data.done && data.feedback) setFeedback(data.feedback);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void post({ candidate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, feedback]);

  const send = () => {
    const text = input.trim();
    if (!text || busy || feedback) return;
    setMessages((m) => [...m, { role: "candidate", text }]);
    setInput("");
    void post({ message: text });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
      <header className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-base font-semibold">{candidate.member.name}</h2>
          <p className="text-xs text-muted-foreground">
            {candidate.member.jobRole} · {candidate.member.yearsExperience} yrs
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="font-mono text-xs text-muted-foreground">
            <span className="text-primary">{progress.questionsAsked}</span>/8 questions ·{" "}
            <span className="text-primary">{progress.daysCovered.length}</span>/4 days
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (audioOn) stopAudio();
              setAudioOn((v) => !v);
            }}
            aria-label={audioOn ? "Mute interviewer voice" : "Unmute interviewer voice"}
          >
            {audioOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            <span className="font-mono text-[10px] uppercase tracking-widest">{voice}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onExit}>
            <RotateCcw className="size-4" /> New
          </Button>
        </div>
      </header>

      <div className="panel flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "candidate" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "candidate"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3 text-sm"
              }
            >
              {m.role === "interviewer" && (
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                  Interviewer
                </p>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}

        {busy && (
          <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> thinking…
          </p>
        )}
        {speaking && !busy && (
          <p className="flex items-center gap-2 font-mono text-xs text-primary">
            <Volume2 className="size-3.5 animate-pulse" /> speaking…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {feedback && (
          <div className="mt-6 space-y-4 rounded-xl border border-primary/40 bg-surface-2/60 p-5">
            <h3 className="font-display text-lg">Interview feedback</h3>
            <p className="text-sm text-muted-foreground">{feedback.summary}</p>
            {(
              [
                ["Strengths", feedback.strengths, "text-signal"],
                ["Gaps", feedback.gaps, "text-warn"],
                ["Next steps", feedback.next, "text-primary"],
              ] as const
            ).map(([label, items, color]) => (
              <div key={label}>
                <p
                  className={`font-mono text-[10px] uppercase tracking-widest ${color}`}
                >
                  {label}
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {(items ?? []).map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">·</span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!feedback && (
        <div className="panel flex items-end gap-2 p-3">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Answer the interviewer…"
            rows={2}
            className="resize-none border-0 bg-transparent focus-visible:ring-0"
          />
          <Button onClick={send} disabled={busy || !input.trim()} size="icon">
            <Send className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}