'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { FeedbackModal } from '@/components/app/feedback-modal';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(SessionView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  },
  initial: 'hidden' as const,
  animate: 'visible' as const,
  exit: 'hidden' as const,
  transition: { duration: 0.5, ease: 'linear' as const },
};

interface ViewControllerProps {
  appConfig: AppConfig;
  avatarEnabledRef: React.MutableRefObject<boolean>;
  onSelectScenario: (scenarioId: string | undefined) => void;
}

export function ViewController({
  appConfig,
  avatarEnabledRef,
  onSelectScenario,
}: ViewControllerProps) {
  const session = useSessionContext();
  const { isConnected, start } = session;
  const roomNameRef = useRef<string | null>(null);
  const [feedbackRoomName, setFeedbackRoomName] = useState<string | null>(null);
  const wasConnectedRef = useRef(false);

  // Capture room name while connected
  useEffect(() => {
    if (isConnected && session.room) {
      roomNameRef.current = session.room.name;
      wasConnectedRef.current = true;
    }
  }, [isConnected, session]);

  // Show feedback modal when disconnecting after a session
  useEffect(() => {
    if (!isConnected && wasConnectedRef.current && roomNameRef.current) {
      setFeedbackRoomName(roomNameRef.current);
      wasConnectedRef.current = false;
      roomNameRef.current = null;
    }
  }, [isConnected]);

  const handleStartCall = (scenarioId?: string) => {
    onSelectScenario(scenarioId);
    start();
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!isConnected && (
          <MotionWelcomeView
            key="welcome"
            {...VIEW_MOTION_PROPS}
            startButtonText={appConfig.startButtonText}
            onStartCall={handleStartCall}
            avatarEnabledRef={avatarEnabledRef}
          />
        )}
        {isConnected && (
          <MotionSessionView key="session-view" {...VIEW_MOTION_PROPS} appConfig={appConfig} />
        )}
      </AnimatePresence>

      {feedbackRoomName && (
        <FeedbackModal roomName={feedbackRoomName} onClose={() => setFeedbackRoomName(null)} />
      )}
    </>
  );
}
