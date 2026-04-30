/**
 * Curated knowledge chunks for the LDMA Assistant (retrieval / RAG).
 *
 * Source: Public copy from this Next.js app (same content as myldma.com).
 * Update chunks when you change marketing pages, pricing, or camp details.
 *
 * Last content sync: 2026-04-30
 */

export type KnowledgeChunk = {
  /** Stable id for logging and deduplication */
  id: string;
  /** Lowercase keywords for simple routing / keyword search */
  topics: string[];
  title: string;
  /** Public path on myldma.com where a visitor can read more */
  source: string;
  /** Plain text only — no HTML */
  content: string;
};

export const LDMA_KNOWLEDGE_VERSION = "2026-04-30";

export const LDMA_KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [
  {
    id: "site-identity",
    topics: ["myldma", "website", "50th", "anniversary", "home"],
    title: "This website (myldma.com)",
    source: "/",
    content: `The myldma.com site is part of LDMA's 50th Anniversary celebration (2026). It showcases the Lost Dutchman's Mining Association, DirtFest 2026 and other events, memberships, campgrounds, 50th anniversary merchandise, and member stories. Use the main navigation: Campgrounds, Events, Memberships, Shop, 50 Years, Blog, and Contact.`,
  },
  {
    id: "about-ldma",
    topics: ["about", "history", "what is ldma", "founded", "1976", "claims", "members"],
    title: "About LDMA",
    source: "/about",
    content: `The Lost Dutchman's Mining Association (LDMA) has been America's premier gold mining and camping club since 1976, combining gold prospecting with RV camping on private, gold-bearing land. The association has 6,500+ members, 12 private campgrounds across multiple states, and 30+ mining claims with exclusive member access — members keep what they find. The organization emphasizes family-friendly camping, community, and outdoor adventure. See /about for the full story.`,
  },
  {
    id: "timeline-snippet",
    topics: ["history", "buzzard", "massie", "italian bar", "stanton", "1976", "1977"],
    title: "LDMA history (highlights)",
    source: "/",
    content: `LDMA was founded in 1976 by George "Buzzard" Massie. Early milestones include the first outing at Italian Bar, California (Thanksgiving 1976 on the South Fork Stanislaus River), acquisition of Italian Bar in 1977 (160 patented acres on 1850s gold rush ground), expansion including the Stanton, Arizona ghost town in the early 1980s, and growth of campgrounds across California, Arizona, Oregon, Georgia, North Carolina, South Carolina, and beyond.`,
  },
  {
    id: "membership-overview",
    topics: ["membership", "join", "price", "lifetime", "cost", "refund", "gpaa", "companion"],
    title: "Membership overview and pricing (site copy)",
    source: "/memberships",
    content: `LDMA offers Lifetime membership. As shown on the Memberships page: promotional pricing has been $2,000 (compared to a regular price of $3,750) during the 50th Anniversary celebration — always confirm current price on /memberships or by phone. Benefits highlighted on the site include: access to all 12 private campgrounds; gold prospecting on patented claims; family-inclusive membership (spouse and children under 18); up to 4 guests per visit; stays up to 6 months per visit; camping from about $6/night dry and about $12/night for full hookups (rates vary by camp); paydirt bag, gold pans, and scoops; membership card, badges, and decals; 30-day refund window; no prospecting experience required; community of 6,500+; optional GPAA integration for additional acreage; companion add-on for family; equipment discounts and partner events (e.g. Minelab, Garrett). For exact fees, payment plans, and add-ons, use /memberships or call 888-465-3717.`,
  },
  {
    id: "membership-bundle-offer-2026",
    topics: [
      "membership bundles",
      "detector bundle",
      "gm1000",
      "gm2000",
      "garrett 24k",
      "bundle price",
      "gpaa lifetime",
      "companion",
      "transferability",
      "pre-paid transfer",
    ],
    title: "2026 detector bundle membership offer",
    source: "/memberships",
    content: `The current 2026 promotional Memberships page can present detector bundles instead of the prior single Lifetime + add-ons flow. Bundle pricing is $3,500 (Minelab GM1000 or Garrett GoldMaster 24k) and $4,000 (Minelab GM2000). Each bundle includes LDMA Lifetime, GPAA Lifetime, Companion, Transferability, and Pre-Paid Transfer. The page highlights combined retail comparisons around $10,409-$11,498 depending on detector and estimated savings around $6,900-$7,500. Detector retail references used on the page are GM1000 $999, Garrett 24k $910, GM2000 $1,999.`,
  },
  {
    id: "membership-route-switching",
    topics: ["memberships route", "legacy membership", "bundle toggle", "env var", "launch toggle"],
    title: "Membership route toggle (legacy vs bundle)",
    source: "/memberships",
    content: `The /memberships route supports two experiences: a legacy memberships page and a newer bundle-focused page. The app can be toggled by environment variable NEXT_PUBLIC_MEMBERSHIP_EXPERIENCE. Setting it to legacy shows the older membership page; setting to bundle (or leaving unset in current code defaults) shows the detector-bundle page. This allows temporary bundle promotions and easy rollback to the old experience when a promotion ends.`,
  },
  {
    id: "membership-benefits-list",
    topics: ["benefits", "what included", "guests", "camping", "gold", "how long stay"],
    title: "What membership includes (summary)",
    source: "/memberships",
    content: `Members get access to all 12 LDMA campgrounds, gold prospecting on patented claims, family-inclusive coverage, up to 4 guests per visit, stays up to 6 months at a time, member camping rates (dry camping from roughly $6/night, hookups roughly $12/night; varies by campground), and they keep 100% of gold and minerals found on LDMA claims. The site also mentions fishing, hiking, ATV trails, metal detecting, relic hunting, gem hunting at select camps, and community events.`,
  },
  {
    id: "campgrounds-overview",
    topics: ["campgrounds", "how many", "camping", "private", "states", "primitive"],
    title: "Campgrounds overview",
    source: "/campgrounds",
    content: `LDMA operates 12 private campgrounds across 8 states. Gold-bearing, patented properties. Membership is required for campground access (except for some public event registrations — see /events). Nine of the 12 campgrounds are developed with caretakers; five of those offer RV hookups (full or partial). Three primitive campgrounds are in Northern California, Nevada, and Colorado for a more rugged experience. The site lists "Additional Primitive Properties" (Scott River, Finley, High Divide, Leadville) with self-contained camping on patented claims. Public event visitors can browse /events for registration.`,
  },
  {
    id: "camp-stanton",
    topics: ["stanton", "arizona", "arizona congress", "ghost town"],
    title: "Stanton, Arizona",
    source: "/campgrounds/stanton-arizona",
    content: `Stanton, Arizona — flagship camp, historic ghost town. About 120 patented acres with full hookups, museum, clubhouse, laundry, and exclusive claims. Address: 15650 Stanton Rd, Congress, AZ 85332. Tagline on the site: "Flagship Camp • Historic Ghost Town."`,
  },
  {
    id: "camp-italian-bar",
    topics: ["italian bar", "columbia", "california", "river", "stanislaus"],
    title: "Italian Bar, California",
    source: "/campgrounds/italian-bar-california",
    content: `Italian Bar, California — first LDMA camp; river gold on the South Fork Stanislaus River where many members found their first gold. About 160 acres. Address: 24997 Italian Bar Rd, Columbia, CA 95310. Tagline: "First LDMA Camp • River Gold."`,
  },
  {
    id: "camp-duisenburg",
    topics: ["duisenburg", "mojave", "california", "ridgecrest", "randsburg"],
    title: "Duisenburg, California",
    source: "/campgrounds/duisenburg-california",
    content: `Duisenburg, California — high desert near Randsburg. About 160 acres Mojave Desert. Showers, clubhouse, primitive RV/tent camping. Address: L.D.M.A. Clubhouse, Ridgecrest, CA 93555. Tagline: "High Desert Oasis."`,
  },
  {
    id: "camp-blue-bucket",
    topics: ["blue bucket", "oregon", "huntington"],
    title: "Blue Bucket, Oregon",
    source: "/campgrounds/blue-bucket-oregon",
    content: `Blue Bucket, Oregon — scenic gold and wildlife. About 118 acres with hookups, showers, laundry; gold in stream and bench gravel. Address: 31097 Valentine Lane, Huntington, OR 97907. Tagline: "Scenic Gold & Wildlife."`,
  },
  {
    id: "camp-burnt-river",
    topics: ["burnt river", "oregon", "durkee"],
    title: "Burnt River, Oregon",
    source: "/campgrounds/burnt-river-oregon",
    content: `Burnt River, Oregon — wilderness river camp. About 136 acres along Burnt River and Deer Creek. Dry camping with showers, clubhouse, dump station. Address: 28089 Burnt River Canyon Ln, Durkee, OR 97905. Tagline: "Wilderness River Camp."`,
  },
  {
    id: "camp-oconee",
    topics: ["oconee", "south carolina", "tamassee", "gems", "blue ridge"],
    title: "Oconee, South Carolina",
    source: "/campgrounds/oconee-south-carolina",
    content: `Oconee, South Carolina — rustic Blue Ridge setting. About 120 acres with panning station, equipment rentals, fire pit, and gem hunting (quartz, garnets, rubies). Address: 475 LDMA Dr, Tamassee, SC 29686. Tagline: "Rustic Blue Ridge Gem & Gold."`,
  },
  {
    id: "camp-loud-mine",
    topics: ["loud mine", "georgia", "dahlonega", "cleveland ga"],
    title: "Loud Mine, Georgia",
    source: "/campgrounds/loud-mine-georgia",
    content: `Loud Mine, Georgia — Dahlonega gold belt. About 37 acres with hookups, pavilion, stream gold near swimming and kayaking. Address: 575 Abb Helton Rd, Cleveland, GA 30528. Tagline: "Dahlonega Gold Belt."`,
  },
  {
    id: "camp-vein-mountain",
    topics: ["vein mountain", "north carolina", "nebo", "blue ridge"],
    title: "Vein Mountain, North Carolina",
    source: "/campgrounds/vein-mountain-north-carolina",
    content: `Vein Mountain, North Carolina — Blue Ridge setting. About 130 acres with quartz veins, alluvial gravel, hookups, clubhouse, family-friendly atmosphere. Address: 3216 Vein Mt. Rd, Nebo, NC 28761. Tagline: "Mother Lode in the Blue Ridge."`,
  },
  {
    id: "campgrounds-primitive-extra",
    topics: ["primitive", "scott river", "finley", "high divide", "leadville", "nevada", "colorado"],
    title: "Additional primitive properties",
    source: "/campgrounds",
    content: `The myldma.com campgrounds page lists four additional primitive properties: Scott River, California — 28 acres at historic Steelhead town site where Scott River meets Klamath River; limited hookups. Finley, California — 140 acres at elevation with North Fork Salmon River and Russian Creek; primitive, shaded, self-contained. High Divide, Nevada — about 20 acres at 6,000+ ft south of Tonopah; remote primitive placer gold/silver/turquoise; self-contained only. Leadville, Colorado — 60 acres in a premier mining district at 10,430 ft; seasonal creek; primitive, self-contained.`,
  },
  {
    id: "events-overview",
    topics: ["events", "dirt fest", "dirtfest", "detector", "gold n bbq", "register", "tickets", "2026"],
    title: "Events and registration",
    source: "/events",
    content: `Public LDMA events (Dirt Fest, detector days, Gold N BBQ, and more) are listed on /events. Events are tied to Shopify products in the events collection; visitors register by purchasing the appropriate ticket. Event types include Dirt Fest, Detector Events, and Other. Filters include camp location (e.g. Stanton, Italian Bar, Duisenburg, Blue Bucket, Burnt River, Oconee, Loud Mine, Vein Mountain). Logged-in members may see member-only pricing on variants when configured in Shopify. For details about what Dirt Fest and detector events include, see /about-events.`,
  },
  {
    id: "about-events-types",
    topics: ["dirt fest", "detector", "vip", "paydirt", "family"],
    title: "Types of LDMA events (About Events page)",
    source: "/about-events",
    content: `Dirt Fest: multi-day flagship gatherings with mining and detector activities, paydirt, prize drawings, LDMA swag, and VIP options. Detector events: focused metal-detecting days and demos, often with manufacturer partners. Other events: Gold N BBQ, camp-specific gatherings, member work days, seasonal celebrations. Events are held at LDMA campgrounds across multiple states, and tickets typically cover everyone in your campsite. The page emphasizes community, family-friendly atmosphere, and structured activities plus time to prospect on camp claims.`,
  },
  {
    id: "contact-and-phone",
    topics: ["phone", "call", "email", "contact", "support", "help"],
    title: "Contact LDMA",
    source: "/contact",
    content: `Phone: 888-465-3717 — for membership, campground reservations, and general inquiries. Email: lostdutchman@myldma.com — typically responses within 1–2 business days. The Contact page (/contact) also links to the main site for membership, campground bookings, shop, and event info. For the most accurate, up-to-date answers on account-specific, billing, or complex policy questions, use the phone number.`,
  },
  {
    id: "faq-compiled",
    topics: [
      "faq",
      "guests",
      "family",
      "private",
      "how long",
      "dig",
      "activities",
      "developed",
      "rates",
      "keep gold",
    ],
    title: "FAQ (compiled from /faq)",
    source: "/faq",
    content: `Q: What is LDMA? A: A gold mining and camping club since 1976 with exclusive access to 12 private campgrounds and 30+ mining claims across eight states; 6,500+ members. Q: Are campgrounds private? A: Yes, member use; some open-house mining events for non-members. Members can stay up to six months per open season per property. Q: Guests? A: Friends and family welcome with you in your rig; mining on claims is members-only; guests can help process concentrates at camp. Q: How to join? A: Lifetime membership — see /memberships or call 888-465-3717. Q: Where to dig? A: All campgrounds are on or near gold-bearing land; check Campgrounds and Directory for specifics. Q: Other activities? A: Fishing, hiking, ATV, treasure hunting, rock/gem collecting, gold prospecting; co-sponsored events with Minelab and Garrett. Q: Developed vs primitive? A: Nine of 12 developed with caretakers; five of those have RV hookups; three primitive in Northern California, Nevada, Colorado. Q: Camping cost? A: Member rates ~$6/night dry, ~$12/night full hookups; varies by camp. Q: Keep gold? A: Yes — 100% on LDMA claims. Q: 50th anniversary? A: 2026 celebration with events, merch, and experiences — see site.`,
  },
  {
    id: "shop-and-blog",
    topics: ["shop", "merch", "store", "blog", "50 years"],
    title: "Shop and blog",
    source: "/shop",
    content: `The Shop section (/shop) sells LDMA merchandise including 50th Anniversary items. The Blog (/blog) hosts articles and stories. Product availability and prices are shown in the Shopify storefront; do not invent specific product names or prices not shown on the live shop.`,
  },
];

/** All chunk ids (for tests and admin tooling). */
export function listKnowledgeChunkIds(): string[] {
  return LDMA_KNOWLEDGE_CHUNKS.map((c) => c.id);
}
