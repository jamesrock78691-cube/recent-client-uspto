import { getSentEmails, updateEmailReply } from "@/db/operations";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const emails = await getSentEmails(limit);
    return Response.json({ success: true, emails });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * Webhook endpoint for email replies
 * Connect this to Resend inbound webhook or email forwarding
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Resend inbound webhook format
    const { from, subject, text, html, email_id } = body;

    // Try to find the original email and mark as replied
    if (email_id) {
      const { getSentEmails } = await import("@/db/operations");
      const emails = await getSentEmails(1000);
      const original = emails.find((e) => e.resendId === email_id);
      if (original) {
        await updateEmailReply(original.id, text || html || "Reply received");
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
