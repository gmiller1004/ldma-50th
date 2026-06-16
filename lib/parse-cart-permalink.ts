/** Parse Shopify classic cart permalink segment: `variantId:qty,variantId:qty` */
export type CartPermalinkLine = { id: string; quantity: number };

export function parseCartPermalinkLines(raw: string): CartPermalinkLine[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const lines: CartPermalinkLine[] = [];
  for (const part of trimmed.split(",")) {
    const segment = part.trim();
    if (!segment) continue;

    const colon = segment.lastIndexOf(":");
    if (colon <= 0) continue;

    const id = segment.slice(0, colon).trim();
    const qtyRaw = segment.slice(colon + 1).trim();
    const quantity = Math.max(1, Math.min(100, Math.floor(Number(qtyRaw) || 1)));
    if (!id || !/^\d+$/.test(id)) continue;

    lines.push({ id, quantity });
  }

  return lines;
}
