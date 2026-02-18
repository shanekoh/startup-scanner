import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { wrapInEmailShell } from "@/lib/generate-newsletter";
import { sendNewsletter } from "@/lib/email";

// POST /api/newsletter/save — save AI-generated newsletter content
// Body: { content: "<inner HTML>", email?: "recipient@example.com", stats?: { blogPosts, deals, hiring } }
// The content is the AI-generated inner HTML (3 sections), which gets wrapped in the email template shell.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const content = body.content as string;
    const email = body.email as string | undefined;
    const stats = body.stats as { blogPosts: number; deals: number; hiring: number } | undefined;

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Missing 'content' field — provide the inner HTML" },
        { status: 400 }
      );
    }

    const { subject, html } = wrapInEmailShell(content, stats ?? { blogPosts: 0, deals: 0, hiring: 0 });

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
      sent: !!email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
