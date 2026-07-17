import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const secret = () =>
  new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? 'aican-admin-fallback-secret');

export async function POST(req: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: 'Admin password not configured' }, { status: 503 });
  }

  let password: string;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 });
  }

  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
