'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FloppyDisk, SpinnerGap } from '@phosphor-icons/react';

type PromptsData = {
  agentPrompt: string;
  sessionPrompt: string;
  source?: string;
};

export default function PromptsPage() {
  const [agentPrompt, setAgentPrompt] = useState('');
  const [sessionPrompt, setSessionPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/prompts', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load');
      const data: PromptsData = await res.json();
      setAgentPrompt(data.agentPrompt ?? '');
      setSessionPrompt(data.sessionPrompt ?? '');
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to load prompts' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentPrompt, sessionPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save');
      setMessage({ type: 'success', text: 'Prompts saved. The agent will use these on the next session.' });
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
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 py-20">
        <SpinnerGap className="size-10 animate-spin text-muted-foreground" weight="bold" />
        <p className="text-muted-foreground">Loading prompts…</p>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-background px-4 py-20 pt-24 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-accent"
              aria-label="Back to home"
            >
              <ArrowLeft className="size-5" weight="bold" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Agent prompts
              </h1>
              <p className="text-sm text-muted-foreground">
                Edit the role and session prompts used by the LiveKit agent.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
          <div>
            <label
              htmlFor="agent-prompt"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Agent prompt (role / character)
            </label>
            <textarea
              id="agent-prompt"
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="Agent role and personality…"
              spellCheck={false}
            />
          </div>
          <div>
            <label
              htmlFor="session-prompt"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Session prompt (flow, constraints, rubrik)
            </label>
            <textarea
              id="session-prompt"
              value={sessionPrompt}
              onChange={(e) => setSessionPrompt(e.target.value)}
              rows={24}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="Session flow and rules…"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
