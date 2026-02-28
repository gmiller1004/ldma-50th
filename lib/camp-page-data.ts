export type AmenityIcon =
  | "Plug"
  | "Tent"
  | "Landmark"
  | "Home"
  | "Trophy"
  | "Shirt"
  | "ShowerHead"
  | "Fuel"
  | "UserRound";

export type CampPageData = {
  name: string;
  state: string;
  slug: string;
  heroImage: string;
  heroImageFallback: string;
  tagline: string;
  overview: string;
  ldmaConnection?: string;
  stats: { value: string; label: string }[];
  thenNow?: {
    then: { title: string; text: string };
    now: { title: string; text: string };
  };
  amenities: {
    icon: AmenityIcon;
    text: string;
    highlight?: boolean;
  }[];
  goldProspecting: {
    text: string;
    seasonalNote: string;
  };
  address: string;
  mapsSearchUrl: string;
  mapsEmbedUrl: string;
  nearbyAttractions: { name: string; desc: string }[];
  galleryTitle: string;
  galleryImages: { src: string; caption?: string }[];
  ctaTitle: string;
  /** Optional Facebook group URL — shows "Follow on Facebook" CTA under gallery */
  facebookGroupUrl?: string;
};

export const italianBarData: CampPageData = {
  name: "Italian Bar",
  state: "California",
  slug: "italian-bar-california",
  heroImage: "/images/campgrounds/italian-bar-california/camp-italian-bar.jpg",
  heroImageFallback: "/images/campgrounds/italian-bar-california/camp-italian-bar.jpg",
  tagline: "First LDMA Camp • River Gold on the Stanislaus",
  overview:
    "The very first LDMA camp, built from the ground up in the 1970s on the historic 1850s gold rush site along the South Fork of the Stanislaus River. Italian Bar has long been a destination for gold prospecting, camaraderie, and relaxing by the river. Many LDMA members found their first gold here. Owned by LDMA (Lost Dutchman's Mining Association).",
  ldmaConnection:
    "The original LDMA camp — where it all began, and a cornerstone of our 50-year legacy.",
  stats: [
    { value: "1977", label: "First LDMA Camp" },
    { value: "160", label: "Patented Acres" },
    { value: "RV & Tent", label: "Hookups & Dry Sites" },
    { value: "Mar–Nov", label: "Open Season" },
  ],
  thenNow: {
    then: {
      title: "1850s",
      text: "Gold rush site on the South Fork Stanislaus River. Nervie's Store and the historic river bar drew miners and dreamers to these waters.",
    },
    now: {
      title: "LDMA Era (1977)",
      text: "The first LDMA camp — 160 acres of river access, RV hookups, clubhouse, and gold panning. Where countless members have found their first gold.",
    },
  },
  amenities: [
    {
      icon: "Plug",
      text: "RV hookup campsites (dry and water sites)",
      highlight: true,
    },
    { icon: "Tent", text: "Tent & dry camping sites" },
    { icon: "Home", text: "Clubhouse with craft area & game room", highlight: true },
    { icon: "ShowerHead", text: "Showers & restrooms (hot water)" },
    { icon: "Fuel", text: "Dump station" },
    { icon: "Trophy", text: "Community fire pit & common areas" },
    { icon: "Shirt", text: "Trash service" },
  ],
  goldProspecting: {
    text: "Gold panning and sluicing in the Stanislaus River. Designated area for self-contained recirculating units and dry washers. Many members find their first gold here.",
    seasonalNote:
      "Open March 15 through October 31. Closed November 1 – March 14. Road is tight — rigs up to 30 feet recommended.",
  },
  address: "24997 Italian Bar Rd, Columbia, CA 95310",
  mapsSearchUrl:
    "https://www.google.com/maps/search/?api=1&query=24997+Italian+Bar+Rd,+Columbia,+CA+95310",
  mapsEmbedUrl:
    "https://maps.google.com/maps?q=24997+Italian+Bar+Rd,+Columbia,+CA+95310&t=k&z=15&ie=UTF8&iwloc=&output=embed",
  nearbyAttractions: [
    { name: "Columbia", desc: "Restored 1851 gold rush town, 6 miles south" },
    { name: "Sonora", desc: "Queen of the Southern Mines" },
    { name: "Yosemite", desc: "National park within day-trip range" },
  ],
  galleryTitle: "Italian Bar Through the Years",
  galleryImages: [
    { src: "/images/campgrounds/italian-bar-california/italian-bar-1.jpg", caption: "Welcome to Italian Bar — group gathering" },
    { src: "/images/campgrounds/italian-bar-california/italian-bar-2.jpg", caption: "Clubhouse & fire pit" },
    { src: "/images/campgrounds/italian-bar-california/italian-bar-3.jpg", caption: "Nervie's Store — member upkeep" },
    { src: "/images/campgrounds/italian-bar-california/italian-bar-4.jpg", caption: "Gold panning on the Stanislaus" },
    { src: "/images/campgrounds/italian-bar-california/italian-bar-5.jpg", caption: "Running a recirculator in camp" },
    { src: "/images/campgrounds/italian-bar-california/italian-bar-6.jpg", caption: "I-Bar Mine display" },
  ],
  ctaTitle: "Ready to Visit Italian Bar?",
  facebookGroupUrl: "https://www.facebook.com/groups/650550111736019",
};

export const duisenburgData: CampPageData = {
  name: "Duisenburg",
  state: "California",
  slug: "duisenburg-california",
  heroImage: "/images/campgrounds/duisenburg-california/camp-duisenburg.jpg",
  heroImageFallback: "/images/campgrounds/duisenburg-california/camp-duisenburg.jpg",
  tagline: "High Desert Oasis • Mojave Gold & Wide-Open Skies",
  overview:
    "160 acres of high desert near Randsburg in Southern California gold country. Duisenburg offers primitive RV and tent camping amid breathtaking Mojave landscapes. A family-oriented camp with over 40 years of prospecting history. Metal detecting, dry washing, and desert gold. Owned by LDMA (Lost Dutchman's Mining Association).",
  ldmaConnection:
    "A high desert gem — 40+ years of LDMA prospecting in the Mojave.",
  stats: [
    { value: "160", label: "Patented Acres" },
    { value: "40+", label: "Years Prospecting" },
    { value: "RV & Tent", label: "Primitive Camping" },
    { value: "Ridgecrest", label: "20 Min Away" },
  ],
  amenities: [
    { icon: "Tent", text: "RV & tent campsites (primitive/dry)", highlight: true },
    { icon: "ShowerHead", text: "Showers & restrooms" },
    { icon: "Home", text: "Clubhouse", highlight: true },
    { icon: "Trophy", text: "Community fire pits" },
    { icon: "Fuel", text: "Dump station" },
    { icon: "Shirt", text: "Water & trash service" },
  ],
  goldProspecting: {
    text: "Desert gold prospecting — metal detecting and dry washing on the wide-open Mojave terrain. Instruction available for beginners. ATV/UTV trails, hunting, and wildlife viewing.",
    seasonalNote:
      "High desert conditions. Check wind before towing, especially fall and spring. Gravel road accessible for all RVs.",
  },
  address: "L.D.M.A. Clubhouse, Ridgecrest, CA 93555",
  mapsSearchUrl:
    "https://www.google.com/maps/search/?api=1&query=LDMA+Duisenburg+Randsburg+CA",
  mapsEmbedUrl:
    "https://maps.google.com/maps?q=Randsburg,+CA+93554&t=k&z=12&ie=UTF8&iwloc=&output=embed",
  nearbyAttractions: [
    { name: "Randsburg", desc: "Historic mining ghost town" },
    { name: "Ridgecrest", desc: "Services & supplies, 20 min" },
    { name: "Red Rock Canyon", desc: "Scenic desert park" },
  ],
  galleryTitle: "Duisenburg Through the Years",
  galleryImages: [
    { src: "/images/campgrounds/duisenburg-california/duisenburg-1.jpg", caption: "Duisenburg LDMA sign" },
    { src: "/images/campgrounds/duisenburg-california/duisenburg-2.jpg", caption: "Camp dig — material processing" },
    { src: "/images/campgrounds/duisenburg-california/duisenburg-3.jpg", caption: "Desert camping" },
    { src: "/images/campgrounds/duisenburg-california/duisenburg-4.jpg", caption: "Clubhouse gathering" },
    { src: "/images/campgrounds/duisenburg-california/duisenburg-5.jpg", caption: "Dirt Party finds" },
    { src: "/images/campgrounds/duisenburg-california/duisenburg-6.jpg", caption: "Camp Duisenburg clubhouse" },
  ],
  ctaTitle: "Ready to Visit Duisenburg?",
  facebookGroupUrl: "https://www.facebook.com/groups/561212040898484",
};

export const blueBucketData: CampPageData = {
  name: "Blue Bucket",
  state: "Oregon",
  slug: "blue-bucket-oregon",
  heroImage: "/images/campgrounds/blue-bucket-oregon/camp-blue-bucket.jpg",
  heroImageFallback: "/images/campgrounds/blue-bucket-oregon/camp-blue-bucket.jpg",
  tagline: "Scenic Gold & Wildlife • Stream & Bench Gravel",
  overview:
    "118 acres of patented land near Huntington with flat terrain and rolling hills. Gold in stream gravel, bench gravel, and high bench deposits. Elk, deer, and chukar abound. Family-friendly with RV hookups, clubhouse, and scenic Burnt River access. Owned by LDMA (Lost Dutchman's Mining Association).",
  stats: [
    { value: "118", label: "Patented Acres" },
    { value: "30/50 Amp", label: "RV Hookups" },
    { value: "Elk & Deer", label: "Wildlife" },
    { value: "I-84", label: "Exit 338" },
  ],
  amenities: [
    { icon: "Plug", text: "RV hookups (30/50 amp, water)", highlight: true },
    { icon: "Tent", text: "Electric-only & dry camping" },
    { icon: "Home", text: "Clubhouse, game room, craft room", highlight: true },
    { icon: "ShowerHead", text: "Showers & restrooms" },
    { icon: "Shirt", text: "Laundry" },
    { icon: "Trophy", text: "Community fire pit" },
    { icon: "UserRound", text: "Trash service" },
  ],
  goldProspecting: {
    text: "Recreational gold mining and panning in stream gravel, bench gravel, and high bench deposits. Equipment rental and mining instruction available. Wildlife viewing (elk, deer, chukar), hiking, kayaking, fishing, hunting, and off-roading.",
    seasonalNote:
      "From Baker, take I-84 east ~34 miles to exit 338. Camp is just off the interstate.",
  },
  address: "31097 Valentine Lane, Huntington, OR 97907",
  mapsSearchUrl:
    "https://www.google.com/maps/search/?api=1&query=31097+Valentine+Lane,+Huntington,+OR+97907",
  mapsEmbedUrl:
    "https://maps.google.com/maps?q=31097+Valentine+Lane,+Huntington,+OR+97907&t=k&z=15&ie=UTF8&iwloc=&output=embed",
  nearbyAttractions: [
    { name: "Huntington", desc: "Nearby town & services" },
    { name: "Baker City", desc: "Historic Oregon trail town" },
    { name: "Burnt River", desc: "Runs along west side" },
  ],
  galleryTitle: "Blue Bucket Through the Years",
  galleryImages: [
    { src: "/images/campgrounds/blue-bucket-oregon/blue-bucket-1.jpg", caption: "Blue Bucket Camp sign" },
    { src: "/images/campgrounds/blue-bucket-oregon/blue-bucket-2.jpg", caption: "Sluice box & blue buckets" },
    { src: "/images/campgrounds/blue-bucket-oregon/blue-bucket-3.jpg", caption: "River prospecting" },
    { src: "/images/campgrounds/blue-bucket-oregon/blue-bucket-4.jpg", caption: "Campground & valley views" },
    { src: "/images/campgrounds/blue-bucket-oregon/blue-bucket-5.jpg", caption: "Member work day — creek maintenance" },
    { src: "/images/campgrounds/blue-bucket-oregon/blue-bucket-6.jpg", caption: "Campground & RV sites" },
  ],
  ctaTitle: "Ready to Visit Blue Bucket?",
  facebookGroupUrl: "https://www.facebook.com/groups/2043925965894572",
};

export const burntRiverData: CampPageData = {
  name: "Burnt River",
  state: "Oregon",
  slug: "burnt-river-oregon",
  heroImage: "/images/campgrounds/burnt-river-oregon/camp-burnt-river.jpg",
  heroImageFallback: "/images/campgrounds/burnt-river-oregon/camp-burnt-river.jpg",
  tagline: "Wilderness River Camp • Rose Gold in Eastern Oregon",
  overview:
    "136 acres along Burnt River and Deer Creek in Eastern Oregon. Self-contained primitive camping with showers, clubhouse, and dump station. Breathtaking canyon views, wildlife (turkeys, deer, bighorn sheep), and the famed \"rose gold\" of the area. Regular camp digs and potluck events. Owned by LDMA (Lost Dutchman's Mining Association).",
  stats: [
    { value: "136", label: "Patented Acres" },
    { value: "RV & Tent", label: "Dry Camping" },
    { value: "9 Mi", label: "From Durkee" },
    { value: "Rose Gold", label: "Famed Finds" },
  ],
  amenities: [
    { icon: "Tent", text: "RV & tent (primitive/dry)", highlight: true },
    { icon: "ShowerHead", text: "Showers & restrooms" },
    { icon: "Home", text: "Clubhouse & fire pit", highlight: true },
    { icon: "Fuel", text: "Dump station" },
    { icon: "Shirt", text: "Water & trash" },
  ],
  goldProspecting: {
    text: "Known for \"rose gold\" — highbanking, camp digs, and material processing. Dirt provided for highbanking. Regular outings and potluck gatherings. Wildlife includes turkeys, deer, and bighorn sheep.",
    seasonalNote:
      "Approximately 9 miles from Durkee on Burnt River Canyon Lane.",
  },
  address: "28089 Burnt River Canyon Ln, Durkee, OR 97905",
  mapsSearchUrl:
    "https://www.google.com/maps/search/?api=1&query=28089+Burnt+River+Canyon+Ln,+Durkee,+OR+97905",
  mapsEmbedUrl:
    "https://maps.google.com/maps?q=28089+Burnt+River+Canyon+Ln,+Durkee,+OR+97905&t=k&z=14&ie=UTF8&iwloc=&output=embed",
  nearbyAttractions: [
    { name: "Durkee", desc: "Nearest town, 9 miles" },
    { name: "Baker City", desc: "Historic mining district" },
    { name: "Hells Canyon", desc: "Deepest river gorge" },
  ],
  galleryTitle: "Burnt River Through the Years",
  galleryImages: [
    { src: "/images/campgrounds/burnt-river-oregon/burnt-river-1.jpg", caption: "Burnt River clubhouse" },
    { src: "/images/campgrounds/burnt-river-oregon/burnt-river-2.jpg", caption: "Trommel & recirculator" },
    { src: "/images/campgrounds/burnt-river-oregon/burnt-river-3.jpg", caption: "Family prospecting" },
    { src: "/images/campgrounds/burnt-river-oregon/burnt-river-4.jpg", caption: "Clash of the Trommels — we got gold!" },
    { src: "/images/campgrounds/burnt-river-oregon/burnt-river-5.jpg", caption: "Camp gathering" },
    { src: "/images/campgrounds/burnt-river-oregon/burnt-river-6.jpg", caption: "Campsite prospecting" },
  ],
  ctaTitle: "Ready to Visit Burnt River?",
  facebookGroupUrl: "https://www.facebook.com/groups/1586051941480504",
};

export const oconeeData: CampPageData = {
  name: "Oconee",
  state: "South Carolina",
  slug: "oconee-south-carolina",
  heroImage: "/images/campgrounds/oconee-south-carolina/camp-oconee.jpg",
  heroImageFallback: "/images/campgrounds/oconee-south-carolina/camp-oconee.jpg",
  tagline: "Rustic Blue Ridge Gem & Gold • Panning & Gem Hunting",
  overview:
    "120 acres in the Blue Ridge foothills near Tamassee. A rustic retreat with gold panning and gem hunting — quartz, garnets, and rubies. Panning station, equipment rentals, and fire pit. Partial hookup and dry camping. Owned by LDMA (Lost Dutchman's Mining Association).",
  stats: [
    { value: "120", label: "Patented Acres" },
    { value: "Gold & Gems", label: "Panning Station" },
    { value: "Blue Ridge", label: "Foothills" },
    { value: "Tamassee", label: "Nearby" },
  ],
  amenities: [
    { icon: "Plug", text: "Partial hookup sites", highlight: true },
    { icon: "Tent", text: "Dry camping" },
    { icon: "Landmark", text: "Panning station", highlight: true },
    { icon: "Shirt", text: "Equipment rentals" },
    { icon: "Trophy", text: "Community fire pit" },
  ],
  goldProspecting: {
    text: "Gold panning and gem hunting — quartz, garnets, and rubies. Panning station on-site. Equipment rentals available. A tranquil rustic retreat in the Blue Ridge foothills.",
    seasonalNote:
      "Visit OconeeGoldCamp.com for more information and reservations.",
  },
  address: "475 LDMA Dr, Tamassee, SC 29686",
  mapsSearchUrl:
    "https://www.google.com/maps/search/?api=1&query=475+LDMA+Dr,+Tamassee,+SC+29686",
  mapsEmbedUrl:
    "https://maps.google.com/maps?q=475+LDMA+Dr,+Tamassee,+SC+29686&t=k&z=15&ie=UTF8&iwloc=&output=embed",
  nearbyAttractions: [
    { name: "Tamassee", desc: "Mountain community" },
    { name: "Chattooga River", desc: "Whitewater & scenery" },
    { name: "Blue Ridge", desc: "Scenic byways" },
  ],
  galleryTitle: "Oconee Through the Years",
  galleryImages: [
    { src: "/images/campgrounds/oconee-south-carolina/oconee-1.jpg", caption: "LDMA Oconee Camp — welcome home" },
    { src: "/images/campgrounds/oconee-south-carolina/oconee-2.jpg", caption: "Riverbank prospecting" },
    { src: "/images/campgrounds/oconee-south-carolina/oconee-3.jpg", caption: "Gold Hog sluice in action" },
    { src: "/images/campgrounds/oconee-south-carolina/oconee-4.jpg", caption: "Gold pan find" },
    { src: "/images/campgrounds/oconee-south-carolina/oconee-5.jpg", caption: "Digger's Dirt Party finds" },
    { src: "/images/campgrounds/oconee-south-carolina/oconee-6.jpg", caption: "Camp dig — trommel & sluice" },
  ],
  ctaTitle: "Ready to Visit Oconee?",
  facebookGroupUrl: "https://www.facebook.com/groups/1303356383142385",
};

export const loudMineData: CampPageData = {
  name: "Loud Mine",
  state: "Georgia",
  slug: "loud-mine-georgia",
  heroImage: "/images/campgrounds/loud-mine-georgia/camp-loud-mine.jpg",
  heroImageFallback: "/images/campgrounds/loud-mine-georgia/camp-loud-mine.jpg",
  tagline: "Dahlonega Gold Belt • Stream Gold & Family Activities",
  overview:
    "37 acres in the Southern gold country, just 5 miles from Cleveland Town Square. Rich stream gold and bench deposits. Tranquil wooded hills with swimming, fishing, kayaking, and hiking. RV hookups, pavilion, laundry, craft room, and game room. Owned by LDMA (Lost Dutchman's Mining Association).",
  stats: [
    { value: "37", label: "Patented Acres" },
    { value: "5 Mi", label: "From Cleveland" },
    { value: "30/50 Amp", label: "RV Hookups" },
    { value: "Dahlonega", label: "Gold Belt" },
  ],
  amenities: [
    { icon: "Plug", text: "RV hookups (30/50 amp, water)", highlight: true },
    { icon: "Tent", text: "Dry camping" },
    { icon: "Home", text: "Clubhouse, game room, craft room", highlight: true },
    { icon: "ShowerHead", text: "Showers & restrooms" },
    { icon: "Shirt", text: "Laundry" },
    { icon: "Trophy", text: "Pavilion & fire pit" },
    { icon: "Fuel", text: "Dump station" },
  ],
  goldProspecting: {
    text: "Rich stream gold and bench deposits in the historic Dahlonega gold belt. Panning, sluicing, and metal detecting. Swim, fish, kayak, and hike — then hunt for gold in the streams.",
    seasonalNote:
      "Easily accessible, 5 miles outside Cleveland Town Square.",
  },
  address: "575 Abb Helton Rd, Cleveland, GA 30528",
  mapsSearchUrl:
    "https://www.google.com/maps/search/?api=1&query=575+Abb+Helton+Rd,+Cleveland,+GA+30528",
  mapsEmbedUrl:
    "https://maps.google.com/maps?q=575+Abb+Helton+Rd,+Cleveland,+GA+30528&t=k&z=15&ie=UTF8&iwloc=&output=embed",
  nearbyAttractions: [
    { name: "Cleveland", desc: "Town square, 5 miles" },
    { name: "Dahlonega", desc: "Historic gold rush town" },
    { name: "Helen", desc: "Bavarian-style mountain town" },
  ],
  galleryTitle: "Loud Mine Through the Years",
  galleryImages: [
    { src: "/images/campgrounds/loud-mine-georgia/loud-mine-1.jpg", caption: "Loud Mine clubhouse — holiday season" },
    { src: "/images/campgrounds/loud-mine-georgia/loud-mine-2.jpg", caption: "Pond-side prospecting" },
    { src: "/images/campgrounds/loud-mine-georgia/loud-mine-3.jpg", caption: "Loud Mine Camp — family gathering" },
    { src: "/images/campgrounds/loud-mine-georgia/loud-mine-4.jpg", caption: "Campfire gathering" },
    { src: "/images/campgrounds/loud-mine-georgia/loud-mine-5.jpg", caption: "Sluice box prospecting" },
    { src: "/images/campgrounds/loud-mine-georgia/loud-mine-6.jpg", caption: "Welcome to Loud Mine" },
  ],
  ctaTitle: "Ready to Visit Loud Mine?",
  facebookGroupUrl: "https://www.facebook.com/groups/2055448148072142",
};

export const veinMountainData: CampPageData = {
  name: "Vein Mountain",
  state: "North Carolina",
  slug: "vein-mountain-north-carolina",
  heroImage: "/images/campgrounds/vein-mountain-north-carolina/camp-vein-mountain.jpg",
  heroImageFallback: "/images/campgrounds/vein-mountain-north-carolina/camp-vein-mountain.jpg",
  tagline: "Mother Lode in the Blue Ridge • Quartz Veins & Alluvial Gold",
  overview:
    "130 acres in a tranquil wooded setting near Nebo. Gold-bearing quartz veins, alluvial gravels, and soft bedrock. Ideal for family weekend getaways. RV hookups (30 amp, water), clubhouse, game room, and laundry. Owned by LDMA (Lost Dutchman's Mining Association).",
  stats: [
    { value: "130", label: "Patented Acres" },
    { value: "30 Amp", label: "RV Hookups" },
    { value: "Quartz Veins", label: "Gold-Bearing" },
    { value: "Nebo", label: "Blue Ridge" },
  ],
  amenities: [
    { icon: "Plug", text: "RV hookups (30 amp, water)", highlight: true },
    { icon: "Tent", text: "Dry camping" },
    { icon: "Home", text: "Clubhouse & game room", highlight: true },
    { icon: "ShowerHead", text: "Showers & restrooms" },
    { icon: "Shirt", text: "Laundry" },
    { icon: "Trophy", text: "Community fire pit" },
    { icon: "Fuel", text: "Dump station" },
  ],
  goldProspecting: {
    text: "Dense alluvial gravels with gold-bearing quartz veins. Soft bedrock overlays the region. Ideal for panning, sluicing, and weekend family prospecting in a tranquil wooded setting.",
    seasonalNote:
      "Nestled in the Blue Ridge near Nebo — the perfect escape for relaxation and gold.",
  },
  address: "3216 Vein Mt Rd, Nebo, NC 28761",
  mapsSearchUrl:
    "https://www.google.com/maps/search/?api=1&query=3216+Vein+Mt+Rd,+Nebo,+NC+28761",
  mapsEmbedUrl:
    "https://maps.google.com/maps?q=3216+Vein+Mt+Rd,+Nebo,+NC+28761&t=k&z=15&ie=UTF8&iwloc=&output=embed",
  nearbyAttractions: [
    { name: "Nebo", desc: "Nearby community" },
    { name: "Lake James", desc: "Scenic mountain lake" },
    { name: "Blue Ridge Pkwy", desc: "Scenic drive" },
  ],
  galleryTitle: "Vein Mountain Through the Years",
  galleryImages: [
    { src: "/images/campgrounds/vein-mountain-north-carolina/vein-mountain-1.jpg", caption: "Vein Mountain Gold Camp sign" },
    { src: "/images/campgrounds/vein-mountain-north-carolina/vein-mountain-2.jpg", caption: "Camp gathering" },
    { src: "/images/campgrounds/vein-mountain-north-carolina/vein-mountain-3.jpg", caption: "Gold dredging on the creek" },
    { src: "/images/campgrounds/vein-mountain-north-carolina/vein-mountain-4.jpg", caption: "Gold find celebration" },
    { src: "/images/campgrounds/vein-mountain-north-carolina/vein-mountain-5.jpg", caption: "Metal detecting event" },
    { src: "/images/campgrounds/vein-mountain-north-carolina/vein-mountain-6.jpg", caption: "Digger's Dirt Party finds" },
  ],
  ctaTitle: "Ready to Visit Vein Mountain?",
  facebookGroupUrl: "https://www.facebook.com/groups/254481531751690",
};
