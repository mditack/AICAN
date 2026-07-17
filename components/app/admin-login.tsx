'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeSlash, LockKey } from '@phosphor-icons/react';

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/admin/scenarios');
      } else {
        const data = await res.json();
        setError(data.error ?? 'Login gagal');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="bg-primary/10 flex size-14 items-center justify-center rounded-2xl">
            <LockKey className="text-primary size-7" weight="duotone" />
          </div>
          <div className="text-center">
            <h1 className="text-foreground text-xl font-bold">Admin AICAN</h1>
            <p className="text-muted-foreground mt-1 text-sm">Masukkan password untuk melanjutkan</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              required
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-4 py-3 pr-10 text-sm focus:ring-2 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeSlash className="size-4" weight="bold" />
              ) : (
                <Eye className="size-4" weight="bold" />
              )}
            </button>
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Masuk…' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
