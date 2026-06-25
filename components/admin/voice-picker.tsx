'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SpinnerGap } from '@phosphor-icons/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type TtsProvider, getDefaultVoice, getVoiceOptions } from '@/lib/prompt-defaults';

interface VoicePickerProps {
  ttsProvider: TtsProvider;
  voice: string;
  onProviderChange: (provider: TtsProvider) => void;
  onVoiceChange: (voice: string) => void;
}

export function VoicePicker({
  ttsProvider,
  voice,
  onProviderChange,
  onVoiceChange,
}: VoicePickerProps) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voiceOptions = getVoiceOptions(ttsProvider);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewPlaying(false);
    setPreviewLoading(false);
  };

  const handleProviderChange = (provider: TtsProvider) => {
    stopPreview();
    onProviderChange(provider);
    onVoiceChange(getDefaultVoice(provider));
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
      if (!res.ok) throw new Error(`Preview failed (${res.status})`);

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
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">TTS Provider</label>
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
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Voice</label>
        <div className="flex items-center gap-2">
          <Select
            value={voice}
            onValueChange={(v) => {
              stopPreview();
              onVoiceChange(v);
            }}
          >
            <SelectTrigger className="border-input bg-card text-foreground w-full max-w-md">
              <SelectValue placeholder="Pilih suara" />
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
    </div>
  );
}
