'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FloppyDisk, Pause, Play, SpinnerGap } from '@phosphor-icons/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_TTS_PROVIDER,
  getDefaultVoice,
  getVoiceOptions,
  type TtsProvider,
} from '@/lib/prompt-defaults';

type PromptsData = {
  agentPrompt: string;
  sessionPrompt: string;
  voice?: string;
  ttsProvider?: TtsProvider;
  source?: string;
};

export default function PromptsPage() {
  const [agentPrompt, setAgentPrompt] = useState('');
  const [sessionPrompt, setSessionPrompt] = useState('');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(DEFAULT_TTS_PROVIDER);
  const [voice, setVoice] = useState(getDefaultVoice(DEFAULT_TTS_PROVIDER));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voiceOptions = getVoiceOptions(ttsProvider);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/prompts', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load');
      const data: PromptsData = await res.json();
      setAgentPrompt(data.agentPrompt ?? '');
      setSessionPrompt(data.sessionPrompt ?? '');
      const provider = data.ttsProvider === 'elevenlabs' ? 'elevenlabs' : 'gemini';
      setTtsProvider(provider);
      const options = getVoiceOptions(provider);
      setVoice(
        data.voice && options.some((v) => v.id === data.voice)
          ? data.voice
          : getDefaultVoice(provider)
      );
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to load prompts',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleProviderChange = (provider: TtsProvider) => {
    stopPreview();
    setTtsProvider(provider);
    setVoice(getDefaultVoice(provider));
  };

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewPlaying(false);
    setPreviewLoading(false);
  };

  const playPreview = async () => {
    if (previewPlaying) {
      stopPreview();
      return;
    }

    if (ttsProvider !== 'elevenlabs') return;

    setPreviewLoading(true);
    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Preview failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPreviewPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPreviewPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
      setPreviewPlaying(true);
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to preview voice',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentPrompt, sessionPrompt, voice, ttsProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save');
      setMessage({
        type: 'success',
        text: 'Prompts and voice saved. The agent will use these on the next session.',
      });
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to save prompts',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="bg-background flex min-h-svh flex-col items-center justify-center gap-4 px-4 py-20">
        <SpinnerGap className="text-muted-foreground size-10 animate-spin" weight="bold" />
        <p className="text-muted-foreground">Loading prompts…</p>
      </main>
    );
  }

  return (
    <main className="bg-background min-h-svh px-4 py-20 pt-24 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="border-border bg-card text-foreground hover:bg-accent flex size-10 items-center justify-center rounded-lg border transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="size-5" weight="bold" />
            </Link>
            <div>
              <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                Agent prompts
              </h1>
              <p className="text-muted-foreground text-sm">
                Edit the role and session prompts used by the LiveKit agent.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <SpinnerGap className="size-4 animate-spin" weight="bold" />
            ) : (
              <FloppyDisk className="size-4" weight="bold" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {message && (
          <div
            role="alert"
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* TTS Provider toggle */}
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">TTS Provider</label>
            <p className="text-muted-foreground mb-3 text-sm">
              Pilih engine suara. Gemini gratis (native audio), ElevenLabs premium (butuh API key).
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  ttsProvider === 'gemini'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent'
                }`}
              >
                Gemini (Gratis)
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('elevenlabs')}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  ttsProvider === 'elevenlabs'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent'
                }`}
              >
                ElevenLabs (Premium)
              </button>
            </div>
            {ttsProvider === 'gemini' && (
              <p className="text-muted-foreground mt-2 text-xs">
                Gemini Native Audio — gratis via Google AI Studio. STT + LLM + TTS all-in-one.
              </p>
            )}
            {ttsProvider === 'elevenlabs' && (
              <p className="text-muted-foreground mt-2 text-xs">
                Pipeline: Groq Whisper (STT) + Gemini Flash text (LLM) + ElevenLabs Flash (TTS).
                Butuh GROQ_API_KEY dan ELEVEN_API_KEY.
              </p>
            )}
          </div>

          {/* Voice selector + preview */}
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Voice</label>
            <p className="text-muted-foreground mb-2 text-sm">
              {ttsProvider === 'gemini'
                ? 'Suara Gemini native audio. Agent akan menggunakan suara ini di sesi berikutnya.'
                : 'Suara ElevenLabs. Klik tombol play untuk preview suara dalam bahasa Indonesia.'}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={voice}
                onValueChange={(v) => {
                  stopPreview();
                  setVoice(v);
                }}
              >
                <SelectTrigger className="border-input bg-card text-foreground w-full max-w-md">
                  <SelectValue placeholder="Select the model voice" />
                </SelectTrigger>
                <SelectContent>
                  {voiceOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} — {v.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {ttsProvider === 'elevenlabs' && (
                <button
                  type="button"
                  onClick={playPreview}
                  disabled={previewLoading}
                  className="border-border bg-card text-foreground hover:bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-50"
                  aria-label={previewPlaying ? 'Stop preview' : 'Play preview'}
                  title={previewPlaying ? 'Stop preview' : 'Preview suara'}
                >
                  {previewLoading ? (
                    <SpinnerGap className="size-4 animate-spin" weight="bold" />
                  ) : previewPlaying ? (
                    <Pause className="size-4" weight="fill" />
                  ) : (
                    <Play className="size-4" weight="fill" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="agent-prompt"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Agent prompt (role / character)
            </label>
            <textarea
              id="agent-prompt"
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
              rows={12}
              className="border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              placeholder="Agent role and personality…"
              spellCheck={false}
            />
          </div>
          <div>
            <label
              htmlFor="session-prompt"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Session prompt (flow, constraints, rubrik)
            </label>
            <textarea
              id="session-prompt"
              value={sessionPrompt}
              onChange={(e) => setSessionPrompt(e.target.value)}
              rows={24}
              className="border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              placeholder="Session flow and rules…"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
