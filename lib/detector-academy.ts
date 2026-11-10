/**
 * LDMA Detector Academy at Stanton (early March 2027, exact dates TBD): event content, Shopify IDs,
 * and the Axiom Lite bundle reservation rule. Client-safe: no server imports.
 *
 * New members who buy the LDMA Lifetime Bundle — Garrett Axiom Lite inside the promo window attend
 * free with a $100 non-refundable deposit, returned as Stanton camp credit when they attend, or as camp
 * credit if they can't make the dates once they're announced.
 * Everyone else joins the updates list until registration opens.
 */

export const DETECTOR_ACADEMY_PATH = "/events/detector-academy-stanton-2027";
export const DETECTOR_ACADEMY_RESERVATION_PATH = "/members/detector-academy-reservation";
export const DETECTOR_ACADEMY_NAME = "LDMA Detector Academy";

/** Shopify product: deposit variant for bundle buyers; $400 variants held at zero until dates are set. */
export const DETECTOR_ACADEMY_PRODUCT_HANDLE = "detector-academy-stanton-2027";
export const DETECTOR_ACADEMY_PRODUCT_GID = "gid://shopify/Product/9142497706055";
export const DETECTOR_ACADEMY_DEPOSIT_VARIANT_GID = "gid://shopify/ProductVariant/49970472976455";
export const DETECTOR_ACADEMY_DEPOSIT_VARIANT_ID = "49970472976455";

export const DETECTOR_ACADEMY_DATES_LABEL = "Early March 2027";
export const DETECTOR_ACADEMY_DATES_NOTE = "Exact dates coming soon";
export const DETECTOR_ACADEMY_CAPACITY = 200;
export const DETECTOR_ACADEMY_PRICE = 400;
export const DETECTOR_ACADEMY_DEPOSIT = 100;
export const DETECTOR_ACADEMY_LOCATION = "LDMA Stanton camp · 15650 Stanton Rd, Congress, AZ 85332";
/** Klaviyo profile property for the "get notified" list. */
export const DETECTOR_ACADEMY_INTEREST_TAG = "detector_academy_2027";

export const AXIOM_LITE_BUNDLE_PRODUCT_ID = "7636626899015";
export const AXIOM_LITE_BUNDLE_PRODUCT_GID = `gid://shopify/Product/${AXIOM_LITE_BUNDLE_PRODUCT_ID}`;
export const AXIOM_LITE_BUNDLE_HANDLE = "ldma-lifetime-bundle-garrett-axiom-lite";

export const GARRETT_TRADEMARK_NOTICE =
  "Garrett, Axiom, and GoldMaster are trademarks of Garrett Electronics, Inc. The LDMA Detector Academy is run by the Lost Dutchman's Mining Association and isn't sponsored by Garrett.";

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

export type AcademySession = { time: string; title: string; detail?: string };
export type AcademyDay = { day: string; theme: string; sessions: AcademySession[] };

export const DETECTOR_ACADEMY_SCHEDULE: AcademyDay[] = [
  {
    day: "Day 1",
    theme: "Arrival and the basics",
    sessions: [
      { time: "12:00–3:00 pm", title: "Check-in at the clubhouse", detail: "Welcome packets, campsite setup, meet the trainers." },
      {
        time: "3:00–4:15 pm",
        title: "Welcome & the Garrett gold lineup",
        detail: "How the Axiom, Axiom Lite, and GoldMaster 24k compare, and which one suits your ground and the size of gold you're after.",
      },
      {
        time: "4:30–5:45 pm",
        title: "Setup clinic",
        detail: "Get your detector ready: assembly, coils, charging, firmware updates, headphones, and harness fit.",
      },
      { time: "6:30 pm", title: "Welcome campfire social" },
    ],
  },
  {
    day: "Day 2",
    theme: "Axiom & Axiom Lite (pulse induction)",
    sessions: [
      { time: "8:00–8:30 am", title: "Coffee, safety briefing, and claim rules", detail: "We split into small groups by detector." },
      {
        time: "8:30–10:00 am",
        title: "Classroom: pulse induction setup",
        detail: "Ground balance and tracking, soil settings, sensitivity, threshold, coil choice, and how to read the signals.",
      },
      { time: "10:15 am–12:00 pm", title: "Test garden", detail: "Gold buried at known sizes and depths, so you can hear what real gold sounds like." },
      { time: "12:00–1:00 pm", title: "Lunch" },
      { time: "1:00–4:00 pm", title: "Guided hunt on Stanton claims", detail: "Trainers rotate between groups." },
      { time: "4:15–5:00 pm", title: "Debrief", detail: "Compare the settings that worked, and bring your questions." },
      { time: "Evening", title: "Gold show-and-tell at the clubhouse" },
    ],
  },
  {
    day: "Day 3",
    theme: "GoldMaster 24k (VLF) & recovery skills",
    sessions: [
      {
        time: "8:30–10:00 am",
        title: "Classroom: GoldMaster 24k",
        detail: "Iron discrimination, hot rocks, mineralized ground, and why a VLF detector often finds small, shallow gold that a pulse induction detector misses.",
      },
      { time: "10:15 am–12:00 pm", title: "Test garden: the two technologies side by side", detail: "Run both detector types over the same targets." },
      { time: "12:00–1:00 pm", title: "Lunch" },
      {
        time: "1:00–2:15 pm",
        title: "Recovery techniques",
        detail: "Pinpointing, digging targets quickly, sorting trash from gold, and claim etiquette, including filling your holes.",
      },
      { time: "2:30–5:00 pm", title: "Field hunt in detector groups" },
      { time: "Evening", title: "Detector care & open Q&A", detail: "Care and maintenance, accessories worth having, and your questions for the trainers." },
    ],
  },
  {
    day: "Day 4",
    theme: "Tune your detector",
    sessions: [
      { time: "8:00–11:00 am", title: "One-on-one tuning", detail: "Trainers work with each participant, out in the field, to fine-tune their own detector." },
      { time: "11:00 am–12:00 pm", title: "Final guided hunt" },
      {
        time: "12:00–1:00 pm",
        title: "Wrap-up",
        detail: "Show off your finds, receive your certificate of completion, and plan your next practice trip to an LDMA camp.",
      },
      { time: "Afternoon", title: "Open hunting for members, then departures" },
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
    body: "How to set up these pulse induction detectors for deep gold in mineralized ground, including ground balance, soil settings, sensitivity, and coil choice, and how to read what you're hearing.",
  },
  {
    title: "Garrett GoldMaster 24k",
    body: "How to use the 24k for small, shallow gold, including iron discrimination, working around hot rocks, and when it outperforms a pulse induction detector.",
  },
  {
    title: "Detecting fundamentals",
    body: "Pinpointing, digging targets efficiently, caring for your detector, and the accessories worth having in the field.",
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
    a: "Early March 2027 at LDMA's Stanton camp in Congress, Arizona. We're finalizing the exact dates now. Tap \"I'm interested\" and a member of our team will be in touch with the dates.",
  },
  {
    q: "How do I register?",
    a: `Registration opens once the dates are set, and everyone who's told us they're interested hears first. If you join LDMA with the Garrett Axiom Lite bundle by ${ACADEMY_PROMO_DEADLINE_LABEL}, you can reserve your free spot now.`,
  },
  {
    q: "How does free registration with the Axiom Lite bundle work?",
    a: `Join LDMA with the Garrett Axiom Lite bundle by ${ACADEMY_PROMO_DEADLINE_LABEL}, then reserve your spot with a $${DETECTOR_ACADEMY_DEPOSIT} non-refundable deposit. When you attend, the $${DETECTOR_ACADEMY_DEPOSIT} comes back to you as Stanton camp credit for site fees or other camp purchases. If you can't make the dates once they're announced, it becomes Stanton camp credit instead.`,
  },
  {
    q: "Do I need my own detector?",
    a: "Yes, please bring your own. Sessions center on the Garrett Axiom, Axiom Lite, and GoldMaster 24k, and the fundamentals apply to any detector. New members who join with the Axiom Lite bundle train on their new detector.",
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
