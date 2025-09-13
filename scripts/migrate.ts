import { readFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  const pool = new Pool({
    host: process.env['PGHOST'] || 'localhost',
    port: Number(process.env['PGPORT']) || 5432,
    user: process.env['PGUSER'] || 'postgres',
    password: process.env['PGPASSWORD'] || 'postgres',
    database: process.env['PGDATABASE'] || 'social_game',
  });

  try {
    // Run schema migration
    const initSql = readFileSync(path.join(__dirname, '../migrations/001_init.sql'), 'utf-8');
    await pool.query(initSql);
    console.log('[Migartion] 001_init.sql executed successfully');

    // Run mock data seed
    const mockSql = readFileSync(path.join(__dirname, '../migrations/002_mock_data.sql'), 'utf-8');
    await pool.query(mockSql);
    console.log('[Migration] 002_mock_data.sql executed successfully');

    console.log('[Migration] executed successfully');
  } catch (err) {
    console.error('[Migration] failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
