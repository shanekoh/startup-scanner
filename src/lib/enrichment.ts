// Enrichment module — currently a no-op placeholder.
// Previously used an LLM API for enrichment; now the enrichment
// is expected to happen via Claude Code CLI when generating newsletters.

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
  return {
    summary: data.description,
    industry: "AI",
    founderProfile: data.founders.join(", ") || "Unknown",
    leadInvestor: "Unknown",
  };
}

export async function enrichBatch(
  startups: StartupData[]
): Promise<Map<string, EnrichedStartup>> {
  const results = new Map<string, EnrichedStartup>();
  for (const startup of startups) {
    results.set(startup.name, await enrichStartup(startup));
  }
  return results;
}
