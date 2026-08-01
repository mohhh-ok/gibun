import { useEffect, useState } from "react";
import type { ChimeraVoice } from "./templates";

const MALE_NAME_HINTS = ["otoya", "hattori", "ichiro", "male"];
const FEMALE_NAME_HINTS = ["kyoko", "sayaka", "o-ren", "haruka", "female"];

function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function useJapaneseVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!hasSpeechSynthesis()) return;
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("ja")));
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices, { once: true });
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  return voices;
}

function pickVoice(jaVoices: SpeechSynthesisVoice[], prefer: "male" | "female"): SpeechSynthesisVoice | undefined {
  const hints = prefer === "male" ? MALE_NAME_HINTS : FEMALE_NAME_HINTS;
  const matched = jaVoices.find((v) => hints.some((hint) => v.name.toLowerCase().includes(hint)));
  return matched ?? jaVoices[0];
}

export function speakText(
  text: string,
  voice: ChimeraVoice,
  jaVoices: SpeechSynthesisVoice[],
  onEnd?: () => void,
): void {
  if (!hasSpeechSynthesis()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = voice.pitch;
  utterance.rate = voice.rate;
  const selected = pickVoice(jaVoices, voice.prefer);
  if (selected) utterance.voice = selected;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (!hasSpeechSynthesis()) return;
  window.speechSynthesis.cancel();
}
