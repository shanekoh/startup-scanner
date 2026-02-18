import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const config = await prisma.config.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(config || { email: "" });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { email } = body as { email: string };

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const config = await prisma.config.upsert({
    where: { id: "singleton" },
    create: { email },
    update: { email },
  });

  return NextResponse.json(config);
}
