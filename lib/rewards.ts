/**
 * Member rewards: points and tiers. Backend-only; only logged-in members accumulate.
 * Keyed by Salesforce contact_id. Run scripts/migrate-member-rewards.sql first.
 */

import { sql, hasDb } from "./db";

export const REWARD_TIERS = ["camper", "prospector", "miner", "sourdough"] as const;
export type RewardTier = (typeof REWARD_TIERS)[number];

/** Lifetime points required for each tier (everyone starts at camper). */
export const TIER_THRESHOLDS: Record<RewardTier, number> = {
  camper: 0,
  prospector: 250,
  miner: 1000,
  sourdough: 5000,
};

/** Max community points a member can earn per calendar day (prevents gaming). Purchase points are not capped. */
export const DAILY_COMMUNITY_CAP = 50;

/** Point values for community engagement (tunable). */
export const POINTS = {
  discussion_start: 15,
  discussion_photo: 5,
  discussion_video: 10,
  comment: 3,
  reaction: 1,
} as const;

export type MemberRewards = {
  contact_id: string;
  points_balance: number;
  lifetime_points: number;
  tier: RewardTier;
  updated_at: string;
};

export function getTierForLifetimePoints(lifetimePoints: number): RewardTier {
  if (lifetimePoints >= TIER_THRESHOLDS.sourdough) return "sourdough";
  if (lifetimePoints >= TIER_THRESHOLDS.miner) return "miner";
  if (lifetimePoints >= TIER_THRESHOLDS.prospector) return "prospector";
  return "camper";
}

/** Reasons that count toward the daily community cap. Purchase is excluded. */
const COMMUNITY_REASONS = ["discussion_start", "comment", "reaction"];

async function getTodayCommunityPoints(contactId: string): Promise<number> {
  if (!sql) return 0;
  const rows = await sql`
    SELECT COALESCE(SUM(points_delta), 0)::int AS total
    FROM member_point_transactions
    WHERE contact_id = ${contactId}
      AND reason IN ('discussion_start', 'comment', 'reaction')
      AND created_at >= CURRENT_DATE
      AND created_at < CURRENT_DATE + INTERVAL '1 day'
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0] as { total: number } | undefined;
  return row?.total ?? 0;
}

/**
 * Award points to a member. Only call when the member is authenticated (has contact_id).
 * When reference_type and reference_id are provided, the grant is idempotent (one per reference).
 * Community points (discussion_start, comment, reaction) are capped at DAILY_COMMUNITY_CAP per member per day.
 */
export async function addPoints(
  contactId: string,
  pointsDelta: number,
  reason: string,
  referenceType?: string | null,
  referenceId?: string | null
): Promise<{ ok: boolean; alreadyGranted?: boolean; capped?: boolean }> {
  if (!hasDb() || !sql || pointsDelta <= 0) return { ok: false };

  if (referenceType != null && referenceId != null) {
    const existing = await sql`
      SELECT 1 FROM member_point_transactions
      WHERE reference_type = ${referenceType} AND reference_id = ${referenceId}
      LIMIT 1
    `;
    const arr = Array.isArray(existing) ? existing : [];
    if (arr.length > 0) return { ok: true, alreadyGranted: true };
  }

  if (COMMUNITY_REASONS.includes(reason)) {
    const todayTotal = await getTodayCommunityPoints(contactId);
    const headroom = Math.max(0, DAILY_COMMUNITY_CAP - todayTotal);
    if (headroom <= 0) return { ok: true, capped: true };
    if (pointsDelta > headroom) pointsDelta = headroom;
  }

  try {
    await sql`
      INSERT INTO member_point_transactions (contact_id, points_delta, reason, reference_type, reference_id)
      VALUES (${contactId}, ${pointsDelta}, ${reason}, ${referenceType ?? null}, ${referenceId ?? null})
    `;
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") return { ok: true, alreadyGranted: true };
    throw e;
  }

  const tier = getTierForLifetimePoints(0 + pointsDelta);
  await sql`
    INSERT INTO member_rewards (contact_id, points_balance, lifetime_points, tier, updated_at)
    VALUES (${contactId}, ${pointsDelta}, ${pointsDelta}, ${tier}, NOW())
    ON CONFLICT (contact_id) DO UPDATE SET
      points_balance = member_rewards.points_balance + ${pointsDelta},
      lifetime_points = member_rewards.lifetime_points + ${pointsDelta},
      tier = CASE
        WHEN member_rewards.lifetime_points + ${pointsDelta} >= ${TIER_THRESHOLDS.sourdough} THEN 'sourdough'
        WHEN member_rewards.lifetime_points + ${pointsDelta} >= ${TIER_THRESHOLDS.miner} THEN 'miner'
        WHEN member_rewards.lifetime_points + ${pointsDelta} >= ${TIER_THRESHOLDS.prospector} THEN 'prospector'
        ELSE 'camper'
      END,
      updated_at = NOW()
  `;
  return { ok: true };
}

/** Get current rewards for a member, or null if they have no record yet. */
export async function getMemberRewards(contactId: string): Promise<MemberRewards | null> {
  if (!hasDb() || !sql) return null;
  const rows = await sql`
    SELECT contact_id, points_balance, lifetime_points, tier, updated_at
    FROM member_rewards WHERE contact_id = ${contactId} LIMIT 1
  `;
  const arr = Array.isArray(rows) ? rows : [];
  const row = arr[0];
  if (!row) return null;
  return row as unknown as MemberRewards;
}

/** Award points for starting a new discussion. Call after discussion (and optional photos) are created. */
export async function awardPointsForNewDiscussion(
  contactId: string,
  discussionId: string,
  options: { hasPhotos?: boolean; hasVideo?: boolean }
): Promise<void> {
  let total = POINTS.discussion_start;
  if (options.hasPhotos) total += POINTS.discussion_photo;
  if (options.hasVideo) total += POINTS.discussion_video;
  await addPoints(contactId, total, "discussion_start", "discussion", discussionId);
}

/** Award points for posting a comment. */
export async function awardPointsForNewComment(
  contactId: string,
  commentId: string
): Promise<void> {
  await addPoints(contactId, POINTS.comment, "comment", "comment", commentId);
}

/** Award points for adding a thumbs-up (or similar) reaction. Idempotent per user per target. */
export async function awardPointsForReaction(
  contactId: string,
  targetType: "discussion" | "comment",
  targetId: string
): Promise<void> {
  const referenceId = `reaction:${targetType}:${targetId}:${contactId}`;
  await addPoints(contactId, POINTS.reaction, "reaction", "reaction", referenceId);
}
