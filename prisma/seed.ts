import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Default sources
  const sources = [
    { type: "rss", name: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/" },
    { type: "rss", name: "Google News - AI Startups", url: "https://news.google.com/rss/search?q=AI+startup+funding&hl=en-US&gl=US&ceid=US:en" },
    { type: "api", name: "Hacker News", url: "https://hn.algolia.com/api/v1/search_by_date" },
    { type: "api", name: "YC Algolia", url: "https://45BWZJ1SGC-dsn.algolia.net/1/indexes/YCCompany_production/query" },
    // X/Twitter accounts — curated tech/VC/AI influencers
    { type: "twitter", name: "X - @sama", url: "@sama" },
    { type: "twitter", name: "X - @pmarca", url: "@pmarca" },
    { type: "twitter", name: "X - @garrytan", url: "@garrytan" },
    { type: "twitter", name: "X - @elonmusk", url: "@elonmusk" },
    { type: "twitter", name: "X - @satikirant", url: "@satikirant" },
    { type: "twitter", name: "X - @emaborevkova", url: "@emaborevkova" },
    { type: "twitter", name: "X - @benedictevans", url: "@benedictevans" },
    { type: "twitter", name: "X - @pacaborevkova", url: "@pacaborevkova" },
    { type: "twitter", name: "X - @levelsio", url: "@levelsio" },
    { type: "twitter", name: "X - @paulg", url: "@paulg" },
    { type: "twitter", name: "X - @jason", url: "@jason" },
    { type: "twitter", name: "X - @aaborevkova", url: "@aaborevkova" },
    { type: "twitter", name: "X - @naval", url: "@naval" },
    { type: "twitter", name: "X - @ycombinator", url: "@ycombinator" },
    { type: "twitter", name: "X - @OpenAI", url: "@OpenAI" },
  ];

  for (const s of sources) {
    await prisma.source.upsert({
      where: { id: s.name },
      create: { id: s.name, ...s },
      update: s,
    });
  }

  // Default keywords
  const keywords = [
    "fundraising", "Series A", "seed round", "AI startup",
    "product manager", "PM hiring",
  ];

  for (const term of keywords) {
    await prisma.keyword.upsert({
      where: { term },
      create: { term },
      update: {},
    });
  }

  // Default config
  await prisma.config.upsert({
    where: { id: "singleton" },
    create: { email: "ksx1991@gmail.com" },
    update: {},
  });

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
