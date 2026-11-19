import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/blog-admin";
import { hasDb } from "@/lib/db";
import { createTrainer, listTrainers, TrainerSlugConflictError } from "@/lib/trainers";
import { parseCreateTrainerInput, TrainerValidationError } from "@/lib/trainers-validate";

function trainerError(error: unknown): NextResponse {
  if (error instanceof TrainerValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof TrainerSlugConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  console.error("Admin trainers error:", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function GET() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  if (!hasDb()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const trainers = await listTrainers();
    return NextResponse.json({ trainers });
  } catch (error) {
    return trainerError(error);
  }
}

export async function POST(request: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  if (!hasDb()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const input = parseCreateTrainerInput(body);
    const trainer = await createTrainer(input);
    if (!trainer) {
      return NextResponse.json({ error: "Failed to create trainer" }, { status: 500 });
    }
    return NextResponse.json(trainer);
  } catch (error) {
    return trainerError(error);
  }
}
