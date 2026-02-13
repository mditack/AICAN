'use client';

import { motion } from 'motion/react';
import { Microphone } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

const MotionButton = motion.create(Button);

function AnimatedBars() {
  return (
    <div className="welcome-bars relative flex h-20 items-center justify-center gap-1.5">
      {/* Orbit ring around the bars */}
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
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div ref={ref} className="welcome-gradient">
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center justify-center px-6 text-center"
      >
        {/* Animated audio bars */}
        <motion.div variants={staggerItem} className="mb-8">
          <AnimatedBars />
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={staggerItem}
          className="text-foreground text-2xl font-bold tracking-tight md:text-3xl"
        >
          Roleplay dengan AICAN
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={staggerItem}
          className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed md:text-base"
        >
          Mulai percakapan dengan AI companion Anda
        </motion.p>

        {/* CTA Button */}
        <MotionButton
          variants={staggerItem}
          size="lg"
          onClick={onStartCall}
          className="mt-8 w-64 cursor-pointer rounded-full bg-brand font-mono text-xs font-bold tracking-wider text-white uppercase shadow-lg shadow-brand-glow transition-all duration-300 hover:scale-105 hover:bg-brand-light hover:shadow-xl hover:shadow-brand-glow"
        >
          <Microphone weight="bold" className="mr-1 size-4" />
          {startButtonText}
        </MotionButton>

        {/* Subtle hint */}
        <motion.p
          variants={staggerItem}
          className="text-muted-foreground/60 mt-6 text-xs"
        >
          Tekan untuk memulai sesi suara
        </motion.p>
      </motion.section>
    </div>
  );
};
