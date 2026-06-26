'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface AssessmentData {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface FeedbackModalProps {
  roomName: string | null;
  onClose: () => void;
}

export function FeedbackModal({ roomName, onClose }: FeedbackModalProps) {
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!roomName) return;

    let attempts = 0;
    const maxAttempts = 15;
    let cancelled = false;

    const poll = async () => {
      while (attempts < maxAttempts && !cancelled) {
        attempts++;
        try {
          const res = await fetch(`/api/sessions?roomName=${encodeURIComponent(roomName)}`);
          const data = await res.json();
          if (data && data.feedback) {
            let parsed: AssessmentData;
            try {
              const feedbackObj = JSON.parse(data.feedback);
              parsed = {
                score: feedbackObj.score ?? Number(data.score) ?? 70,
                feedback: feedbackObj.feedback ?? '',
                strengths: feedbackObj.strengths ?? [],
                improvements: feedbackObj.improvements ?? [],
              };
            } catch {
              parsed = {
                score: Number(data.score) || 70,
                feedback: data.feedback,
                strengths: [],
                improvements: [],
              };
            }
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
    assessment && assessment.score >= 80
      ? 'text-green-500'
      : assessment && assessment.score >= 60
        ? 'text-yellow-500'
        : 'text-red-500';

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
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="bg-background border-border w-full max-w-lg rounded-2xl border p-6 shadow-2xl"
        >
          {loading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="text-muted-foreground text-sm">Menganalisis performa Anda...</p>
            </div>
          )}

          {error && !assessment && (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-muted-foreground text-sm">
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
              <h2 className="text-foreground mb-4 text-center text-xl font-bold">
                Hasil Penilaian
              </h2>

              {/* Score */}
              <div className="mb-6 flex flex-col items-center">
                <div className={`text-5xl font-bold ${scoreColor}`}>{assessment.score}</div>
                <div className="text-muted-foreground mt-1 text-sm">dari 100</div>
              </div>

              {/* Feedback */}
              {assessment.feedback && (
                <div className="bg-muted/50 mb-4 rounded-lg p-4">
                  <p className="text-foreground text-sm leading-relaxed">{assessment.feedback}</p>
                </div>
              )}

              {/* Strengths */}
              {assessment.strengths.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-foreground mb-2 text-sm font-semibold">Kekuatan</h3>
                  <ul className="space-y-1">
                    {assessment.strengths.map((s, i) => (
                      <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                        <span className="mt-0.5 text-green-500">+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {assessment.improvements.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-foreground mb-2 text-sm font-semibold">
                    Area yang Perlu Diperbaiki
                  </h3>
                  <ul className="space-y-1">
                    {assessment.improvements.map((s, i) => (
                      <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                        <span className="mt-0.5 text-yellow-500">-</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="bg-primary text-primary-foreground w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
              >
                Tutup
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
