-- Seed Stanton claims: Little Picker South (standalone) + Stanton Group Claims (5 member claims)
-- Run after migrate-claims.sql
-- Stanton Group member claims: Boyz, Boyz 2, Skimo, Stanton West, Stanton East

INSERT INTO claims (camp_slug, name, slug, description, sort_order, member_claim_names) VALUES
  ('stanton-arizona', 'Little Picker South', 'little-picker-south', NULL, 1, NULL),
  ('stanton-arizona', 'Stanton Group Claims', 'stanton-group-claims', 'Five claims in the Stanton group. Get claim-specific info from camp caretakers.', 2, 
   '["Boyz", "Boyz 2", "Skimo", "Stanton West", "Stanton East"]'::jsonb)
ON CONFLICT (camp_slug, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  member_claim_names = EXCLUDED.member_claim_names;
