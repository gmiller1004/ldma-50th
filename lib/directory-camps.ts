import type { CampPageData } from "./camp-page-data";
import {
  italianBarData,
  duisenburgData,
  blueBucketData,
  burntRiverData,
  oconeeData,
  loudMineData,
  veinMountainData,
} from "./camp-page-data";

export type DirectoryCamp = {
  name: string;
  state: string;
  slug: string;
  tagline: string;
  desc: string;
  address: string;
  image: string;
  /** Full camp page data when available (for camp detail pages) */
  data?: CampPageData;
};

// Stanton is not in camp-page-data; we define it here for the directory
const stantonSlug = "stanton-arizona";
const stantonCamp: DirectoryCamp = {
  name: "Stanton",
  state: "Arizona",
  slug: stantonSlug,
  tagline: "Flagship Camp • Historic Ghost Town",
  desc: "120 patented acres with full hookups, museum, clubhouse, laundry, and exclusive claims.",
  address: "15650 Stanton Rd, Congress, AZ 85332",
  image: "/images/campgrounds/stanton-arizona/camp-stanton.jpg",
};

function toDirectoryCamp(data: CampPageData): DirectoryCamp {
  return {
    name: data.name,
    state: data.state,
    slug: data.slug,
    tagline: data.tagline,
    desc: data.overview.slice(0, 140) + (data.overview.length > 140 ? "…" : ""),
    address: data.address,
    image: data.heroImage,
    data,
  };
}

export const directoryCamps: DirectoryCamp[] = [
  stantonCamp,
  toDirectoryCamp(italianBarData),
  toDirectoryCamp(duisenburgData),
  toDirectoryCamp(blueBucketData),
  toDirectoryCamp(burntRiverData),
  toDirectoryCamp(oconeeData),
  toDirectoryCamp(loudMineData),
  toDirectoryCamp(veinMountainData),
];

const slugToCamp = new Map(directoryCamps.map((c) => [c.slug, c]));

export function getCampBySlug(slug: string): DirectoryCamp | undefined {
  return slugToCamp.get(slug);
}

export function getValidCampSlugs(): string[] {
  return directoryCamps.map((c) => c.slug);
}
