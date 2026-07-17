'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarBlank, ChartBar, SpinnerGap, Star, Trophy, Users } from '@phosphor-icons/react';
import type { Scenario } from '@/lib/scenarios';

interface Stats {
  totalSessions: number;
  averageScore: number;
  sessionsToday: number;
  topScenario: string | null;
}

interface SessionRow {
  id: string;
  scenarioId: string;
  participantName: string;
  score: string;
  feedback: string;
  startedAt: string;
  endedAt: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterScenario, setFilterScenario] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, sessionsRes, scenariosRes] = await Promise.all([
        fetch('/api/sessions/stats', { cache: 'no-store' }),
        fetch(`/api/sessions${filterScenario ? `?scenarioId=${filterScenario}` : ''}`, {
          cache: 'no-store',
        }),
        fetch('/api/scenarios', { cache: 'no-store' }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (scenariosRes.ok) setScenarios(await scenariosRes.json());
    } finally {
      setLoading(false);
    }
  }, [filterScenario]);

  useEffect(() => {
    load();
  }, [load]);

  const scenarioName = (id: string) => scenarios.find((s) => s.id === id)?.name || id;

  const scoreBuckets = [
    { label: '50-59', min: 50, max: 59 },
    { label: '60-69', min: 60, max: 69 },
    { label: '70-79', min: 70, max: 79 },
    { label: '80-89', min: 80, max: 89 },
    { label: '90-100', min: 90, max: 100 },
  ];

  const bucketCounts = scoreBuckets.map((b) => ({
    ...b,
    count: sessions.filter((s) => {
      const score = Number(s.score);
      return score >= b.min && score <= b.max;
    }).length,
  }));

  const maxCount = Math.max(...bucketCounts.map((b) => b.count), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerGap className="text-muted-foreground size-8 animate-spin" weight="bold" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-foreground mb-6 text-2xl font-semibold">Analitik</h1>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <Users className="size-4" />
            Total Sesi
          </div>
          <div className="text-foreground text-2xl font-bold">{stats?.totalSessions || 0}</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <Star className="size-4" />
            Rata-rata Skor
          </div>
          <div className="text-foreground text-2xl font-bold">{stats?.averageScore || 0}</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <CalendarBlank className="size-4" />
            Sesi Hari Ini
          </div>
          <div className="text-foreground text-2xl font-bold">{stats?.sessionsToday || 0}</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <Trophy className="size-4" />
            Skenario Terpopuler
          </div>
          <div className="text-foreground truncate text-lg font-bold">
            {stats?.topScenario ? scenarioName(stats.topScenario) : '-'}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground text-sm">Skenario:</label>
          <select
            value={filterScenario}
            onChange={(e) => setFilterScenario(e.target.value)}
            className="border-input bg-card text-foreground rounded-lg border px-3 py-1.5 text-sm"
          >
            <option value="">Semua</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Score distribution chart */}
      {sessions.length > 0 && (
        <div className="border-border bg-card mb-8 rounded-lg border p-6">
          <div className="text-foreground mb-4 flex items-center gap-2 text-sm font-medium">
            <ChartBar className="size-4" />
            Distribusi Skor
          </div>
          <div className="flex h-40 items-end gap-3">
            {bucketCounts.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-muted-foreground text-xs">{b.count}</span>
                <div
                  className="bg-primary/80 w-full rounded-t-md transition-all"
                  style={{
                    height: `${(b.count / maxCount) * 100}%`,
                    minHeight: b.count > 0 ? 8 : 0,
                  }}
                />
                <span className="text-muted-foreground text-xs">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions table */}
      {sessions.length === 0 ? (
        <div className="border-border rounded-lg border py-12 text-center">
          <p className="text-muted-foreground">Belum ada data sesi.</p>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Peserta</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Skenario</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Skor</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <>
                  <tr
                    key={s.id}
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    className="border-border hover:bg-muted/30 cursor-pointer border-b transition-colors last:border-0"
                  >
                    <td className="text-foreground px-4 py-3">{s.participantName}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {scenarioName(s.scenarioId)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          Number(s.score) >= 80
                            ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                            : Number(s.score) >= 70
                              ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                              : 'bg-red-500/10 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {s.score}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {new Date(s.endedAt).toLocaleString('id-ID')}
                    </td>
                  </tr>
                  {expandedId === s.id && s.feedback && (
                    <tr key={`${s.id}-feedback`}>
                      <td colSpan={4} className="bg-muted/20 px-4 py-4">
                        <p className="text-muted-foreground mb-1 text-xs font-medium">Feedback:</p>
                        <p className="text-foreground text-sm whitespace-pre-wrap">{s.feedback}</p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
