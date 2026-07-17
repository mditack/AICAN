import type { TtsProvider } from '@/lib/prompt-defaults';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  agentPrompt: string;
  sessionPrompt: string;
  rubricPrompt: string;
  voice: string;
  ttsProvider: TtsProvider;
  isActive: string | boolean; // Upstash deserializes "true"/"false" to boolean
  createdBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type ScenarioInput = Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>;

export const CATEGORIES = [
  { id: 'coaching', label: 'Coaching' },
  { id: 'negotiation', label: 'Negosiasi' },
  { id: 'conflict', label: 'Resolusi Konflik' },
  { id: 'customer-service', label: 'Customer Service' },
  { id: 'interview', label: 'Interview' },
  { id: 'custom', label: 'Custom' },
] as const;

export const DIFFICULTY_LEVELS = [
  { id: 'easy', label: 'Mudah' },
  { id: 'medium', label: 'Sedang' },
  { id: 'hard', label: 'Sulit' },
] as const;

export const REDIS_KEYS = {
  scenarios: 'aican:scenarios',
  scenario: (id: string) => `aican:scenario:${id}`,
  defaultScenario: 'aican:scenario:default',
  sessions: (scenarioId: string) => `aican:sessions:${scenarioId}`,
  session: (id: string) => `aican:session:${id}`,
  recentSessions: 'aican:sessions:recent',
} as const;
