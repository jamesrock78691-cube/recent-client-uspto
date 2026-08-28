import { sendTestEmail } from "@/lib/email";
import { getSetting, setSetting } from "@/db/operations";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, to, subject, body: emailBody, html, from, fromName } = body;

    if (action === "test") {
      if (!to) return Response.json({ success: false, error: "Email address required" }, { status: 400 });
      const result = await sendTestEmail(to);
      return Response.json(result);
    }

    // Direct send
    const { sendEmail } = await import("@/lib/email");
    const result = await sendEmail(to, subject, html || emailBody, undefined, undefined, from, fromName);
    return Response.json(result);
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const resendKey = process.env.RESEND_API_KEY ? "configured" : "not_configured";
    const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
    const emailFromName = process.env.EMAIL_FROM_NAME || "USPTO Monitor";

    return Response.json({
      success: true,
      config: {
        resendStatus: resendKey,
        emailFrom,
        emailFromName,
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
