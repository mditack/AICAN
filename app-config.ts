export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  // agent dispatch configuration
  agentName?: string;

  // LiveKit Cloud Sandbox configuration
  sandboxId?: string;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'MDI',
  pageTitle: 'Roleplay dengan AICAN',
  pageDescription: 'Roleplay dengan AICAN',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  logo: '/MDI-SVG.svg',
  accent: '#002cf2',
  logoDark: '/MDI-SVG-putih.svg',
  accentDark: '#1fd5f9',
  startButtonText: 'Mulai bicara',

  // agent dispatch configuration (NEXT_PUBLIC_ required so browser can send agent name in token request)
  agentName:
    typeof process.env.NEXT_PUBLIC_AGENT_NAME === 'string'
      ? process.env.NEXT_PUBLIC_AGENT_NAME
      : (process.env.AGENT_NAME ?? undefined),

  // LiveKit Cloud Sandbox configuration
  sandboxId: undefined,
};
