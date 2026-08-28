import { Resend } from "resend";
import { createEmailTemplate, createSentEmail } from "@/db/operations";
import type { USPTOApplication } from "@/lib/uspto";

// Initialize Resend - reads RESEND_API_KEY from env
function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set. Emails will not be sent.");
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Process email template with application data
 * Supports variables: {{applicationNumber}}, {{patentTitle}}, {{applicantName}},
 * {{filingDate}}, {{publicationDate}}, {{inventorName}}, {{status}}, {{patentType}}, {{abstract}}
 */
export function processTemplate(
  template: { subject: string; body: string },
  app: USPTOApplication
): { subject: string; body: string } {
  const variables: Record<string, string> = {
    applicationNumber: app.applicationNumber,
    patentTitle: app.patentTitle || "N/A",
    applicantName: app.applicantName || "Valued Applicant",
    filingDate: app.filingDate || "N/A",
    publicationDate: app.publicationDate || "N/A",
    inventorName: app.inventorName || "N/A",
    attorneyName: app.attorneyName || "N/A",
    attorneyEmail: app.attorneyEmail || "N/A",
    hasAttorney: app.hasAttorney ? "Yes" : "No",
    status: app.status || "Pending",
    patentType: app.patentType || "N/A",
    abstract: app.abstract || "N/A",
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

/**
 * Send email to applicant
 */
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
    const fromNameValue = fromName || process.env.EMAIL_FROM_NAME || "USPTO Monitor";

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

    // Track in database
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

/**
 * Send email to applicant using template
 */
export async function sendEmailWithTemplate(
  app: USPTOApplication,
  template: { subject: string; body: string },
  templateId?: number
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!app.applicantEmail) {
    return { success: false, error: "No email address found for applicant" };
  }

  const { subject, body } = processTemplate(template, app);

  return sendEmail(
    app.applicantEmail,
    subject,
    body,
    undefined,
    templateId
  );
}

/**
 * Send test email
 */
export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: `USPTO Monitor Test <onboarding@resend.dev>`,
      to: [to],
      subject: "USPTO Monitor - Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #1a73e8;">✅ Test Email Successful</h2>
          <p>This is a test email from the USPTO Monitor system.</p>
          <p>If you received this, your email configuration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toLocaleString()}<br>
            USPTO Monitor System
          </p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get default email template for new applications
 */
export function getDefaultEmailTemplate(): { subject: string; body: string } {
  return {
    subject: "Your USPTO Patent Application {{applicationNumber}} - Confirmation",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a73e8, #0d47a1); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">USPTO Patent Application</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Application Confirmation</p>
        </div>

        <div style="padding: 30px; background: #f8f9fa;">
          <p style="font-size: 16px;">Dear <strong>{{applicantName}}</strong>,</p>

          <p>We are writing to confirm that your patent application has been processed.</p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Application Number:</td><td style="padding: 8px;">{{applicationNumber}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Patent Title:</td><td style="padding: 8px;">{{patentTitle}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Filing Date:</td><td style="padding: 8px;">{{filingDate}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Publication Date:</td><td style="padding: 8px;">{{publicationDate}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Inventor:</td><td style="padding: 8px;">{{inventorName}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Type:</td><td style="padding: 8px;">{{patentType}}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Status:</td><td style="padding: 8px;">{{status}}</td></tr>
            </table>
          </div>

          {{#if abstract}}
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1a73e8; margin-top: 0;">Abstract</h3>
            <p>{{abstract}}</p>
          </div>
          {{/if}}

          <p style="color: #666;">If you have any questions, please don't hesitate to contact us.</p>
        </div>

        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #e0e0e0;">
          <p>USPTO Monitor System | Automated Notification</p>
          <p>Sent on {{date}} at {{time}}</p>
        </div>
      </div>
    `,
  };
}
