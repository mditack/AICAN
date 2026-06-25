'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Microphone, SpinnerGap } from '@phosphor-icons/react';
import { ScenarioCard } from '@/components/app/scenario-card';
import { Button } from '@/components/ui/button';
import type { Scenario } from '@/lib/scenarios';

const MotionButton = motion.create(Button);

function AnimatedBars() {
  return (
    <div className="welcome-bars relative flex h-20 items-center justify-center gap-1.5">
      <div className="orbit-ring" />
      <div className="bar h-8 w-1.5" />
      <div className="bar h-14 w-1.5" />
      <div className="bar h-12 w-1.5" />
      <div className="bar h-16 w-1.5" />
      <div className="bar h-10 w-1.5" />
      <div className="bar h-14 w-1.5" />
    </div>
  );
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: (scenarioId?: string) => void;
  avatarEnabledRef: React.MutableRefObject<boolean>;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  avatarEnabledRef,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingScenarios, setLoadingScenarios] = useState(true);

  const loadScenarios = useCallback(async () => {
    try {
      const res = await fetch('/api/scenarios?active=true', { cache: 'no-store' });
      if (res.ok) {
        const data: Scenario[] = await res.json();
        setScenarios(data);
        if (data.length === 1) {
          setSelectedId(data[0].id);
        }
      }
    } finally {
      setLoadingScenarios(false);
    }
  }, []);

  useEffect(() => {
    avatarEnabledRef.current = false;
    loadScenarios();
  }, [avatarEnabledRef, loadScenarios]);

  const handleStart = () => {
    onStartCall(selectedId ?? undefined);
  };

  return (
    <div ref={ref} className="welcome-gradient">
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center justify-center px-6 text-center"
      >
        <motion.div variants={staggerItem} className="mb-8">
          <AnimatedBars />
        </motion.div>

        <motion.h1
          variants={staggerItem}
          className="text-foreground text-2xl font-bold tracking-tight md:text-3xl"
        >
          Roleplay dengan AICAN
        </motion.h1>

        <motion.p
          variants={staggerItem}
          className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed md:text-base"
        >
          {scenarios.length > 0
            ? 'Pilih skenario roleplay lalu mulai percakapan'
            : 'Mulai percakapan dengan AI companion Anda'}
        </motion.p>

        {/* Scenario cards */}
        {!loadingScenarios && scenarios.length > 0 && (
          <motion.div
            variants={staggerItem}
            className="mt-6 grid w-full max-w-md gap-3 sm:grid-cols-2"
          >
            {scenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                selected={selectedId === s.id}
                onClick={() => setSelectedId(s.id)}
              />
            ))}
          </motion.div>
        )}

        {loadingScenarios && (
          <motion.div variants={staggerItem} className="mt-6">
            <SpinnerGap className="text-muted-foreground size-6 animate-spin" weight="bold" />
          </motion.div>
        )}

        <MotionButton
          variants={staggerItem}
          size="lg"
          onClick={handleStart}
          disabled={scenarios.length > 0 && !selectedId}
          className="bg-brand shadow-brand-glow hover:bg-brand-light hover:shadow-brand-glow mt-8 w-64 cursor-pointer rounded-full font-mono text-xs font-bold tracking-wider text-white uppercase shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50"
        >
          <Microphone weight="bold" className="mr-1 size-4" />
          {startButtonText}
        </MotionButton>

        <motion.p variants={staggerItem} className="text-muted-foreground/60 mt-6 text-xs">
          Tekan untuk memulai sesi suara
        </motion.p>
      </motion.section>
    </div>
  );
};
