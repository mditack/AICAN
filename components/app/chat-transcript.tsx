'use client';

import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react';
import { type ReceivedMessage, useAgent } from '@livekit/components-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import { cn } from '@/lib/shadcn/utils';

const MotionContainer = motion.create('div');

const CONTAINER_MOTION_PROPS = {
  variants: {
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeOut',
        duration: 0.3,
      },
    },
    visible: {
      opacity: 1,
      transition: {
        delay: 0.2,
        ease: 'easeOut',
        duration: 0.3,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

interface ChatTranscriptProps {
  hidden?: boolean;
  messages?: ReceivedMessage[];
}

export function ChatTranscript({
  hidden = false,
  messages = [],
  className,
  ...props
}: ChatTranscriptProps & Omit<HTMLMotionProps<'div'>, 'ref'>) {
  const { state: agentState } = useAgent();

  return (
    <div className="absolute top-0 bottom-[135px] flex w-full flex-col md:bottom-[170px]">
      <AnimatePresence>
        {!hidden && (
          <MotionContainer
            {...props}
            {...CONTAINER_MOTION_PROPS}
            className={cn('flex h-full w-full flex-col gap-4', className)}
          >
            <AgentChatTranscript
              agentState={agentState}
              messages={messages}
              className={cn(
                'mx-auto w-full max-w-2xl',
                '[&>div>div]:px-4 [&>div>div]:pt-40 md:[&>div>div]:px-6',
                /* User message bubbles */
                '[&_.is-user>div]:bg-brand/10 [&_.is-user>div]:text-foreground [&_.is-user>div]:rounded-[22px] [&_.is-user>div]:shadow-sm',
                /* Agent message bubbles */
                '[&_.is-agent>div]:bg-card [&_.is-agent>div]:border-border/50 [&_.is-agent>div]:rounded-[22px] [&_.is-agent>div]:border [&_.is-agent>div]:shadow-sm'
              )}
            />
          </MotionContainer>
        )}
      </AnimatePresence>
    </div>
  );
}
