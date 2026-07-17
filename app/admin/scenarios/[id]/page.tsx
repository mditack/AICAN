'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FloppyDisk, SpinnerGap } from '@phosphor-icons/react';
import { EmbedSnippet } from '@/components/admin/embed-snippet';
import { VoicePicker } from '@/components/admin/voice-picker';
import type { TtsProvider } from '@/lib/prompt-defaults';
import { CATEGORIES } from '@/lib/scenarios';

export default function EditScenarioPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [sessionPrompt, setSessionPrompt] = useState('');
  const [rubricPrompt, setRubricPrompt] = useState('');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini');
  const [voice, setVoice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scenarios/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Skenario tidak ditemukan');
      const data = await res.json();
      setName(data.name || '');
      setDescription(data.description || '');
      setCategory(data.category || 'custom');
      setAgentPrompt(data.agentPrompt || '');
      setSessionPrompt(data.sessionPrompt || '');
      setRubricPrompt(data.rubricPrompt || '');
      setTtsProvider(data.ttsProvider || 'gemini');
      setVoice(data.voice || '');
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Gagal memuat skenario',
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          category,
          agentPrompt,
          sessionPrompt,
          rubricPrompt,
          ttsProvider,
          voice,
        }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      setMessage({ type: 'success', text: 'Skenario berhasil disimpan.' });
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Gagal menyimpan',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerGap className="text-muted-foreground size-8 animate-spin" weight="bold" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/scenarios"
            className="border-border bg-card text-foreground hover:bg-accent flex size-10 items-center justify-center rounded-lg border transition-colors"
          >
            <ArrowLeft className="size-5" weight="bold" />
          </Link>
          <h1 className="text-foreground text-2xl font-semibold">Edit Skenario</h1>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <SpinnerGap className="size-4 animate-spin" weight="bold" />
          ) : (
            <FloppyDisk className="size-4" weight="bold" />
          )}
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>

      {message && (
        <div
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Nama Skenario</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Deskripsi</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        <VoicePicker
          ttsProvider={ttsProvider}
          voice={voice}
          onProviderChange={setTtsProvider}
          onVoiceChange={setVoice}
        />

        <EmbedSnippet scenarioId={id} />

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Agent Prompt (Karakter & Kepribadian)
          </label>
          <textarea
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            rows={12}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Session Prompt (Alur & Aturan)
          </label>
          <textarea
            value={sessionPrompt}
            onChange={(e) => setSessionPrompt(e.target.value)}
            rows={16}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Rubrik Penilaian</label>
          <p className="text-muted-foreground mb-2 text-sm">
            Kriteria penilaian 50-100. Digunakan agent saat memberikan skor di akhir sesi.
          </p>
          <textarea
            value={rubricPrompt}
            onChange={(e) => setRubricPrompt(e.target.value)}
            rows={10}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
