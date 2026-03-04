import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { getProductByHandleWithVariantMetafields } from "@/lib/shopify";
import { filterVipVariantsByMember } from "@/lib/vip-upsell";
import { VIP_UPSELL_PRODUCT_HANDLE } from "@/lib/events-config";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isMemberLoggedIn = !!session;

    const product = await getProductByHandleWithVariantMetafields(
      VIP_UPSELL_PRODUCT_HANDLE
    );
    const filtered = filterVipVariantsByMember(product, isMemberLoggedIn);

    return NextResponse.json({
      product: filtered,
      isMemberLoggedIn,
    });
  } catch (e) {
    console.error("vip-upsell GET error:", e);
    return NextResponse.json(
      { error: "Failed to load VIP upgrade" },
      { status: 500 }
    );
  }
}
