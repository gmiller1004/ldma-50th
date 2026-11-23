/**
 * LDMA Detector Academy at Stanton (March 11–14, 2027): event content, Shopify IDs,
 * and the Axiom Lite bundle reservation rule. Client-safe: no server imports.
 *
 * New members who buy the LDMA Lifetime Bundle — Garrett Axiom Lite inside the promo window attend
 * free with a $100 non-refundable deposit, returned as Stanton camp credit when they attend, or as camp
 * credit if they can't make these dates.
 * General and member registration are $800 on the Shopify event product; bundle buyers use the $100 deposit path.
 */

export const DETECTOR_ACADEMY_PATH = "/events/detector-academy-stanton-2027";
export const DETECTOR_ACADEMY_RESERVATION_PATH = "/members/detector-academy-reservation";
export const DETECTOR_ACADEMY_NAME = "LDMA Detector Academy";

/** Shopify product: general/member $800 registration + $100 deposit variant for Axiom Lite bundle buyers. */
export const DETECTOR_ACADEMY_PRODUCT_HANDLE = "detector-academy-stanton-2027";
export const DETECTOR_ACADEMY_PRODUCT_GID = "gid://shopify/Product/9142497706055";
export const DETECTOR_ACADEMY_DEPOSIT_VARIANT_GID = "gid://shopify/ProductVariant/49970472976455";
export const DETECTOR_ACADEMY_DEPOSIT_VARIANT_ID = "49970472976455";

export const DETECTOR_ACADEMY_DATES_LABEL = "March 11–14, 2027";
/** Optional secondary date line (empty once exact dates are published). Typed as string so `""` isn't narrowed to never in conditionals. */
export const DETECTOR_ACADEMY_DATES_NOTE: string = "";
export const DETECTOR_ACADEMY_CAPACITY = 100;
export const DETECTOR_ACADEMY_PRICE = 800;
export const DETECTOR_ACADEMY_DEPOSIT = 100;
export const DETECTOR_ACADEMY_LOCATION = "LDMA Stanton camp · 15650 Stanton Rd, Congress, AZ 85332";
export const DETECTOR_ACADEMY_HYPE_VIDEO = {
  src: "https://vuicppdtdiswkhul.public.blob.vercel-storage.com/events/detector-academy-hype-2027-UYuFtqVNrAetsnwg4YAzOyENFwpjWV.mp4",
  poster: "/images/events/detector-academy-hype-poster.jpg",
};
/** Klaviyo profile property for the "get notified" list. */
export const DETECTOR_ACADEMY_INTEREST_TAG = "detector_academy_2027";

export const AXIOM_LITE_BUNDLE_PRODUCT_ID = "7636626899015";
export const AXIOM_LITE_BUNDLE_PRODUCT_GID = `gid://shopify/Product/${AXIOM_LITE_BUNDLE_PRODUCT_ID}`;
export const AXIOM_LITE_BUNDLE_HANDLE = "ldma-lifetime-bundle-garrett-axiom-lite";

export const GARRETT_TRADEMARK_NOTICE =
  "Garrett, Axiom, GoldMaster, and Pro-Pointer are trademarks of Garrett Electronics, Inc. The LDMA Detector Academy is run by the Lost Dutchman's Mining Association and isn't sponsored by Garrett.";

/** Bundle purchases in this window qualify (Pacific time). */
export const ACADEMY_PROMO_WINDOW_START = "2026-11-02T00:00:00-08:00";
export const ACADEMY_PROMO_WINDOW_END = "2027-01-01T00:00:00-08:00";
export const ACADEMY_PROMO_DEADLINE_LABEL = "December 31, 2026";

export function isWithinAcademyPromoWindow(orderCreatedAt: string): boolean {
  const t = Date.parse(orderCreatedAt);
  return t >= Date.parse(ACADEMY_PROMO_WINDOW_START) && t < Date.parse(ACADEMY_PROMO_WINDOW_END);
}

export function isAcademyPromoOpen(now: Date = new Date()): boolean {
  return now.getTime() < Date.parse(ACADEMY_PROMO_WINDOW_END);
}

export type ShopifyOrderSummary = {
  createdAt: string;
  cancelled: boolean;
  financialStatus: string | null;
  productIds: string[];
  variantIds: string[];
};

export type AcademyReservationStatus =
  | { state: "eligible" }
  | { state: "already_reserved" }
  | { state: "no_bundle_order" };

const COUNTED_FINANCIAL_STATUSES = new Set(["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"]);

function counts(order: ShopifyOrderSummary): boolean {
  return !order.cancelled && COUNTED_FINANCIAL_STATUSES.has((order.financialStatus ?? "").toUpperCase());
}

/** Eligible when a paid Axiom Lite bundle order falls in the promo window and no deposit was bought yet. */
export function academyReservationStatus(orders: ShopifyOrderSummary[]): AcademyReservationStatus {
  if (orders.some((o) => counts(o) && o.variantIds.includes(DETECTOR_ACADEMY_DEPOSIT_VARIANT_ID))) {
    return { state: "already_reserved" };
  }
  const bundle = orders.some(
    (o) => counts(o) && o.productIds.includes(AXIOM_LITE_BUNDLE_PRODUCT_ID) && isWithinAcademyPromoWindow(o.createdAt)
  );
  return bundle ? { state: "eligible" } : { state: "no_bundle_order" };
}

/** One station or half-day topic in the week overview (not a minute-by-minute timetable). */
export type AcademyOverviewSession = {
  title: string;
  where: string;
  detail: string;
};

export type AcademyOverviewBlock = {
  label: string;
  title: string;
  summary: string;
  sessions: AcademyOverviewSession[];
};

/**
 * How the week works: ~100 participants rotate in groups of ~25 through six breakouts
 * (four core stations over Days 1–2, two advanced half-days on Day 3), then open hunt on Day 4.
 */
export const DETECTOR_ACADEMY_WEEK_INTRO =
  "You'll work in groups of about 25. Over the first three days you rotate through six breakout sessions—everyone completes all six. Morning and afternoon run in parallel stations at camp and on the claims so groups stay small. Day 4 is open hunting with trainers available for coaching.";

export const DETECTOR_ACADEMY_WEEK_OVERVIEW: AcademyOverviewBlock[] = [
  {
    label: "Days 1–2",
    title: "Four core stations",
    summary:
      "Four stations run each half-day. Your group rotates so that by the end of Day 2 you've done classroom basics, the test garden, a PI hunt, and VLF / GoldMaster time in the field.",
    sessions: [
      {
        title: "Classroom basics",
        where: "Camp",
        detail: "Setup, controls, air tests, and detector fundamentals before you hit the ground.",
      },
      {
        title: "Test garden",
        where: "Controlled ground",
        detail: "Gold at known sizes and depths so you learn what real targets sound like.",
      },
      {
        title: "PI hunt",
        where: "Claims",
        detail: "Pulse induction in real Stanton ground with trainers in your group.",
      },
      {
        title: "VLF / GoldMaster",
        where: "Claims",
        detail: "Smaller gold, different ground response, and coil work with a VLF detector.",
      },
    ],
  },
  {
    label: "Day 3",
    title: "Two advanced sessions",
    summary:
      "Two half-day advanced breakouts. Groups swap at midday so everyone gets both. Mentored coaching is built into the practice time; longer one-on-ones continue on Day 4.",
    sessions: [
      {
        title: "Ground & gear",
        where: "Camp and claims",
        detail:
          "Hot ground and EMI, plus coil selection—short teach, then hands-on comparing coils on the same patch while instructors rotate for quick mentored check-ins.",
      },
      {
        title: "Working a claim",
        where: "Claims",
        detail:
          "Mapping and walking a claim, then spread out to practice with trainers floating for mentored coaching blocks.",
      },
    ],
  },
  {
    label: "Day 4",
    title: "Open hunt & coaching",
    summary:
      "Hunt Stanton's claims on your own schedule. Trainers stay available for one-on-one coaching and fine-tuning your detector.",
    sessions: [
      {
        title: "Open hunting",
        where: "Claims",
        detail: "Put the week into practice. Ask for coaching whenever you want a second set of ears on your machine.",
      },
    ],
  },
];

export type AcademyTrainer = { name: string; role: string; bio: string; photo?: string };

export const DETECTOR_ACADEMY_TRAINERS: AcademyTrainer[] = [
  {
    name: "Dominic Ricci",
    role: "Executive Director of Operations, GPAA & LDMA",
    photo: "/images/trainers/dominic-ricci.jpg",
    bio: "Has led GPAA and LDMA operations since 2010, designing and hosting LDMA's signature events nationwide, from Dirt Parties and the Digger's Gold Mining Academy to the Great Gold Dredge-Off and Battle Across the Desert. He's been prospecting since age 9, when he first panned a creek on his grandparents' Northern California ranch. He'll host the academy and help lead field sessions on Stanton's claims.",
  },
  {
    name: "Kevin Hoagland",
    role: "Host, Gold Trails · GPAA & LDMA",
    photo: "/images/trainers/kevin-hoagland.jpg",
    bio: "A veteran prospector with 55 years in the field, Kevin built his first metal detector at age nine. He hosts GPAA's Gold Trails, appeared on HISTORY Channel's Lost Gold of the Aztecs, and has led Metal Detecting 101 training for years, turning complex detector settings into simple, repeatable field routines. He'll work alongside participants in the test garden and on the hunts.",
  },
  {
    name: "John Mathis",
    role: "Caretaker, LDMA Stanton Camp",
    photo: "/images/trainers/john-mathis.jpg",
    bio: "An old-school prospector with more than 50 years in the field across six western states. He found a 2½-ounce nugget in the American River at age 10 and has been chasing gold ever since. Stanton's caretaker since 2018 and a Master Instructor for the Digger's Gold Mining Academy, he knows the camp's claims firsthand and will lead the claim orientation and share local tips.",
  },
  {
    name: "Heath Jones",
    role: "Founder, History Seekers",
    photo: "/images/trainers/heath-jones.jpg",
    bio: "Founder of History Seekers and a detectorist since the early 1990s. After a career in law enforcement he spent nearly nine years managing a major metal-detecting retailer, working with manufacturers and testing prototypes before launching History Seekers' YouTube and Facebook channels in 2019. Best known for Civil War relic hunting, he also hunts gold on LDMA ground and at AKAU near Nome. He'll bring field settings and real-machine coaching from someone who sells—and digs—the gear.",
  },
  {
    name: "Amber Evans",
    role: "History Seekers · Newcomer coaching",
    photo: "/images/trainers/amber-evans.jpg",
    bio: "History Seekers instructor who coaches first-timers on mineralized ground. After learning gold detecting at AKAU near Nome—nine pieces in her first hour, 118 by trip's end—she's hunted LDMA claims at Stanton and helps newcomers turn confusing signals into confident digs alongside Heath Jones.",
  },
  {
    name: "Dylan Pritchard",
    role: "B-Kings Outdoors · Stanton / Rich Hill",
    photo: "/images/trainers/dylan-pritchard.jpg",
    bio: "An Arizona nugget hunter based near Congress who works the Stanton / Rich Hill country under B-Kings Outdoors. He's known for big Garrett Axiom finds—including multi-ounce and specimen gold from Rich Hill—and teaches detector classes for prospectors learning hot desert ground. When he's not filming hunts, he's in the same hills academy participants will walk: local knowledge, coil choice, and how to turn a whisper into a dig.",
  },
];

/** What's in the $800 registration (not camping or meals). */
export const DETECTOR_ACADEMY_INCLUDED = [
  "Four days of classroom and field training",
  "Test gardens with gold at known depths",
  "Guided hunts on Stanton's claims",
  "One-on-one tuning on your own detector",
  "Claim orientation with Stanton's caretaker",
  "Certificate of completion",
];

/** Core skills — PI and VLF detectors first; pinpointer folded into field recovery. */
export const DETECTOR_ACADEMY_LEARNING = [
  {
    title: "Pulse induction: Axiom & Axiom Lite",
    body: "Ground balance, soil settings, sensitivity, and coil choice on the same PI platform—so you can hear deep gold in mineralized desert dirt and trust what the machine is telling you.",
  },
  {
    title: "VLF: GoldMaster 24k",
    body: "Small, shallow gold, iron discrimination, hot rocks, and when a VLF outperforms pulse induction—so you know which tool to swing on which patch.",
  },
  {
    title: "Field recovery & claim craft",
    body: "Pinpointer habits that keep gold in the scoop, faster digs, and how to walk a claim with trainers nearby—test gardens first, then real Stanton ground.",
  },
];

/** Outcomes only — no overlap with the included checklist. */
export const DETECTOR_ACADEMY_GAINS = [
  "Settings you trust on mineralized desert ground",
  "How gold sounds at different sizes and depths",
  "Your own detector dialed in for the dirt you hunt",
  "Hours in the field with coaches who dig this ground",
];

export const DETECTOR_ACADEMY_WHO_FOR = [
  {
    title: "New detectorists",
    body: "You've got a machine (or a new Axiom Lite) and want real ground, not another YouTube rabbit hole—small groups and coaches who start where you are.",
  },
  {
    title: "Experienced hunters",
    body: "You already dig gold and want sharper settings, coil choice, and claim craft on Stanton / Rich Hill dirt with people who hunt it year-round.",
  },
  {
    title: "Members and the public",
    body: "LDMA members and non-members both register. Every participant hunts Stanton's claims during scheduled sessions; camping is separate either way.",
  },
];

export const DETECTOR_ACADEMY_PROOF = [
  {
    title: "Real gold ground",
    body: "Stanton sits in Arizona's Rich Hill country—LDMA claims you hunt with trainers, not a parking-lot demo.",
  },
  {
    title: "Built from Diggers Academy",
    body: "Same LDMA education line that produced Diggers Gold Mining Academy masters—now focused on detectors, with guest coaches from History Seekers and B-Kings Outdoors.",
  },
  {
    title: "Coaches who dig it",
    body: "From Kevin Hoagland's Metal Detecting 101 and Gold Trails to Dylan Pritchard's Rich Hill nuggets and Heath Jones in the field—instruction from people who swing coils for a living.",
  },
];

export const DETECTOR_ACADEMY_TRAINERS_INTRO =
  "LDMA's operations and Stanton team host the week, joined by guest instructors from History Seekers and B-Kings Outdoors—classroom to one-on-one tuning on the claims.";

export const DETECTOR_ACADEMY_DISCOUNT_ELIGIBILITY =
  "25% off for GPAA or LDMA members, military (active or veteran), first responders, and teachers. Apply on this page; qualified applicants get code ACADEMY25 by email.";

export const DETECTOR_ACADEMY_PRICE_FRAME = `$${DETECTOR_ACADEMY_PRICE} for four days—about $${DETECTOR_ACADEMY_PRICE / 4}/day of training, claim access, and coaches. Camping and meals are separate.`;

export const DETECTOR_ACADEMY_FAQ = [
  {
    q: "When is the academy?",
    a: `${DETECTOR_ACADEMY_DATES_LABEL} at LDMA's Stanton camp in Congress, Arizona.`,
  },
  {
    q: "How do I register?",
    a: `Register on this page for $${DETECTOR_ACADEMY_PRICE}. If you join LDMA with the Garrett Axiom Lite bundle by ${ACADEMY_PROMO_DEADLINE_LABEL}, you can reserve your free spot with a $${DETECTOR_ACADEMY_DEPOSIT} deposit instead.`,
  },
  {
    q: "Who gets a discount?",
    a: DETECTOR_ACADEMY_DISCOUNT_ELIGIBILITY,
  },
  {
    q: "How does free registration with the Axiom Lite bundle work?",
    a: `Join LDMA with the Garrett Axiom Lite bundle by ${ACADEMY_PROMO_DEADLINE_LABEL}, then reserve your spot with a $${DETECTOR_ACADEMY_DEPOSIT} non-refundable deposit. When you attend, the $${DETECTOR_ACADEMY_DEPOSIT} comes back to you as Stanton camp credit for site fees or other camp purchases. If you can't make these dates, it becomes Stanton camp credit instead.`,
  },
  {
    q: "Do I need my own detector?",
    a: "Yes—bring your own so you leave with it dialed in. Training centers on the Garrett Axiom / Axiom Lite and GoldMaster 24k; fundamentals apply to any detector. Bundle buyers train on their new Axiom Lite.",
  },
  {
    q: "Are camping and meals included?",
    a: "No. Book your Stanton campsite separately (LDMA members use the member nightly rate). Plan your own meals—camp kitchens and nearby options in Congress / Wickenburg.",
  },
  {
    q: "Can non-members hunt the claims?",
    a: "Yes. Every registered participant hunts Stanton's claims with trainers during scheduled sessions.",
  },
  {
    q: "How many spots are there?",
    a: `The academy is limited to ${DETECTOR_ACADEMY_CAPACITY} participants.`,
  },
];
