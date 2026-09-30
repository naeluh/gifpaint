// One pg Pool per function instance, shared by Better Auth and the project
// queries. DATABASE_URL is Neon's pooled (pgbouncer) URL, so a small pool per
// instance is enough.
import pg from 'pg';

/** @type {pg.Pool} */
export const pool =
  globalThis.__gifpaintPool ??
  (globalThis.__gifpaintPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000
  }));

/**
 * Run one parameterized query.
 * @param {string} text SQL with $1.. placeholders
 * @param {unknown[]} [params]
 * @returns {Promise<any[]>} rows
 */
export async function q(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows;
}
