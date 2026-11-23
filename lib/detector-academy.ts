/**
 * LDMA Detector Academy at Stanton (March 11–14, 2027): event content, Shopify IDs,
 * and the Axiom Lite bundle reservation rule. Client-safe: no server imports.
 *
 * New members who buy the LDMA Lifetime Bundle — Garrett Axiom Lite inside the promo window attend
 * free with a $100 non-refundable deposit, returned as Stanton camp credit when they attend, or as camp
 * credit if they can't make these dates.
 * Everyone else joins the updates list until registration opens.
 */

export const DETECTOR_ACADEMY_PATH = "/events/detector-academy-stanton-2027";
export const DETECTOR_ACADEMY_RESERVATION_PATH = "/members/detector-academy-reservation";
export const DETECTOR_ACADEMY_NAME = "LDMA Detector Academy";

/** Shopify product: deposit variant for bundle buyers; $800 variants held at zero until registration opens. */
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
];

export const DETECTOR_ACADEMY_INCLUDED = [
  "All four days of classroom and field training",
  "Test gardens with gold at known depths",
  "Guided hunts on Stanton's claims",
  "One-on-one tuning on your own detector",
  "Claim orientation with Stanton's caretaker",
  "Certificate of completion",
];

export const DETECTOR_ACADEMY_LEARNING = [
  {
    title: "Garrett Axiom & Axiom Lite",
    body: "The Axiom and Axiom Lite are the same pulse induction platform. Learn ground balance, soil settings, sensitivity, coil choice, and how to read what you're hearing for deep gold in mineralized ground.",
  },
  {
    title: "Garrett GoldMaster 24k",
    body: "How to use the 24k for small, shallow gold, including iron discrimination, working around hot rocks, and when it outperforms a pulse induction detector.",
  },
  {
    title: "Garrett Pro-Pointer II",
    body: "Recover targets faster with Garrett's pinpointer—proportional audio and vibration, 360° side-scan, and field habits that keep gold in the scoop instead of the spoil pile.",
  },
  {
    title: "Time in the field",
    body: "Test gardens with gold buried at known depths, guided hunts on Stanton's claims, and one-on-one tuning on your own detector.",
  },
];

export const DETECTOR_ACADEMY_GAINS = [
  "Settings you understand and trust on mineralized desert ground",
  "A feel for how gold sounds at different sizes and depths",
  "Faster recoveries and good claim etiquette",
  "Your own detector dialed in for the ground you hunt",
  "Hours in the field with LDMA trainers",
  "A certificate of completion",
];

export const DETECTOR_ACADEMY_FAQ = [
  {
    q: "When is the academy?",
    a: `${DETECTOR_ACADEMY_DATES_LABEL} at LDMA's Stanton camp in Congress, Arizona.`,
  },
  {
    q: "How do I register?",
    a: `Registration opens soon, and everyone who's told us they're interested hears first. If you join LDMA with the Garrett Axiom Lite bundle by ${ACADEMY_PROMO_DEADLINE_LABEL}, you can reserve your free spot now.`,
  },
  {
    q: "How does free registration with the Axiom Lite bundle work?",
    a: `Join LDMA with the Garrett Axiom Lite bundle by ${ACADEMY_PROMO_DEADLINE_LABEL}, then reserve your spot with a $${DETECTOR_ACADEMY_DEPOSIT} non-refundable deposit. When you attend, the $${DETECTOR_ACADEMY_DEPOSIT} comes back to you as Stanton camp credit for site fees or other camp purchases. If you can't make these dates, it becomes Stanton camp credit instead.`,
  },
  {
    q: "Do I need my own detector?",
    a: "Yes, please bring your own. Sessions center on the Garrett Axiom / Axiom Lite, GoldMaster 24k, and Pro-Pointer II, and the fundamentals apply to any detector. New members who join with the Axiom Lite bundle train on their new detector.",
  },
  {
    q: "Is camping included?",
    a: "No. Book your Stanton campsite separately. LDMA members camp at the member nightly rate.",
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
