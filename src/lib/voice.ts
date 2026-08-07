const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"] as const;

/** Deterministic interviewer voice per candidate, so each person hears a consistent voice. */
export function voiceForCandidate(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return VOICES[hash % VOICES.length]!;
}

export async function speak(text: string, voice: string, signal?: AbortSignal): Promise<HTMLAudioElement> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, voice }),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) throw new Error(`Speech failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const audio = new Audio(url);
  audio.addEventListener("ended", () => URL.revokeObjectURL(url));
  await audio.play();
  return audio;
}