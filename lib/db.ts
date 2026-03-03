import { neon } from "@neondatabase/serverless";

// Prefer new Neon (STORAGE_*); fall back to old free Neon (POSTGRES_URL / DATABASE_URL)
const connectionString =
  process.env.STORAGE_DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL;
if (!connectionString) {
  console.warn(
    "[db] STORAGE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL not set. Community features will not work."
  );
}

export const sql = connectionString
  ? neon(connectionString)
  : (null as unknown as ReturnType<typeof neon>);

export function hasDb(): boolean {
  return Boolean(connectionString);
}
