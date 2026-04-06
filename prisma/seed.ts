/**
 * seed.ts — Seed inicial de la BD (agnòstic SQLite/PostgreSQL).
 *
 * Crea configuració per defecte a AdminConfig.
 * Els usuaris es creen via `scripts/create-admin.ts` o el flux d'invitació.
 *
 * Ús: pnpm db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Executant seed...');

  // Config per defecte: sense restricció de models (null = tots permesos)
  await prisma.adminConfig.upsert({
    where: { key: 'allowedModels' },
    update: {},
    create: {
      key: 'allowedModels',
      value: JSON.stringify(null), // null = tots els models permesos
    },
  });

  console.log('✔ AdminConfig inicialitzat.');
  console.log('\nSeed completat. Per crear el primer admin:');
  console.log('  pnpm tsx scripts/create-admin.ts\n');
}

main()
  .catch((err) => {
    console.error('ERROR en el seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
