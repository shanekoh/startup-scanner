import { NextResponse } from "next/server";
import { runScrape } from "@/lib/scraper";

export const maxDuration = 60;

export async function POST() {
  try {
    const startups = await runScrape(30);
    return NextResponse.json({
      success: true,
      count: startups.length,
      startups: startups.map((s) => ({
        name: s.name,
        batch: s.batch,
        category: s.category,
        founders: s.founders.length,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
