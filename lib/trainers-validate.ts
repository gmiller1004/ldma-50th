import { sanitizeTrainerHtml, trainerPlainText } from "@/lib/trainers-sanitize";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUCT_GID_RE = /^gid:\/\/shopify\/Product\/\d+$/;
const PHONE_CHARS_RE = /^[+\d][\d\s().-]*$/;

const LIMITS = {
  slug: 80,
  name: 200,
  title: 200,
  summary: 600,
  body: 100_000,
  email: 200,
  phone: 40,
  website: 500,
  photo: 2000,
  events: 50,
};

export class TrainerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrainerValidationError";
  }
}

export type TrainerWriteInput = {
  slug: string;
  name: string;
  title: string | null;
  summary: string | null;
  bodyHtml: string;
  photoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  sortOrder: number;
  publishedAt: string | null;
  eventProductGids: string[];
};

export type TrainerUpdateInput = Partial<TrainerWriteInput>;

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TrainerValidationError("Expected a JSON object");
  }
  return body as Record<string, unknown>;
}

export function normalizeTrainerSlug(value: string): string {
  return value.trim().toLowerCase();
}

function parseSlug(value: unknown): string {
  if (typeof value !== "string") throw new TrainerValidationError("Slug is required");
  const slug = normalizeTrainerSlug(value);
  if (!slug || slug.length > LIMITS.slug || !SLUG_RE.test(slug)) {
    throw new TrainerValidationError(
      "Slug must be lowercase letters, numbers, and single hyphens (for example, john-mathis)"
    );
  }
  return slug;
}

function parseName(value: unknown): string {
  if (typeof value !== "string") throw new TrainerValidationError("Name is required");
  const name = trainerPlainText(value);
  if (!name) throw new TrainerValidationError("Name is required");
  if (name.length > LIMITS.name) {
    throw new TrainerValidationError(`Name must be ${LIMITS.name} characters or fewer`);
  }
  return name;
}

function parseOptionalText(value: unknown, label: string, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new TrainerValidationError(`${label} must be text`);
  const text = trainerPlainText(value);
  if (!text) return null;
  if (text.length > max) {
    throw new TrainerValidationError(`${label} must be ${max} characters or fewer`);
  }
  return text;
}

function parseBody(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new TrainerValidationError("Bio must be text");
  if (value.length > LIMITS.body) {
    throw new TrainerValidationError("Bio is too long");
  }
  return sanitizeTrainerHtml(value);
}

function parseEmail(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new TrainerValidationError("Email must be text");
  const email = value.trim();
  if (!email) return null;
  if (email.length > LIMITS.email || !EMAIL_RE.test(email) || email.includes("..")) {
    throw new TrainerValidationError("Enter a valid email address, or leave it blank");
  }
  return email;
}

function parsePhone(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new TrainerValidationError("Phone must be text");
  const phone = value.trim();
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (
    phone.length > LIMITS.phone ||
    digits.length < 7 ||
    digits.length > 15 ||
    !PHONE_CHARS_RE.test(phone)
  ) {
    throw new TrainerValidationError("Enter a valid phone number, or leave it blank");
  }
  return phone;
}

function parseHttpUrl(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new TrainerValidationError(`${label} must be text`);
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length > LIMITS.website) {
    throw new TrainerValidationError(`${label} is too long`);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TrainerValidationError(`${label} must be a valid http or https URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TrainerValidationError(`${label} must start with http:// or https://`);
  }
  if (!url.hostname || !url.hostname.includes(".")) {
    throw new TrainerValidationError(`${label} must be a valid http or https URL`);
  }
  return raw;
}

function parsePhotoUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new TrainerValidationError("Photo must be text");
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length > LIMITS.photo) throw new TrainerValidationError("Photo URL is too long");
  if (raw.startsWith("/") && !raw.startsWith("//") && !/\s/.test(raw)) return raw;
  return parseHttpUrl(raw, "Photo");
}

function parseSortOrder(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < -10000 || n > 10000) {
    throw new TrainerValidationError("Sort order must be a whole number");
  }
  return n;
}

function parsePublishedAt(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new TrainerValidationError("Published date is invalid");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TrainerValidationError("Published date is invalid");
  }
  return date.toISOString();
}

function parseEventGids(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new TrainerValidationError("Events must be a list of Shopify products");
  }
  if (value.length > LIMITS.events) {
    throw new TrainerValidationError(`Choose ${LIMITS.events} events or fewer`);
  }
  const seen = new Set<string>();
  const gids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !PRODUCT_GID_RE.test(item)) {
      throw new TrainerValidationError("Each event must be a Shopify product");
    }
    if (seen.has(item)) continue;
    seen.add(item);
    gids.push(item);
  }
  return gids;
}

function pick(body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (body[key] !== undefined) return body[key];
  }
  return undefined;
}

export function parseCreateTrainerInput(body: unknown): TrainerWriteInput {
  const record = asRecord(body);
  const name = parseName(pick(record, "name"));
  const slugValue = pick(record, "slug");
  const slug =
    typeof slugValue === "string" && slugValue.trim()
      ? parseSlug(slugValue)
      : parseSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));

  return {
    slug,
    name,
    title: parseOptionalText(pick(record, "title"), "Title", LIMITS.title),
    summary: parseOptionalText(pick(record, "summary"), "Summary", LIMITS.summary),
    bodyHtml: parseBody(pick(record, "bodyHtml", "body")),
    photoUrl: parsePhotoUrl(pick(record, "photoUrl")),
    contactEmail: parseEmail(pick(record, "contactEmail", "email")),
    contactPhone: parsePhone(pick(record, "contactPhone", "phone")),
    websiteUrl: parseHttpUrl(pick(record, "websiteUrl", "website"), "Website"),
    sortOrder: parseSortOrder(pick(record, "sortOrder")),
    publishedAt: parsePublishedAt(pick(record, "publishedAt")),
    eventProductGids: parseEventGids(pick(record, "eventProductGids")),
  };
}

export function parseUpdateTrainerInput(body: unknown): TrainerUpdateInput {
  const record = asRecord(body);
  const input: TrainerUpdateInput = {};

  if (record.slug !== undefined) input.slug = parseSlug(record.slug);
  if (record.name !== undefined) input.name = parseName(record.name);
  if (record.title !== undefined) input.title = parseOptionalText(record.title, "Title", LIMITS.title);
  if (record.summary !== undefined) {
    input.summary = parseOptionalText(record.summary, "Summary", LIMITS.summary);
  }
  if (record.bodyHtml !== undefined || record.body !== undefined) {
    input.bodyHtml = parseBody(pick(record, "bodyHtml", "body"));
  }
  if (record.photoUrl !== undefined) input.photoUrl = parsePhotoUrl(record.photoUrl);
  if (record.contactEmail !== undefined || record.email !== undefined) {
    input.contactEmail = parseEmail(pick(record, "contactEmail", "email"));
  }
  if (record.contactPhone !== undefined || record.phone !== undefined) {
    input.contactPhone = parsePhone(pick(record, "contactPhone", "phone"));
  }
  if (record.websiteUrl !== undefined || record.website !== undefined) {
    input.websiteUrl = parseHttpUrl(pick(record, "websiteUrl", "website"), "Website");
  }
  if (record.sortOrder !== undefined) input.sortOrder = parseSortOrder(record.sortOrder);
  if (record.publishedAt !== undefined) input.publishedAt = parsePublishedAt(record.publishedAt);
  if (record.eventProductGids !== undefined) input.eventProductGids = parseEventGids(record.eventProductGids);

  if (Object.keys(input).length === 0) {
    throw new TrainerValidationError("No changes to save");
  }
  return input;
}
