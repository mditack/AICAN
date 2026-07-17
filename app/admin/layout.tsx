'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignOut } from '@phosphor-icons/react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <div className="bg-background min-h-svh">
      <nav className="border-border bg-card fixed top-0 z-50 w-full border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link
            href="/admin/scenarios"
            className="text-foreground text-sm font-bold tracking-tight"
          >
            AICAN
          </Link>
          <div className="flex flex-1 gap-4">
            <Link
              href="/admin/scenarios"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Skenario
            </Link>
            <Link
              href="/admin/analytics"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Analitik
            </Link>
          </div>
          <button
            onClick={logout}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <SignOut className="size-4" weight="bold" />
            Keluar
          </button>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pt-20 pb-12">{children}</main>
    </div>
  );
}
