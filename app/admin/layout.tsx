import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-svh">
      <nav className="border-border bg-card fixed top-0 z-50 w-full border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/" className="text-foreground text-sm font-bold tracking-tight">
            AICAN
          </Link>
          <div className="flex gap-4">
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
            <Link
              href="/prompts"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Prompts (Legacy)
            </Link>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pt-20 pb-12">{children}</main>
    </div>
  );
}
