import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/blog-admin";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const trainerId = (formData.get("trainerId") as string) || "draft";

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded. Use form field 'file'." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Image must be JPEG, PNG, WebP, or GIF" },
        { status: 400 }
      );
    }

    const ext = file.type.split("/")[1] || "jpg";
    const safeId = trainerId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80) || "draft";
    const pathname = `trainers/${safeId}-${Date.now()}.${ext}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Trainer photo upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
