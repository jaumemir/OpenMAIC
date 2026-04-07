import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import argon2 from 'argon2';
import { prisma } from '@/lib/prisma';

/** Detecta el provider de BD per configurar l'adapter correctament. */
const dbProvider = (process.env.DATABASE_URL ?? '').startsWith('file:')
  ? ('sqlite' as const)
  : ('postgresql' as const);

const authSecret = process.env.BETTER_AUTH_SECRET ?? 'dev-only-secret-change-in-production-!!';
const baseURL = process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000';

export const auth = betterAuth({
  secret: authSecret,
  baseURL,

  database: prismaAdapter(prisma, {
    provider: dbProvider,
  }),

  emailAndPassword: {
    enabled: true,
    // Argon2id (OWASP 2024) — igual que miniLMSCat
    password: {
      hash: (password: string) =>
        argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        }),
      verify: ({ hash, password }: { hash: string; password: string }) =>
        argon2.verify(hash, password),
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dies
    updateAge: 60 * 60 * 24,      // Renovar si queden menys de 24h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache 5 minuts al client
    },
  },

  // Camps addicionals del User exposats a la sessió
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
      status: {
        type: 'string',
        defaultValue: 'pending',
        input: false,
      },
    },
  },


  // Configuració de cookies
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    },
  },

});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
