'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CopySimple, PencilSimple, Plus, Power, SpinnerGap, Trash } from '@phosphor-icons/react';
import type { Scenario } from '@/lib/scenarios';

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scenarios', { cache: 'no-store' });
      if (res.ok) setScenarios(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (id: string, current: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: current === 'true' ? 'false' : 'true' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Toggle failed (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status skenario');
    }
  };

  const deleteScenario = async (id: string, name: string) => {
    if (!confirm(`Hapus skenario "${name}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/scenarios/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus skenario');
    }
  };

  const duplicateScenario = async (scenario: Scenario) => {
    await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${scenario.name} (Copy)`,
        description: scenario.description,
        category: scenario.category,
        agentPrompt: scenario.agentPrompt,
        sessionPrompt: scenario.sessionPrompt,
        rubricPrompt: scenario.rubricPrompt,
        voice: scenario.voice,
        ttsProvider: scenario.ttsProvider,
        isActive: 'false',
        createdBy: 'admin',
      }),
    });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerGap className="text-muted-foreground size-8 animate-spin" weight="bold" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Skenario Roleplay</h1>
          <p className="text-muted-foreground text-sm">
            Kelola skenario roleplay yang tersedia untuk peserta.
          </p>
        </div>
        <Link
          href="/admin/scenarios/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Plus className="size-4" weight="bold" />
          Buat Skenario Baru
        </Link>
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {scenarios.length === 0 ? (
        <div className="border-border rounded-lg border py-12 text-center">
          <p className="text-muted-foreground mb-4">Belum ada skenario.</p>
          <Link
            href="/admin/scenarios/new"
            className="text-primary text-sm font-medium hover:underline"
          >
            Buat skenario pertama
          </Link>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Nama</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Kategori</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Dibuat</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-foreground font-medium">{s.name}</div>
                    <div className="text-muted-foreground text-xs">{s.description}</div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 capitalize">{s.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.isActive === 'true'
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {s.isActive === 'true' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {new Date(s.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/scenarios/${s.id}`}
                        className="hover:bg-accent rounded-md p-1.5 transition-colors"
                        title="Edit"
                      >
                        <PencilSimple className="size-4" />
                      </Link>
                      <button
                        onClick={() => duplicateScenario(s)}
                        className="hover:bg-accent rounded-md p-1.5 transition-colors"
                        title="Duplikat"
                      >
                        <CopySimple className="size-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(s.id, s.isActive)}
                        className="hover:bg-accent rounded-md p-1.5 transition-colors"
                        title={s.isActive === 'true' ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Power
                          className={`size-4 ${s.isActive === 'true' ? 'text-green-500' : 'text-muted-foreground'}`}
                        />
                      </button>
                      <button
                        onClick={() => deleteScenario(s.id, s.name)}
                        className="hover:bg-destructive/10 rounded-md p-1.5 transition-colors"
                        title="Hapus"
                      >
                        <Trash className="text-destructive size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
