import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const keywords = await prisma.keyword.findMany({ orderBy: { term: "asc" } });
  return NextResponse.json(keywords);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { term } = body as { term: string };

    if (!term) {
      return NextResponse.json({ error: "term is required" }, { status: 400 });
    }

    const keyword = await prisma.keyword.create({
      data: { term: term.trim() },
    });

    return NextResponse.json(keyword, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
