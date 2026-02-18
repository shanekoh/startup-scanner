import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runFullScrape } from "@/lib/scraper";
import { generateNewsletter } from "@/lib/generate-newsletter";
import { sendNewsletter } from "@/lib/email";

export const maxDuration = 120;

// Vercel cron calls this endpoint daily — sends template newsletter
// For AI-generated newsletters, use the scrape → Claude → save flow instead
export async function GET(req: NextRequest) {
  // Verify cron secret in production
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read email from Config table, fallback to env var
  const config = await prisma.config.findUnique({ where: { id: "singleton" } });
  const recipient = config?.email || process.env.NEWSLETTER_TO;

  if (!recipient) {
    return NextResponse.json(
      { error: "No email recipient configured" },
      { status: 500 }
    );
  }

  try {
    const { startups } = await runFullScrape();
    const { subject, html } = generateNewsletter(startups);

    const newsletter = await prisma.newsletter.create({
      data: { subject, html },
    });

    await sendNewsletter(recipient, subject, html);
    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { sentAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      id: newsletter.id,
      startupCount: startups.length,
      sentTo: recipient,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
