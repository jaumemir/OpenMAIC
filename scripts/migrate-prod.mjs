/**
 * migrate-prod.mjs — Executa migracions PostgreSQL (producció).
 *
 * Prisma sempre busca les migracions a prisma/migrations/, però nosaltres
 * tenim dues carpetes separades (SQLite i PostgreSQL). Aquest script fa un
 * symlink temporal de migrations-prod → migrations per a l'execució, i
 * restaura l'original al final (patró idèntic a miniLMSCat).
 *
 * Ús: node scripts/migrate-prod.mjs
 * Requereix: DATABASE_URL=postgresql://... al .env.local o al entorn
 */

import { execFileSync } from 'child_process';
import { renameSync, symlinkSync, existsSync, unlinkSync, lstatSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prismaDir = path.join(root, 'prisma');
const migrationsDir = path.join(prismaDir, 'migrations');
const migrationsBackup = path.join(prismaDir, '.migrations-sqlite-bak');
const migrationsProdDir = path.join(prismaDir, 'migrations-prod');
const schemaProd = path.join(prismaDir, 'schema.prod.prisma');

if (!existsSync(migrationsProdDir)) {
  console.error('ERROR: prisma/migrations-prod/ no existeix. Cal generar les migracions PostgreSQL primer.');
  process.exit(1);
}

let restored = false;

function restore() {
  if (restored) return;
  restored = true;
  try {
    if (existsSync(migrationsDir)) {
      const stat = lstatSync(migrationsDir);
      if (stat.isSymbolicLink()) {
        unlinkSync(migrationsDir);
      }
    }
    if (existsSync(migrationsBackup)) {
      renameSync(migrationsBackup, migrationsDir);
      console.log('✔ Restaurat prisma/migrations/ (SQLite)');
    }
  } catch (err) {
    console.error('ERROR restaurant prisma/migrations/:', err.message);
  }
}

process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(1); });
process.on('SIGTERM', () => { restore(); process.exit(1); });

try {
  console.log('→ Backup prisma/migrations/ → prisma/.migrations-sqlite-bak');
  renameSync(migrationsDir, migrationsBackup);

  console.log('→ Symlink prisma/migrations/ → prisma/migrations-prod/');
  symlinkSync(migrationsProdDir, migrationsDir);

  console.log('→ Executant: prisma migrate deploy --schema=prisma/schema.prod.prisma');
  // Usa execFileSync (no shell) — paths estàtics, sense input d'usuari
  execFileSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema', schemaProd],
    { stdio: 'inherit', cwd: root },
  );

  console.log('✔ Migracions PostgreSQL aplicades correctament.');
} catch (err) {
  console.error('ERROR durant la migració PostgreSQL:', err.message);
  restore();
  process.exit(1);
} finally {
  restore();
}
