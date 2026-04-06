/**
 * create-admin.ts — Crea el primer usuari admin manualment.
 *
 * Ús:
 *   DATABASE_URL=file:./data/db.sqlite pnpm tsx scripts/create-admin.ts
 *
 * O bé amb variables al .env.local:
 *   pnpm tsx scripts/create-admin.ts
 */

import { prisma } from '../lib/prisma';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import * as readline from 'readline/promises';
import { stdin, stdout } from 'process';

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log('\n=== Crear usuari administrador ===\n');

  const email = await rl.question('Email: ');
  const firstName = await rl.question('Nom: ');
  const lastName = await rl.question('Cognom: ');
  const password = await rl.question('Contrasenya (mínim 8 caràcters): ');

  rl.close();

  if (password.length < 8) {
    console.error('ERROR: La contrasenya ha de tenir mínim 8 caràcters.');
    process.exit(1);
  }

  // Comprovar si ja existeix un usuari admin
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (existingAdmin) {
    console.warn(`AVÍS: Ja existeix un admin (${existingAdmin.email}). Continua igualment.`);
  }

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

  console.log(`\n✔ Admin creat correctament!`);
  console.log(`  Email: ${email}`);
  console.log(`  Nom: ${firstName} ${lastName}`);
  console.log(`  Role: admin\n`);
}

main()
  .catch((err) => {
    console.error('ERROR:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
