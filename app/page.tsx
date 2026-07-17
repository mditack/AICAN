import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { AdminLogin } from '@/components/app/admin-login';
import { App } from '@/components/app/app';
import { getAppConfig } from '@/lib/utils';

const jwtSecret = () =>
  new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? 'aican-admin-fallback-secret');

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const params = await searchParams;

  // Embed mode: ?scenario=<id> loads the voice app directly (for iframes).
  if (params.scenario) {
    const hdrs = await headers();
    const appConfig = await getAppConfig(hdrs);
    return <App appConfig={appConfig} />;
  }

  // Check if already authenticated — redirect straight to admin.
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (token) {
    try {
      await jwtVerify(token, jwtSecret());
      redirect('/admin/scenarios');
    } catch {
      // Expired/invalid token — fall through to login form.
    }
  }

  return <AdminLogin />;
}
