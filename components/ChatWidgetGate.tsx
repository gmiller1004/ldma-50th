import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { LdmaChatWidget } from "@/components/LdmaChatWidget";

/** Site-wide chat for visitors only (not logged-in members). */
export async function ChatWidgetGate() {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  if (token) {
    const session = await verifySessionToken(token);
    if (session) return null;
  }
  return <LdmaChatWidget />;
}
