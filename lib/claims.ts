import { sql, hasDb } from "./db";

export type Claim = {
  id: string;
  camp_slug: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  member_claim_names: string[] | null;
};

export async function getClaimsByCamp(campSlug: string): Promise<Claim[]> {
  if (!hasDb() || !sql) return [];
  const rows = await sql`
    SELECT id, camp_slug, name, slug, description, sort_order, member_claim_names
    FROM claims
    WHERE camp_slug = ${campSlug}
    ORDER BY sort_order ASC, name ASC
  `;
  const arr = Array.isArray(rows) ? rows : [];
  return arr as unknown as Claim[];
}

export async function getClaimBySlug(campSlug: string, claimSlug: string): Promise<Claim | null> {
  if (!hasDb() || !sql) return null;
  const rows = await sql`
    SELECT id, camp_slug, name, slug, description, sort_order, member_claim_names
    FROM claims
    WHERE camp_slug = ${campSlug} AND slug = ${claimSlug}
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0];
  return row ? (row as unknown as Claim) : null;
}

export async function getClaimById(id: string): Promise<Claim | null> {
  if (!hasDb() || !sql) return null;
  const rows = await sql`
    SELECT id, camp_slug, name, slug, description, sort_order, member_claim_names
    FROM claims
    WHERE id = ${id}
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0];
  return row ? (row as unknown as Claim) : null;
}

export async function getDiscussionCountByClaim(claimId: string): Promise<number> {
  if (!hasDb() || !sql) return 0;
  const rows = await sql`
    SELECT COUNT(*)::int as c FROM community_discussions WHERE claim_id = ${claimId}
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as { c: number } | undefined;
  return row?.c ?? 0;
}
