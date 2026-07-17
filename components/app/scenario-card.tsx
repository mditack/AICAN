'use client';

import { motion } from 'motion/react';
import type { Scenario } from '@/lib/scenarios';

interface ScenarioCardProps {
  scenario: Scenario;
  selected: boolean;
  onClick: () => void;
}

export function ScenarioCard({ scenario, selected, onClick }: ScenarioCardProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
          : 'border-border bg-card hover:bg-accent/50'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-foreground text-sm font-semibold">{scenario.name}</span>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] capitalize">
          {scenario.category}
        </span>
      </div>
      <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
        {scenario.description}
      </p>
    </motion.button>
  );
}
