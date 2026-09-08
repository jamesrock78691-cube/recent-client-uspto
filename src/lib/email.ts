import { Resend } from "resend";
import { createSentEmail } from "@/db/operations";
import type { USPTOApplication } from "@/lib/uspto";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set. Emails will not be sent.");
    return null;
  }
  return new Resend(apiKey);
}

export function processTemplate(
  template: { subject: string; body: string },
  app: USPTOApplication
): { subject: string; body: string } {
  const variables: Record<string, string> = {
    applicationNumber: app.applicationNumber || app.serialNumber || "",
    serialNumber: app.serialNumber || app.applicationNumber || "",
    patentTitle: app.patentTitle || app.markText || "N/A",
    markText: app.markText || app.patentTitle || "N/A",
    applicantName: app.applicantName || app.ownerName || "Valued Applicant",
    ownerName: app.ownerName || app.applicantName || "Valued Applicant",
    filingDate: app.filingDate || "N/A",
    publicationDate: app.publicationDate || app.registrationDate || "N/A",
    registrationDate: app.registrationDate || app.publicationDate || "N/A",
    inventorName: app.inventorName || app.correspondentName || "N/A",
    attorneyName: app.attorneyName || "N/A",
    attorneyEmail: app.attorneyEmail || "N/A",
    hasAttorney: app.hasAttorney ? "Yes" : "No",
    status: app.status || "Pending",
    patentType: app.patentType || app.markType || "Trademark",
    markType: app.markType || app.patentType || "Trademark",
    abstract: app.abstract || app.goodsAndServices || "N/A",
    goodsAndServices: app.goodsAndServices || app.abstract || "N/A",
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  };

  let subject = template.subject;
  let body = template.body;

  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replaceAll(`{{${key}}}`, value);
    body = body.replaceAll(`{{${key}}}`, value);
  }

  return { subject, body };
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  applicationId?: number,
  templateId?: number,
  from?: string,
  fromName?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const fromAddress = from || process.env.EMAIL_FROM || "onboarding@resend.dev";
    const fromNameValue = fromName || process.env.EMAIL_FROM_NAME || "Trademark Outreach";

    const { data, error } = await resend.emails.send({
      from: `${fromNameValue} <${fromAddress}>`,
      to: [to],
      subject,
      html: body,
      headers: {
        "X-Application-Id": applicationId?.toString() || "",
        "X-Template-Id": templateId?.toString() || "",
      },
    });

    if (error) {
      console.error("Resend API error:", error);
      return { success: false, error: error.message };
    }

    await createSentEmail({
      applicationId,
      templateId,
      to,
      subject,
      body,
      resendId: data?.id,
    });

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Send email error:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendEmailWithTemplate(
  app: USPTOApplication,
  template: { subject: string; body: string },
  templateId?: number
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (app.hasAttorney) {
    return { success: false, error: "Skipped: application has attorney" };
  }

  const to = app.applicantEmail || app.ownerEmail || app.correspondentEmail;
  if (!to) {
    return { success: false, error: "No email address found for applicant" };
  }

  const { subject, body } = processTemplate(template, app);
  return sendEmail(to, subject, body, undefined, templateId);
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: `Trademark Monitor Test <onboarding@resend.dev>`,
      to: [to],
      subject: "Trademark Monitor - Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #1a73e8;">Test Email Successful</h2>
          <p>This is a test email from the Trademark Monitor system.</p>
          <p>Trademarks only — attorneys are skipped.</p>
          <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function getDefaultEmailTemplate(): { subject: string; body: string } {
  return {
    subject: "Your USPTO Trademark Application {{serialNumber}} — {{markText}}",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a73e8, #0d47a1); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">USPTO Trademark Application</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Application notice</p>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <p style="font-size: 16px;">Dear <strong>{{ownerName}}</strong>,</p>
          <p>We noticed your recent trademark filing with the USPTO.</p>
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Serial Number:</td><td style="padding: 8px;">{{serialNumber}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Mark:</td><td style="padding: 8px;">{{markText}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Filing Date:</td><td style="padding: 8px;">{{filingDate}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Status:</td><td style="padding: 8px;">{{status}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Goods / Services:</td><td style="padding: 8px;">{{goodsAndServices}}</td></tr>
            </table>
          </div>
          <p style="color: #666;">If you have any questions, reply to this email.</p>
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #e0e0e0;">
          <p>Trademark Monitor | Automated notification</p>
          <p>Sent on {{date}} at {{time}}</p>
        </div>
      </div>
    `,
  };
}
