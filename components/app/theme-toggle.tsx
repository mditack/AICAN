'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { MonitorIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/shadcn/utils';

interface ThemeToggleProps {
  className?: string;
  showSystem?: boolean;
  bordered?: boolean;
}

export function ThemeToggle({
  className,
  showSystem = true,
  bordered = true,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const themes = [
    { key: 'dark', icon: MoonIcon, label: 'Enable dark color scheme' },
    { key: 'light', icon: SunIcon, label: 'Enable light color scheme' },
    ...(showSystem
      ? [{ key: 'system', icon: MonitorIcon, label: 'Enable system color scheme' }]
      : []),
  ];

  return (
    <div
      className={cn(
        'text-foreground relative flex flex-row items-center justify-end gap-0.5 overflow-hidden rounded-full p-1',
        bordered && 'bg-secondary/60 border border-border/50',
        !bordered && 'bg-secondary/40',
        className
      )}
    >
      <span className="sr-only">Color scheme toggle</span>
      {themes.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => setTheme(key)}
          className={cn(
            'relative z-10 cursor-pointer rounded-full p-1.5 transition-all duration-200',
            mounted && theme === key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="sr-only">{label}</span>
          <Icon suppressHydrationWarning size={14} weight="bold" />
        </button>
      ))}
    </div>
  );
}
