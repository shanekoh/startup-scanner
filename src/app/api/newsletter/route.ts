import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runFullScrape } from "@/lib/scraper";
import { generateNewsletter } from "@/lib/generate-newsletter";
import { sendNewsletter } from "@/lib/email";

export const maxDuration = 120;

// POST /api/newsletter — scrape all sources, generate template newsletter, optionally send
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email as string | undefined;

    // Full scrape across all enabled sources
    const { startups } = await runFullScrape();

    // Generate template newsletter (no LLM needed)
    const { subject, html } = generateNewsletter(startups);

    // Save to DB
    const newsletter = await prisma.newsletter.create({
      data: { subject, html },
    });

    // Send if email provided
    if (email) {
      await sendNewsletter(email, subject, html);
      await prisma.newsletter.update({
        where: { id: newsletter.id },
        data: { sentAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      id: newsletter.id,
      subject,
      startupCount: startups.length,
      sent: !!email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/newsletter — list past newsletters
export async function GET() {
  const newsletters = await prisma.newsletter.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      subject: true,
      sentAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json(newsletters);
}
