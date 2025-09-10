import 'dotenv/config';
import { readFileSync } from 'fs'
import { Pool } from 'pg'

async function migrate() {
  const pool = new Pool({
    host: process.env['PGHOST'] || 'localhost',
    port: Number(process.env['PGPORT']) || 5432,
    user: process.env['PGUSER'] || 'postgres',
    password: process.env['PGPASSWORD'] || 'postgres',
    database: process.env['PGDATABASE'] || 'social_game',
  });

  try {
    const sql = readFileSync('./migrations/001_init.sql', 'utf-8');
    await pool.query(sql);
    console.log('Migration executed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
