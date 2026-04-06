/**
 * instrumentation.ts — Inicialització del servidor (Next.js 15+).
 *
 * S'executa una sola vegada quan arrenca el procés Node.js.
 * Si no existeix cap usuari admin, en crea un automàticament
 * amb credencials per defecte (o les de les variables d'entorn).
 *
 * Variables d'entorn opcionals:
 *   ADMIN_DEFAULT_EMAIL     — default: admin@localhost
 *   ADMIN_DEFAULT_PASSWORD  — default: Admin123!
 *   ADMIN_DEFAULT_FIRSTNAME — default: Admin
 *   ADMIN_DEFAULT_LASTNAME  — default: System
 */

export async function register() {
  // Només s'executa al costat del servidor (Node.js runtime)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Importació dinàmica per garantir que no es resol a l'Edge runtime
  const { prisma } = await import('@/lib/prisma');
  const argon2 = await import('argon2');
  const { v4: uuidv4 } = await import('uuid');

  try {
    // Comprovar si ja existeix algún admin
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'admin' },
    });

    if (existingAdmin) {
      // Admin ja existeix — no fer res
      return;
    }

    const email = process.env.ADMIN_DEFAULT_EMAIL ?? 'admin@localhost';
    const password = process.env.ADMIN_DEFAULT_PASSWORD ?? 'Admin123!';
    const firstName = process.env.ADMIN_DEFAULT_FIRSTNAME ?? 'Admin';
    const lastName = process.env.ADMIN_DEFAULT_LASTNAME ?? 'System';

    const userId = uuidv4();
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email,
          role: 'admin',
          status: 'active',
          profile: {
            create: { firstName, lastName },
          },
        },
      });

      await tx.account.create({
        data: {
          id: uuidv4(),
          accountId: userId,
          providerId: 'credential',
          userId,
          password: passwordHash,
        },
      });
    });

    console.log(`[OpenMAIC] Admin creat automàticament: ${email}`);
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
      console.warn(
        '[OpenMAIC] ⚠ Contrasenya per defecte (Admin123!) — canvia-la o defineix ADMIN_DEFAULT_PASSWORD.',
      );
    }
  } catch (err) {
    // Silenciem errors de BD (p.ex. si la BD no existeix encara durant el build)
    if (process.env.NODE_ENV !== 'production') {
      console.error('[OpenMAIC] Error inicialitzant admin per defecte:', err);
    }
  }
}
