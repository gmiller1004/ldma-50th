/**
 * LDMA Detector Academy at Stanton (March 11–14, 2027): event content, Shopify IDs,
 * and the Axiom Lite bundle reservation rule. Client-safe: no server imports.
 *
 * New members who buy the LDMA Lifetime Bundle (Garrett Axiom Lite) inside the promo window attend
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
  "You'll work in groups of about 25. Over the first three days you rotate through six breakouts. Everyone completes all six. Mornings and afternoons run as parallel stations at camp and on the claims, so groups stay small. Day 4 is open hunting, with trainers around for coaching.";

export const DETECTOR_ACADEMY_WEEK_OVERVIEW: AcademyOverviewBlock[] = [
  {
    label: "Days 1–2",
    title: "Four core stations",
    summary:
      "Four stations run each half-day. Your group rotates so that by the end of Day 2 you've hit classroom basics, the test garden, a PI hunt, and VLF / GoldMaster time in the field.",
    sessions: [
      {
        title: "Classroom basics",
        where: "Camp",
        detail: "Setup, controls, air tests, and the fundamentals before you hit the ground.",
      },
      {
        title: "Test garden",
        where: "Controlled ground",
        detail: "Gold at known sizes and depths so you learn what a real target sounds like.",
      },
      {
        title: "PI hunt",
        where: "Claims",
        detail: "Pulse induction on Stanton ground, with trainers in your group.",
      },
      {
        title: "VLF / GoldMaster",
        where: "Claims",
        detail: "Smaller gold, a different ground response, and coil work on a VLF.",
      },
    ],
  },
  {
    label: "Day 3",
    title: "Two advanced sessions",
    summary:
      "Two half-day advanced breakouts. Groups swap at midday so everyone gets both. Coaching is built into the practice time. Longer one-on-ones continue on Day 4.",
    sessions: [
      {
        title: "Ground & gear",
        where: "Camp and claims",
        detail:
          "Hot ground, EMI, and coil selection. Short teach, then hands-on comparing coils on the same patch while instructors rotate for quick check-ins.",
      },
      {
        title: "Working a claim",
        where: "Claims",
        detail:
          "How to map and walk a claim, then spread out to practice while trainers float for coaching.",
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
        detail: "Put the week into practice. Ask for a second set of ears whenever you want one.",
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
    bio: "Dominic has led GPAA and LDMA operations since 2010 and built the events people show up for: Dirt Parties, Diggers Gold Mining Academy, the Great Gold Dredge-Off, Battle Across the Desert. He started prospecting at 9 on his grandparents' ranch in Northern California. He'll host the academy and help run field sessions on Stanton's claims.",
  },
  {
    name: "Kevin Hoagland",
    role: "Host, Gold Trails · GPAA & LDMA",
    photo: "/images/trainers/kevin-hoagland.jpg",
    bio: "Kevin has 55 years in the field and built his first detector at nine. He hosts GPAA's Gold Trails, appeared on HISTORY's Lost Gold of the Aztecs, and has taught Metal Detecting 101 for years. He turns complicated settings into habits you can repeat. You'll see him in the test garden and out on the hunts.",
  },
  {
    name: "John Mathis",
    role: "Caretaker, LDMA Stanton Camp",
    photo: "/images/trainers/john-mathis.jpg",
    bio: "John is an old-school prospector with more than 50 years across six western states. He found a 2½-ounce nugget in the American River at age 10 and never really stopped. Stanton's caretaker since 2018 and a Diggers Gold Mining Academy Master Instructor, he knows these claims cold. He'll run claim orientation and share the local tips.",
  },
  {
    name: "Heath Jones",
    role: "Founder, History Seekers",
    photo: "/images/trainers/heath-jones.jpg",
    bio: "Heath founded History Seekers after nearly nine years running a major detecting retailer, where he worked with manufacturers and tested prototypes. He's been detecting since the early '90s, built a following for Civil War relic hunting, and also hunts gold on LDMA ground and at AKAU near Nome. He coaches settings and machines from both sides of the counter.",
  },
  {
    name: "Amber Evans",
    role: "History Seekers · Newcomer coaching",
    photo: "/images/trainers/amber-evans.jpg",
    bio: "Amber coaches first-timers on mineralized ground for History Seekers. She learned gold detecting at AKAU near Nome: nine pieces in her first hour, 118 by the end of the trip. She's hunted LDMA claims at Stanton and helps newcomers turn messy signals into digs they trust, alongside Heath Jones.",
  },
  {
    name: "Dylan Pritchard",
    role: "B-Kings Outdoors · Stanton / Rich Hill",
    photo: "/images/trainers/dylan-pritchard.jpg",
    bio: "Dylan is an Arizona nugget hunter based near Congress. He works Stanton and Rich Hill country with B-Kings Outdoors and is known for big Garrett Axiom finds, including multi-ounce and specimen gold from Rich Hill. He teaches detector classes for hot desert ground. When he's not filming, he's in the same hills you'll walk.",
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

/** Core skills: PI and VLF first; pinpointer folded into field recovery. */
export const DETECTOR_ACADEMY_LEARNING = [
  {
    title: "Pulse induction: Axiom & Axiom Lite",
    body: "Ground balance, soil settings, sensitivity, and coil choice on the same PI platform. Learn to hear deep gold in mineralized desert dirt and trust what the machine is saying.",
  },
  {
    title: "VLF: GoldMaster 24k",
    body: "Small, shallow gold. Iron discrimination. Hot rocks. When a VLF beats pulse induction, and which tool to swing on which patch.",
  },
  {
    title: "Field recovery & claim craft",
    body: "Pinpointer habits that keep gold in the scoop, faster digs, and how to walk a claim with trainers nearby. Test garden first, then real Stanton ground.",
  },
];

/** Outcomes only; no overlap with the included checklist. */
export const DETECTOR_ACADEMY_GAINS = [
  "Settings you trust on mineralized desert ground",
  "How gold sounds at different sizes and depths",
  "Your own detector dialed in for the dirt you hunt",
  "Hours in the field with coaches who dig this ground",
];

export const DETECTOR_ACADEMY_WHO_FOR = [
  {
    title: "New detectorists",
    body: "You've got a machine (or a new Axiom Lite) and want real ground, not another YouTube rabbit hole. Small groups. Coaches who meet you where you are.",
  },
  {
    title: "Experienced hunters",
    body: "You already dig gold. Come sharpen settings, coil choice, and claim craft on Stanton / Rich Hill dirt with people who hunt it year-round.",
  },
  {
    title: "Members and the public",
    body: "You don't need to be an LDMA member to register. During the academy, every participant hunts Stanton's claims with the trainers.",
  },
];

export const DETECTOR_ACADEMY_PROOF = [
  {
    title: "Real gold ground",
    body: "Stanton sits in Arizona's Rich Hill country. You'll hunt LDMA claims with trainers, not a parking-lot demo.",
  },
  {
    title: "Built from Diggers Academy",
    body: "Same LDMA education line that produced Diggers Gold Mining Academy masters, now focused on detectors, with guest coaches from History Seekers and B-Kings Outdoors.",
  },
  {
    title: "Coaches who dig it",
    body: "Kevin Hoagland's Metal Detecting 101 and Gold Trails. Dylan Pritchard's Rich Hill nuggets. Heath Jones in the field. Instruction from people who swing coils for a living.",
  },
];

export const DETECTOR_ACADEMY_TRAINERS_INTRO =
  "LDMA's operations and Stanton team host the week, with guest instructors from History Seekers and B-Kings Outdoors. Classroom work, then one-on-one tuning out on the claims.";

export const DETECTOR_ACADEMY_DISCOUNT_ELIGIBILITY =
  "GPAA or LDMA members, military (active or veteran), first responders, and teachers may qualify. Apply on this page. If you qualify, we'll email your discount code.";

export const DETECTOR_ACADEMY_PRICE_FRAME = `$${DETECTOR_ACADEMY_PRICE} for four days (about $${DETECTOR_ACADEMY_PRICE / 4}/day) of training, claim access, and coaches. Camping and meals are separate.`;

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
    a: `Join LDMA with the Garrett Axiom Lite bundle by ${ACADEMY_PROMO_DEADLINE_LABEL}, then reserve your spot with a $${DETECTOR_ACADEMY_DEPOSIT} non-refundable deposit. When you attend, that $${DETECTOR_ACADEMY_DEPOSIT} comes back as Stanton camp credit for site fees or other camp purchases. If you can't make these dates, it becomes Stanton camp credit instead.`,
  },
  {
    q: "Do I need my own detector?",
    a: "Yes. Bring your own so you leave with it dialed in. Training centers on the Garrett Axiom / Axiom Lite and GoldMaster 24k; the fundamentals apply to any detector. Bundle buyers train on their new Axiom Lite.",
  },
  {
    q: "Are camping and meals included?",
    a: "No. Book your Stanton campsite separately (LDMA members use the member nightly rate). Plan your own meals. Camp kitchens and nearby options in Congress / Wickenburg work well.",
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
