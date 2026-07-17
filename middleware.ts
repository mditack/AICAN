import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = () =>
  new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? 'aican-admin-fallback-secret');

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  try {
    await jwtVerify(token, secret());
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.set('admin_token', '', { maxAge: 0, path: '/' });
    return res;
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
