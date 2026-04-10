/**
 * proxy.ts — Protecció de rutes per sessió i rol.
 *
 * Estratègia Edge-compatible:
 * - Comprova l'existència del cookie de sessió (better-auth: "better-auth.session_token")
 * - Per a pàgines no públiques: redirigeix a /login si no hi ha cookie
 * - Per a rutes /admin (pàgines): la verificació de rol es fa al layout server-side
 * - Per a rutes /api (no auth): retorna 401/403 directament
 *
 * La validació completa de la sessió contra BD es fa a les API routes individuals
 * via requireAuth() (nodejs runtime), no aquí.
 */

import { NextResponse, type NextRequest } from 'next/server';

// Rutes públiques — no cal sessió
const PUBLIC_PATHS = [
  '/login',
  '/accept-invite',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
  '/api/invitations/verify',
  '/api/invitations/accept',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
];

// Prefixos d'API que necessiten autenticació
const PROTECTED_API_PREFIXES = ['/api/stages', '/api/generate', '/api/admin', '/api/classroom'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'),
  );
}

function isProtectedApi(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
}

function hasSessionCookie(req: NextRequest): boolean {
  // better-auth crea el cookie amb el nom "better-auth.session_token"
  // (o "__Secure-better-auth.session_token" en HTTPS)
  const cookieHeader = req.headers.get('cookie') ?? '';
  return (
    cookieHeader.includes('better-auth.session_token') ||
    cookieHeader.includes('__Secure-better-auth.session_token')
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permetre rutes públiques sense comprovació
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const hasSession = hasSessionCookie(req);

  // API protegida sense cookie → 401
  if (isProtectedApi(pathname) && !hasSession) {
    return NextResponse.json(
      { success: false, errorCode: 'UNAUTHORIZED', error: 'Cal autenticar-se.' },
      { status: 401 },
    );
  }

  // Pàgines protegides sense cookie → redirect /login
  if (!pathname.startsWith('/api/') && !hasSession) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Matcha totes les rutes excepte:
     * - fitxers estàtics (_next/static, _next/image, favicon, etc.)
     * - fitxers públics directes (/.well-known, /robots.txt)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|\\.well-known).*)',
  ],
};
