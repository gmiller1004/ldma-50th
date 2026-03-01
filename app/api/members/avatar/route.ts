import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { lookupMember } from "@/lib/salesforce";
import { setAvatarUrl } from "@/lib/avatars";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const member = await lookupMember(session.memberNumber);
    if (!member.valid || !member.contactId) {
      return NextResponse.json({ error: "Member not found" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded. Use form field 'avatar'." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image must be under 2MB" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Image must be JPEG, PNG, WebP, or GIF" },
        { status: 400 }
      );
    }

    const ext = file.type.split("/")[1] || "jpg";
    const pathname = `avatars/${member.contactId}-${Date.now()}.${ext}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });

    await setAvatarUrl(member.contactId, blob.url);

    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("Avatar upload error:", e);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
