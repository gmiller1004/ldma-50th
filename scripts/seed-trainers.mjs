#!/usr/bin/env node
/**
 * Idempotent draft seed for the LDMA Certified Trainers directory.
 * Upserts by slug. Re-running refreshes name, title, summary, and bio.
 * It does not change published_at, contact fields, sort order, or an existing photo.
 *
 * Usage: node --env-file=.env.local scripts/seed-trainers.mjs
 *    or: npm run db:trainers:seed
 *
 * Bios are written from the staff resume documents and kept consistent with
 * the public Detector Academy blurbs. Contact fields stay blank.
 */
import pg from "pg";
const { Client } = pg;

const connectionString =
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "Error: STORAGE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL not set. Load .env.local or set the variable."
  );
  process.exit(1);
}

const trainers = [
  {
    slug: "dominic-ricci",
    name: "Dominic Ricci",
    title: "Executive Director of Operations, GPAA & LDMA",
    summary:
      "Has led GPAA and LDMA operations since 2010, designing and hosting signature events nationwide, from Dirt Parties and the Digger's Gold Mining Academy to the Great Gold Dredge-Off and Battle Across the Desert. He has been prospecting since age 9.",
    photoUrl: "/images/trainers/dominic-ricci.jpg",
    sortOrder: 10,
    bodyHtml: `
<h2>About Dominic</h2>
<p>Dominic Ricci is Executive Director of Operations for the Gold Prospectors Association of America and the Lost Dutchman's Mining Association. He has led GPAA and LDMA operations since 2010, creating and hosting prospecting, dredging, and metal detecting events with a focus on hands-on learning, member experience, and bringing new people into the hobby.</p>
<h2>Events and instruction</h2>
<p>He designs, hosts, and travels to LDMA camp events nationwide, including Dirt Parties, Digger's Expeditions, Digger's Gold Mining Academy, and the Great Gold Dredge-Off. In 2016 he redesigned the GPAA-LDMA Gold Mining Outings with Kevin Hoagland, moving them to a seven-day format with a Meet 'n' Greet Miners Barbecue and a Miners' Dinner. He organized LDMA's first Battle Across the Desert in 2020, a three-week gold-recovery competition between the Stanton, Arizona and Duisenburg, California camps that opened both camps to the public. He also oversees the GPAA Gold &amp; Treasure Shows and Expos, including the Las Vegas expo.</p>
<p>His teaching covers beginner prospecting: panning, equipment, and reading the ground, along with gold mining, dredging, and metal detecting events.</p>
<h2>Background</h2>
<p>Dominic started prospecting at age 9 on his grandparents' Northern California ranch, panning a creek with his grandfather. Before GPAA and LDMA, he worked in business management, marketing, and hospitality, including sales leadership and sales training.</p>
<p>He wants learning to be hands-on and full of questions: slow down, learn from experienced miners, and understand why you are digging before you start moving dirt.</p>
<blockquote><p>Which camp is my favorite? The one I'm in, because I'm gonna make sure you have a good time.</p></blockquote>
`.trim(),
  },
  {
    slug: "john-boudreau",
    name: "John Boudreau",
    title: "Dredge Master, Great Gold Dredge-Off",
    summary:
      "Gold dredger and instructor with more than 40 years of mining and dredging experience, from East Coast rivers to Nome, Alaska. He leads dredging instruction at LDMA's Great Gold Dredge-Off and has trained more than 1,000 prospectors.",
    photoUrl: null,
    sortOrder: 20,
    bodyHtml: `
<h2>About John</h2>
<p>John Boudreau is Dredge Master and lead dredging instructor for LDMA's Digger's Great Gold Dredge-Off. He is a gold dredger and instructor with more than 40 years of mining and dredging experience, from East Coast rivers to the gold-bearing waters of Nome, Alaska.</p>
<h2>What he teaches</h2>
<p>At the Dredge-Off he leads the dredging operation and the instruction: river geology, finding productive ground, equipment setup, dredging technique, gold recovery, troubleshooting, and safe underwater practices. He has operated dredges, worked mining operations, built dredging equipment, and helped more than 1,000 prospectors learn to dredge and recover gold.</p>
<ul>
<li>In 2017 he was host, leader, and master instructor for LDMA's Official Dredgers Camp at Vein Mountain, North Carolina.</li>
<li>That same year he was a key instructor at the Gold Prospectors Boot Camp at LDMA Loud Mine, and supported the National Outings at Loud Mine and Vein Mountain.</li>
</ul>
<p>His 2027 Dredge-Off instruction includes Vein Mountain, North Carolina (April 20–24), Loud Mine, Georgia (June 8–12), and Burnt River, Oregon (July 13–17).</p>
<h2>Approach</h2>
<p>The teaching is old-school and hands-on: keep it simple, learn the ground, let the nozzle do the work, and go find some gold. As he puts it, dredgers dig deep.</p>
`.trim(),
  },
  {
    slug: "john-mathis",
    name: "John Mathis",
    title: "Caretaker, LDMA Stanton Camp",
    summary:
      "An old-school prospector with more than 50 years in the field across six western states. Stanton's caretaker since 2018 and a Master Instructor for the Digger's Gold Mining Academy. He found a 2½-ounce nugget in the American River at age 10.",
    photoUrl: "/images/trainers/john-mathis.jpg",
    sortOrder: 30,
    bodyHtml: `
<h2>About John</h2>
<p>John Mathis is caretaker of LDMA's Stanton Camp in Congress, Arizona, and a Master Gold Prospecting Instructor for Digger's Gold Mining Academy. He is an old-school prospector with more than 50 years in the field across California, Nevada, Arizona, Oregon, Washington, and Texas.</p>
<h2>Stanton Camp</h2>
<p>He has hosted Stanton since 2018, running day-to-day operations of the 120-acre camp in the Weaver–Rich Hill Mining District. He led the geology study and test-hole program for LDMA's first Push Dig Dirt Party in spring 2019, using a backhoe and excavator to stockpile gold-bearing material for 152 participants. He was field lead for Digger's Expedition: Desert Mayhem in 2020, and he led Stanton in LDMA's first Battle Across the Desert that year against the Duisenburg camp.</p>
<h2>Instruction</h2>
<p>At Digger's Gold Mining Academy he teaches classroom and field sessions on geological clues, site research, dry washing, and recovery methods. The focus is why a technique works, not only how to do it, for beginners through experienced prospectors. He has mentored more than 100 prospectors, including many young people finding their first gold.</p>
<ul>
<li>Reading the ground: geology, terrain, and site research</li>
<li>Desert dry washing and puffers</li>
<li>Wet mining, sluicing, and gold recovery</li>
<li>Test digging and planning larger digs</li>
</ul>
<h2>Background</h2>
<p>At age 10 he found a 2½-ounce gold nugget on a gravel bar in the American River near Placerville, California. He sold it for a new bicycle and has been chasing gold ever since, starting with his grandmother's pie pans.</p>
<p>His style is straight-shooting, patient, and hands-on. Not every hole produces gold, so learn from it, adjust, and keep exploring.</p>
`.trim(),
  },
  {
    slug: "peggy-schlichter",
    name: "Peggy Schlichter",
    title: "Caretaker, LDMA Duisenburg Camp",
    summary:
      "Caretaker of LDMA's Duisenburg Camp, a 160-acre high-desert camp near Randsburg in California's Mojave Desert, for more than nine years. A desert prospector since 2016 who helps visitors with dry washing, local geology, and getting started.",
    photoUrl: null,
    sortOrder: 40,
    bodyHtml: `
<h2>About Peggy</h2>
<p>Peggy Schlichter is caretaker of LDMA's Duisenburg Camp, a 160-acre high-desert camp near Randsburg in California's Mojave Desert. She has been the camp's welcoming face for more than nine years, supporting members and visitors at the RV and tent camp and building a community of regulars, newcomers, and returning members.</p>
<h2>Prospecting</h2>
<p>A desert prospector since 2016, she started with dry washing and expanded into the geology, geography, water movement, and history that point to where gold may be. She helps visitors with dry washers, reading the ground, and the area's geological features, and she has studied the Duisenburg landscape and the clues it leaves behind.</p>
<p>She led Duisenburg in LDMA's first Battle Across the Desert in November and December 2020, a three-week gold-recovery competition against the Stanton, Arizona camp that brought many new prospectors to camp.</p>
<h2>Approach</h2>
<p>Warm, outgoing, and quick with a joke, she wants every visitor to feel at home and want to come back. There is always something new to learn, and sometimes all it takes is looking at the land a little differently.</p>
<blockquote><p>We ain't never met a stranger here. That's the best part.</p></blockquote>
`.trim(),
  },
];

const upsertSql = `
INSERT INTO trainers (
  slug, name, title, summary, body_html, photo_url,
  contact_email, contact_phone, website_url,
  sort_order, published_at, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6,
  NULL, NULL, NULL,
  $7, NULL, now(), now()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body_html = EXCLUDED.body_html,
  photo_url = COALESCE(trainers.photo_url, EXCLUDED.photo_url),
  updated_at = now()
RETURNING slug, published_at, photo_url
`;

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Seeding trainer drafts...");
  try {
    for (const trainer of trainers) {
      const result = await client.query(upsertSql, [
        trainer.slug,
        trainer.name,
        trainer.title,
        trainer.summary,
        trainer.bodyHtml,
        trainer.photoUrl,
        trainer.sortOrder,
      ]);
      const row = result.rows[0];
      const status = row.published_at ? "published (left as published)" : "draft";
      console.log(`  ✓ ${row.slug} — ${status}${row.photo_url ? "" : ", no photo"}`);
    }
  } finally {
    await client.end();
  }
  console.log("Done. Trainers are drafts until staff publish them.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
