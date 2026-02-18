import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const sources = await prisma.source.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, url } = body as { type: string; name: string; url: string };

    if (!type || !name || !url) {
      return NextResponse.json({ error: "type, name, and url are required" }, { status: 400 });
    }

    const source = await prisma.source.create({
      data: { type, name, url },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
