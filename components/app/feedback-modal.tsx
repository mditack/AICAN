'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CaretDown, X } from '@phosphor-icons/react';

interface Criterion {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface AssessmentData {
  score: number;
  feedback: string;
  criteria: Criterion[];
  strengths: string[];
  improvements: string[];
}

interface FeedbackModalProps {
  roomName: string | null;
  onClose: () => void;
}

function normalizeAssessment(raw: unknown, fallbackScore: number): AssessmentData {
  const src =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const score = Number(src.score ?? fallbackScore) || fallbackScore || 0;
  const feedback = typeof src.feedback === 'string' ? src.feedback : '';

  const rawCriteria = Array.isArray(src.criteria) ? src.criteria : [];
  const criteria: Criterion[] = rawCriteria
    .map((c: unknown) => {
      if (!c || typeof c !== 'object') return null;
      const co = c as Record<string, unknown>;
      const name = typeof co.name === 'string' ? co.name : '';
      const maxScore = Number(co.maxScore) || 5;
      const cScore = Math.max(0, Math.min(maxScore, Number(co.score) || 0));
      const cFeedback = typeof co.feedback === 'string' ? co.feedback : '';
      if (!name) return null;
      return { name, score: cScore, maxScore, feedback: cFeedback };
    })
    .filter((c): c is Criterion => c !== null);

  const strengths = Array.isArray(src.strengths)
    ? src.strengths.filter((s): s is string => typeof s === 'string')
    : [];
  const improvements = Array.isArray(src.improvements)
    ? src.improvements.filter((s): s is string => typeof s === 'string')
    : [];

  return { score, feedback, criteria, strengths, improvements };
}

function CriterionCard({ criterion, index }: { criterion: Criterion; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const pct = criterion.maxScore > 0 ? criterion.score / criterion.maxScore : 0;
  const scoreColor =
    pct >= 0.75 ? 'text-emerald-500' : pct >= 0.5 ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-accent/40 flex w-full items-center justify-between gap-3 p-4 text-left transition-colors"
      >
        <div className="flex min-w-0 items-center gap-3">
          <CaretDown
            className={`text-muted-foreground size-4 flex-shrink-0 transition-transform ${
              open ? 'rotate-0' : '-rotate-90'
            }`}
            weight="bold"
          />
          <span className="text-foreground truncate text-sm font-semibold">{criterion.name}</span>
        </div>
        <span className={`flex-shrink-0 text-sm font-semibold ${scoreColor}`}>
          {criterion.score}/{criterion.maxScore}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && criterion.feedback && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-0 pb-4">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {criterion.feedback}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FeedbackModal({ roomName, onClose }: FeedbackModalProps) {
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!roomName) return;

    let attempts = 0;
    // Backend assessment budget is ~110s (see agent.py _on_shutdown) plus
    // network overhead, so poll longer than that or we show a false failure
    // while the assessment is still being written.
    const maxAttempts = 65;
    let cancelled = false;

    const poll = async () => {
      while (attempts < maxAttempts && !cancelled) {
        attempts++;
        try {
          const res = await fetch(`/api/sessions?roomName=${encodeURIComponent(roomName)}`);
          const data = await res.json();
          if (data && data.feedback) {
            const fallbackScore = Number(data.score) || 0;
            let feedbackObj: unknown = data.feedback;
            if (typeof feedbackObj === 'string') {
              try {
                feedbackObj = JSON.parse(feedbackObj);
              } catch {
                feedbackObj = { feedback: feedbackObj };
              }
            }
            const parsed = normalizeAssessment(feedbackObj, fallbackScore);
            if (!cancelled) {
              setAssessment(parsed);
              setLoading(false);
            }
            return;
          }
        } catch {
          // ignore, retry
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) {
        setLoading(false);
        setError(true);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [roomName]);

  if (!roomName) return null;

  const scoreColor =
    assessment && assessment.score >= 75
      ? 'text-emerald-500'
      : assessment && assessment.score >= 50
        ? 'text-amber-500'
        : 'text-rose-500';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !loading) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-background border-border flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        >
          {loading && (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="text-muted-foreground text-sm">Menganalisis performa Anda...</p>
            </div>
          )}

          {error && !assessment && (
            <div className="flex flex-col items-center gap-4 px-6 py-16">
              <p className="text-muted-foreground text-center text-sm">
                Tidak dapat mengambil hasil penilaian. Silakan coba lagi nanti.
              </p>
              <button
                onClick={onClose}
                className="bg-primary text-primary-foreground rounded-lg px-6 py-2 text-sm font-medium"
              >
                Tutup
              </button>
            </div>
          )}

          {assessment && (
            <>
              {/* Header */}
              <div className="bg-primary/5 border-border/50 flex flex-shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    🎯
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-foreground truncate text-base font-bold">
                      Roleplay Selesai
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      Skor Anda:{' '}
                      <span className={`font-bold ${scoreColor}`}>{assessment.score}</span>
                      <span className="text-muted-foreground">/100</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={onClose}
                    className="border-primary text-primary hover:bg-primary/10 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors"
                  >
                    Coba Lagi
                  </button>
                  <button
                    onClick={onClose}
                    aria-label="Tutup"
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <X weight="bold" className="size-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {/* Overall feedback */}
                {assessment.feedback && (
                  <div className="bg-muted/40 rounded-lg p-4">
                    <p className="text-foreground text-sm leading-relaxed">{assessment.feedback}</p>
                  </div>
                )}

                {/* Coaching criteria */}
                {assessment.criteria.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-base" aria-hidden>
                        💬
                      </span>
                      <h3 className="text-foreground text-sm font-bold">
                        Coaching ({assessment.criteria.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {assessment.criteria.map((c, i) => (
                        <CriterionCard key={i} criterion={c} index={i} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Strengths */}
                {assessment.strengths.length > 0 && (
                  <section>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-base" aria-hidden>
                        💪
                      </span>
                      <h3 className="text-foreground text-sm font-bold">Kekuatan</h3>
                    </div>
                    <ul className="space-y-2">
                      {assessment.strengths.map((s, i) => (
                        <li
                          key={i}
                          className="rounded-r-lg border-l-2 border-emerald-500 bg-emerald-500/5 px-3 py-2"
                        >
                          <p className="text-foreground text-sm leading-relaxed">{s}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Improvements */}
                {assessment.improvements.length > 0 && (
                  <section>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-base" aria-hidden>
                        💡
                      </span>
                      <h3 className="text-foreground text-sm font-bold">
                        Area yang Perlu Diperbaiki
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {assessment.improvements.map((s, i) => (
                        <li
                          key={i}
                          className="rounded-r-lg border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2"
                        >
                          <p className="text-foreground text-sm leading-relaxed">{s}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
