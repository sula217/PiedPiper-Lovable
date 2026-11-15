"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  rankVoices,
  recognitionConstructor,
  speakableText,
  speechError,
  type Recognizer,
} from "@/lib/speech";

export function VoiceInput({
  value,
  onChange,
  onRecordingChange,
  disabled = false,
  reply,
}: {
  value: string;
  onChange: (value: string) => void;
  onRecordingChange: (active: boolean) => void;
  disabled?: boolean;
  reply: string;
}) {
  const [micConsent, setMicConsent] = useState(false),
    [recording, setRecording] = useState(false),
    [interim, setInterim] = useState(""),
    [error, setError] = useState(""),
    [spoken, setSpoken] = useState(false),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [voiceURI, setVoiceURI] = useState(""),
    [rate, setRate] = useState(1),
    [speaking, setSpeaking] = useState(false);
  // Voices load asynchronously in most browsers.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const ranked = rankVoices(window.speechSynthesis.getVoices?.() ?? []);
      setVoices(ranked);
      setVoiceURI((v) => v || ranked[0]?.voiceURI || "");
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () =>
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);
  const recognition = useRef<Recognizer | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef(value),
    change = useRef(onChange),
    recordingChange = useRef(onRecordingChange);
  useEffect(() => {
    current.current = value;
    change.current = onChange;
    recordingChange.current = onRecordingChange;
  }, [value, onChange, onRecordingChange]);
  useEffect(
    () => () => {
      const r = recognition.current;
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.abort();
      }
      if (timer.current) clearTimeout(timer.current);
      window.speechSynthesis?.cancel();
    },
    [],
  );
  // Opt-in playback only for the latest Piper reply. Never speak the transcript.
  useEffect(() => {
    if (
      !spoken ||
      !reply ||
      recording ||
      disabled ||
      !("speechSynthesis" in window)
    )
      return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speakableText(reply));
    const voice = voices.find((v) => v.voiceURI === voiceURI);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-US";
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    return () => {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [reply, spoken, recording, disabled, voices, voiceURI, rate]);
  function stop() {
    recognition.current?.stop();
    if (timer.current) clearTimeout(timer.current);
  }
  function clear() {
    const r = recognition.current;
    recognition.current = null;
    if (r) {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      r.abort();
    }
    if (timer.current) clearTimeout(timer.current);
    setRecording(false);
    onRecordingChange(false);
    setInterim("");
    setError("");
    onChange("");
    current.current = "";
  }
  function start() {
    setError("");
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setError(
        "Speech recognition is not available in this browser. Continue in the text box below; your conversation stays intact.",
      );
      return;
    }
    if (!window.isSecureContext) {
      setError(
        "Microphone input needs HTTPS or localhost. You can continue by typing.",
      );
      return;
    }
    window.speechSynthesis?.cancel();
    const r = new Constructor();
    recognition.current = r;
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    // Rebuild from result indices: services may revise earlier interim results.
    const prefix = current.current.trim();
    let captured = "",
      latest = "";
    r.onresult = (event) => {
      const final: string[] = [],
        pending: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        (result.isFinal ? final : pending).push(result[0].transcript);
      }
      captured = final.join(" ").trim();
      latest = pending.join(" ").trim();
      setInterim(latest);
      change.current(
        [prefix, captured].filter(Boolean).join(" ").slice(0, 2500),
      );
    };
    r.onerror = (event) => {
      if (recognition.current !== r) return;
      setError(speechError(event.error));
      r.onend?.();
      r.abort();
    };
    r.onend = () => {
      if (recognition.current !== r) return;
      recognition.current = null;
      if (latest)
        change.current(
          [prefix, captured, latest].filter(Boolean).join(" ").slice(0, 2500),
        );
      setRecording(false);
      recordingChange.current(false);
      setInterim("");
      if (timer.current) clearTimeout(timer.current);
    };
    try {
      r.start();
      setRecording(true);
      onRecordingChange(true);
      timer.current = setTimeout(() => {
        r.stop();
        setError(
          "Recording stopped at 90 seconds. Review your transcript and continue when ready.",
        );
      }, 90000);
    } catch {
      recognition.current = null;
      setError(
        "The microphone could not start. Please try again or type your answer.",
      );
    }
  }
  return (
    <section
      className={`voice-input ${recording ? "is-recording" : ""}`}
      aria-label="Voice onboarding"
    >
      <div className="voice-stage">
        <span className="voice-wave" aria-hidden="true">
          {WAVE.map((h, i) => (
            <i
              key={i}
              style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
            />
          ))}
        </span>
        <Button
          type="button"
          className="voice-mic"
          variant={recording ? "destructive" : "default"}
          disabled={disabled || !micConsent}
          onClick={recording ? stop : start}
        >
          {recording ? <Square size={26} /> : <Mic size={30} />}
          <span className="voice-mic-label">
            {recording ? "Stop recording" : "Talk to Piper"}
          </span>
        </Button>
        <span className="voice-wave" aria-hidden="true">
          {WAVE.map((h, i) => (
            <i
              key={i}
              style={{
                height: `${WAVE[WAVE.length - 1 - i]}%`,
                animationDelay: `${i * 70}ms`,
              }}
            />
          ))}
        </span>
      </div>
      {recording ? (
        <p role="status" className="recording-status">
          <span className="status-dot" />
          Recording… speak naturally · stop to review before sending
          <Elapsed />
        </p>
      ) : (
        <p className="voice-hint">
          {micConsent
            ? "Press the microphone and talk about your life, values and what you’re looking for."
            : "Allow microphone use below to talk instead of typing."}
        </p>
      )}
      {interim && (
        <p className="voice-interim" aria-live="polite">
          Live transcript (not final): {interim}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="voice-controls">
        <label className="check-label">
          <input
            type="checkbox"
            checked={micConsent}
            disabled={recording}
            onChange={(e) => setMicConsent(e.target.checked)}
          />
          I consent to microphone use and my browser’s speech service processing
          fictional speech.
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={spoken}
            onChange={(e) => setSpoken(e.target.checked)}
          />
          <Volume2 size={14} />
          Read Piper’s responses aloud (browser voice)
        </label>
        {spoken && (
          <div className="voice-settings">
            {voices.length > 1 && (
              <label>
                Voice
                <select
                  value={voiceURI}
                  onChange={(e) => setVoiceURI(e.target.value)}
                >
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Speed
              <select
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              >
                <option value={0.9}>Relaxed</option>
                <option value={1}>Normal</option>
                <option value={1.15}>Brisk</option>
              </select>
            </label>
            <span className="voice-state" role="status">
              {speaking
                ? "Piper is speaking…"
                : voices.length
                  ? "Waiting for Piper’s next reply"
                  : "No English browser voice found — replies stay text-only"}
            </span>
          </div>
        )}
        <div className="voice-buttons">
          {spoken && (
            <button
              type="button"
              className="text-link"
              onClick={() => window.speechSynthesis?.cancel()}
            >
              Stop spoken response
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={disabled}
            onClick={clear}
          >
            Clear transcript
          </Button>
        </div>
      </div>
      <p className="fine-print">
        Speech becomes text in the box below; nothing is sent to Gemini until
        you press Send. Your browser may send audio to its speech provider. This
        app does not retain raw audio.
      </p>
    </section>
  );
}

const WAVE = [18, 34, 52, 30, 64, 42, 80, 46, 60, 28, 44, 22];

/** Recording timer; mounted only while recording. */
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="voice-timer">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}
