import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/blog-admin";
import { hasDb } from "@/lib/db";
import {
  deleteTrainer,
  getTrainerById,
  TrainerSlugConflictError,
  updateTrainer,
} from "@/lib/trainers";
import { parseUpdateTrainerInput, TrainerValidationError } from "@/lib/trainers-validate";

type Params = Promise<{ id: string }>;

function trainerError(error: unknown): NextResponse {
  if (error instanceof TrainerValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof TrainerSlugConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  console.error("Admin trainer error:", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  if (!hasDb()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const { id } = await params;
    const trainer = await getTrainerById(id);
    if (!trainer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(trainer);
  } catch (error) {
    return trainerError(error);
  }
}

async function update(request: NextRequest, params: Params) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  if (!hasDb()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const { id } = await params;
    const existing = await getTrainerById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const input = parseUpdateTrainerInput(body);
    const trainer = await updateTrainer(id, input);
    if (!trainer) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    return NextResponse.json(trainer);
  } catch (error) {
    return trainerError(error);
  }
}

export function PATCH(request: NextRequest, context: { params: Params }) {
  return update(request, context.params);
}

export function PUT(request: NextRequest, context: { params: Params }) {
  return update(request, context.params);
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  if (!hasDb()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const { id } = await params;
    const existing = await getTrainerById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await deleteTrainer(id);
    if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return trainerError(error);
  }
}
