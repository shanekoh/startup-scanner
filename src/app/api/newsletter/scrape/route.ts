import { NextResponse } from "next/server";
import { runFullScrape } from "@/lib/scraper";

export const maxDuration = 120;

// POST /api/newsletter/scrape — run all scrapers and return raw data for AI processing
// This is designed to be called from Claude Code CLI:
//   curl -s localhost:3000/api/newsletter/scrape | claude -p "generate newsletter HTML from this data"
export async function POST() {
  try {
    const { startups, blogPosts, fundraisingNews, hiringNews } = await runFullScrape();

    // Format data for LLM consumption
    const blogPostsSummary = blogPosts.slice(0, 30).map((i) => ({
      source: i.source,
      title: i.title,
      summary: i.summary,
      url: i.url,
    }));

    const fundraisingSummary = fundraisingNews.slice(0, 15).map((i) => ({
      source: i.source,
      title: i.title,
      summary: i.summary,
      url: i.url,
    }));

    const hiringSummary = hiringNews.slice(0, 15).map((i) => ({
      source: i.source,
      title: i.title,
      summary: i.summary,
      url: i.url,
    }));

    const startupsSummary = startups.slice(0, 15).map((s) => ({
      name: s.name,
      stage: s.stage,
      teamSize: s.teamSize,
      oneLiner: s.oneLiner,
      website: s.website,
      industry: s.industry,
      companyLinkedIn: s.companyLinkedIn || "",
      founders: s.founders.map((f) => ({
        name: f.name,
        linkedIn: f.linkedIn || "",
      })),
    }));

    return NextResponse.json({
      success: true,
      scrapedAt: new Date().toISOString(),
      stats: {
        blogPosts: blogPosts.length,
        fundraising: fundraisingNews.length,
        hiring: hiringNews.length,
        startups: startups.length,
      },
      data: {
        blogPosts: blogPostsSummary,
        fundraising: fundraisingSummary,
        hiring: hiringSummary,
        startups: startupsSummary,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
