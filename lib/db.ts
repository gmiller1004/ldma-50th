import { neon } from "@neondatabase/serverless";

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.warn(
    "[db] POSTGRES_URL or DATABASE_URL not set. Community features will not work."
  );
}

export const sql = connectionString
  ? neon(connectionString)
  : (null as unknown as ReturnType<typeof neon>);

export function hasDb(): boolean {
  return Boolean(connectionString);
}
