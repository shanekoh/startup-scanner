import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface StartupData {
  name: string;
  description: string;
  founders: string[];
  fundingStage: string;
}

interface EnrichedStartup {
  summary: string;
  industry: string;
  founderProfile: string;
  leadInvestor: string;
}

export async function enrichStartup(
  data: StartupData
): Promise<EnrichedStartup> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are a startup analyst. Given this startup info, provide a JSON response with these fields:
- "summary": One paragraph summary of the company and what they do
- "industry": Specific AI sub-industry (e.g. "AI Infrastructure", "AI Healthcare", "Computer Vision")
- "founderProfile": Brief background on founders
- "leadInvestor": Known lead investor if any, or "Unknown"

Startup: ${data.name}
Description: ${data.description}
Founders: ${data.founders.join(", ") || "Unknown"}
Funding Stage: ${data.fundingStage}

Respond with ONLY valid JSON, no markdown.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "{}";

  try {
    return JSON.parse(text) as EnrichedStartup;
  } catch {
    return {
      summary: data.description,
      industry: "AI",
      founderProfile: data.founders.join(", ") || "Unknown",
      leadInvestor: "Unknown",
    };
  }
}

export async function enrichBatch(
  startups: StartupData[]
): Promise<Map<string, EnrichedStartup>> {
  const results = new Map<string, EnrichedStartup>();

  for (const startup of startups) {
    try {
      const enriched = await enrichStartup(startup);
      results.set(startup.name, enriched);
    } catch (err) {
      console.error(`Failed to enrich ${startup.name}:`, err);
      results.set(startup.name, {
        summary: startup.description,
        industry: "AI",
        founderProfile: "Unknown",
        leadInvestor: "Unknown",
      });
    }
    // Rate limit: ~1 req/sec
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}
