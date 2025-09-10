import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env['PGHOST'] || 'localhost',
  port: Number(process.env['PGPORT']) || 5432,
  user: process.env['PGUSER'] || 'postgres',
  password: process.env['PGPASSWORD'] || 'postgres',
  database: process.env['PGDATABASE'] || 'social_game',
  // close idle clients after 30s
  idleTimeoutMillis: 30000,
  // return error after 2s if cannot connect
  connectionTimeoutMillis: 2000,
});

pool.connect()
  .then(client => {
    console.log('Postgres connected');
    client.release();
  })
  .catch(err => {
    console.error('Postgres connection error', err.stack);
  });
