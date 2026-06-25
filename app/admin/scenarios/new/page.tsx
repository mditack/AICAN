'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  FloppyDisk,
  Lightning,
  PaperPlaneTilt,
  SpinnerGap,
} from '@phosphor-icons/react';
import { VoicePicker } from '@/components/admin/voice-picker';
import type { TtsProvider } from '@/lib/prompt-defaults';
import { CATEGORIES, DIFFICULTY_LEVELS } from '@/lib/scenarios';

type Step = 'context' | 'generating' | 'prompts' | 'refine' | 'voice';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export default function NewScenarioPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('context');
  const [saving, setSaving] = useState(false);

  // Context form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterRole, setCharacterRole] = useState('');
  const [situation, setSituation] = useState('');
  const [objective, setObjective] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [category, setCategory] = useState('custom');

  // Generated prompts
  const [agentPrompt, setAgentPrompt] = useState('');
  const [sessionPrompt, setSessionPrompt] = useState('');
  const [rubricPrompt, setRubricPrompt] = useState('');

  // Chat refinement
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [refining, setRefining] = useState(false);

  // Voice
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini');
  const [voice, setVoice] = useState('');

  const generate = async () => {
    setStep('generating');
    try {
      const res = await fetch('/api/scenarios/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          characterName,
          characterRole,
          situation,
          objective,
          difficulty,
          category,
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setAgentPrompt(data.agentPrompt || '');
      setSessionPrompt(data.sessionPrompt || '');
      setRubricPrompt(data.rubricPrompt || '');
      setStep('prompts');
    } catch {
      setStep('context');
    }
  };

  const refine = async () => {
    if (!chatInput.trim()) return;
    const instruction = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: instruction }]);
    setRefining(true);

    try {
      const res = await fetch('/api/scenarios/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentPrompt, sessionPrompt, rubricPrompt, instruction }),
      });
      if (!res.ok) throw new Error('Refinement failed');
      const data = await res.json();
      setAgentPrompt(data.agentPrompt || agentPrompt);
      setSessionPrompt(data.sessionPrompt || sessionPrompt);
      setRubricPrompt(data.rubricPrompt || rubricPrompt);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Prompt telah diperbarui sesuai instruksi.' },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Gagal memproses revisi. Coba lagi.' },
      ]);
    } finally {
      setRefining(false);
    }
  };

  const saveScenario = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          category,
          agentPrompt,
          sessionPrompt,
          rubricPrompt,
          voice,
          ttsProvider,
          isActive: 'true',
          createdBy: 'admin',
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      router.push('/admin/scenarios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/scenarios"
          className="border-border bg-card text-foreground hover:bg-accent flex size-10 items-center justify-center rounded-lg border transition-colors"
        >
          <ArrowLeft className="size-5" weight="bold" />
        </Link>
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Buat Skenario Baru</h1>
          <p className="text-muted-foreground text-sm">
            {step === 'context' && 'Langkah 1: Isi konteks skenario'}
            {step === 'generating' && 'Generating prompts dengan AI…'}
            {step === 'prompts' && 'Langkah 2: Review & edit prompt yang di-generate AI'}
            {step === 'refine' && 'Langkah 3: Revisi prompt dengan instruksi'}
            {step === 'voice' && 'Langkah 4: Pilih suara & simpan'}
          </p>
        </div>
      </div>

      {/* Step: Context Form */}
      {step === 'context' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                Nama Skenario *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Coaching Karyawan Senior"
                className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">Kategori</label>
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
            <label className="text-foreground mb-1 block text-sm font-medium">Deskripsi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Deskripsi singkat skenario untuk ditampilkan di kartu…"
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                Nama Karakter AI *
              </label>
              <input
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Riko"
                className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                Peran Karakter
              </label>
              <input
                value={characterRole}
                onChange={(e) => setCharacterRole(e.target.value)}
                placeholder="Karyawan senior, project admin"
                className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Situasi / Konteks *
            </label>
            <textarea
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              rows={3}
              placeholder="Jelaskan situasi yang akan dihadapi peserta…"
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Objektif Peserta
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={2}
              placeholder="Apa yang harus dicapai peserta dalam roleplay ini…"
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Tingkat Kesulitan
            </label>
            <div className="flex gap-2">
              {DIFFICULTY_LEVELS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    difficulty === d.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={generate}
              disabled={!name || !characterName || !situation}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Lightning className="size-4" weight="fill" />
              Generate dengan AI
            </button>
          </div>
        </div>
      )}

      {/* Step: Generating */}
      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-20">
          <SpinnerGap className="text-primary size-10 animate-spin" weight="bold" />
          <p className="text-muted-foreground mt-4 text-sm">AI sedang membuat prompt skenario…</p>
        </div>
      )}

      {/* Step: Prompts Review */}
      {step === 'prompts' && (
        <div className="space-y-6">
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
              rows={14}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Rubrik Penilaian
            </label>
            <textarea
              value={rubricPrompt}
              onChange={(e) => setRubricPrompt(e.target.value)}
              rows={10}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep('refine')}
              className="border-border bg-card text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Revisi dengan AI
            </button>
            <button
              onClick={() => setStep('voice')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            >
              Lanjut
              <ArrowRight className="size-4" weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Chat Refinement */}
      {step === 'refine' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-foreground text-sm font-medium">Preview Prompt</h3>
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Agent Prompt</label>
                <div className="border-border bg-muted/30 max-h-40 overflow-y-auto rounded-lg border p-3 font-mono text-xs">
                  {agentPrompt.slice(0, 500)}…
                </div>
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Session Prompt</label>
                <div className="border-border bg-muted/30 max-h-40 overflow-y-auto rounded-lg border p-3 font-mono text-xs">
                  {sessionPrompt.slice(0, 500)}…
                </div>
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Rubrik</label>
                <div className="border-border bg-muted/30 max-h-40 overflow-y-auto rounded-lg border p-3 font-mono text-xs">
                  {rubricPrompt.slice(0, 500)}…
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <h3 className="text-foreground mb-2 text-sm font-medium">Chat Refinement</h3>
            <div className="border-border bg-card flex flex-1 flex-col rounded-lg border">
              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 300 }}>
                {chatMessages.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    Ketik instruksi untuk merevisi prompt, contoh: &ldquo;buat karakternya lebih
                    keras kepala&rdquo;
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary/10 text-foreground ml-8'
                        : 'bg-muted text-muted-foreground mr-8'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>
              <div className="border-border flex gap-2 border-t p-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && refine()}
                  placeholder="Instruksi revisi…"
                  disabled={refining}
                  className="bg-background text-foreground flex-1 rounded-md px-3 py-2 text-sm focus:outline-none"
                />
                <button
                  onClick={refine}
                  disabled={refining || !chatInput.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-2 transition-colors disabled:opacity-50"
                >
                  {refining ? (
                    <SpinnerGap className="size-4 animate-spin" weight="bold" />
                  ) : (
                    <PaperPlaneTilt className="size-4" weight="fill" />
                  )}
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-between">
              <button
                onClick={() => setStep('prompts')}
                className="border-border bg-card text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="size-4" weight="bold" />
                Kembali ke Editor
              </button>
              <button
                onClick={() => setStep('voice')}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Lanjut
                <ArrowRight className="size-4" weight="bold" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Voice & Save */}
      {step === 'voice' && (
        <div className="space-y-6">
          <VoicePicker
            ttsProvider={ttsProvider}
            voice={voice}
            onProviderChange={setTtsProvider}
            onVoiceChange={setVoice}
          />

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep('prompts')}
              className="border-border bg-card text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="size-4" weight="bold" />
              Kembali
            </button>
            <button
              onClick={saveScenario}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? (
                <SpinnerGap className="size-4 animate-spin" weight="bold" />
              ) : (
                <FloppyDisk className="size-4" weight="bold" />
              )}
              {saving ? 'Menyimpan…' : 'Simpan Skenario'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
