import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/newsletter/[id] — get full newsletter HTML
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const newsletter = await prisma.newsletter.findUnique({ where: { id } });
  if (!newsletter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(newsletter);
}
