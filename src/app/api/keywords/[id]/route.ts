import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const keyword = await prisma.keyword.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(keyword);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.keyword.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
