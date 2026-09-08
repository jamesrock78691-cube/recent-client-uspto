import { fetchRecentTrademarks } from "@/lib/uspto";
import {
  upsertApplication,
  getUnemailedApplications,
  getDefaultTemplate,
  getGoogleConfig,
  createLog,
  markApplicationEmailSent,
} from "@/db/operations";
import { sendEmailWithTemplate, getDefaultEmailTemplate } from "@/lib/email";
import { appendToSheet, type SheetRow } from "@/lib/google-sheets";

export interface SyncResult {
  totalFetched: number;
  newApplications: number;
  existingApplications: number;
  emailsSent: number;
  emailsSkippedAttorney: number;
  emailsSkippedNoEmail: number;
  emailsFailed: number;
  sheetsUpdated: number;
  logs: string[];
}

/** TRADEMARKS ONLY — skip attorneys, email pro se when email exists */
export async function runFullSync(daysBack = 2, limit = 100): Promise<SyncResult> {
  const result: SyncResult = {
    totalFetched: 0,
    newApplications: 0,
    existingApplications: 0,
    emailsSent: 0,
    emailsSkippedAttorney: 0,
    emailsSkippedNoEmail: 0,
    emailsFailed: 0,
    sheetsUpdated: 0,
    logs: [],
  };

  try {
    result.logs.push("Fetching trademark daily XML (TRTDXFAP)...");
    await createLog("uspto_fetch", "started", "Fetching trademarks from daily XML");

    const applications = await fetchRecentTrademarks(daysBack, limit);
    result.totalFetched = applications.length;
    result.logs.push(`Found ${applications.length} trademark records`);

    if (applications.length === 0) {
      result.logs.push("No trademarks found. Check USPTO_ODP_API_KEY and that daily file is published.");
      await createLog("uspto_fetch", "completed", "No trademarks found");
      return result;
    }

    result.logs.push("Saving trademarks to database...");
    for (const app of applications) {
      const appData = {
        applicationNumber: app.applicationNumber || app.serialNumber,
        patentTitle: app.patentTitle || app.markText,
        filingDate: app.filingDate ? new Date(app.filingDate) : undefined,
        publicationDate: app.publicationDate
          ? new Date(app.publicationDate)
          : app.registrationDate
            ? new Date(app.registrationDate)
            : undefined,
        applicantName: app.applicantName || app.ownerName,
        applicantAddress: app.applicantAddress || app.ownerAddress,
        applicantEmail: app.applicantEmail || app.ownerEmail || undefined,
        inventorName: app.inventorName || app.correspondentName,
        attorneyName: app.attorneyName || undefined,
        attorneyEmail: app.attorneyEmail || undefined,
        hasAttorney: app.hasAttorney || false,
        status: app.status,
        patentType: "Trademark",
        abstract: app.abstract || app.goodsAndServices,
        usptoApiData: app.raw,
      };

      const saved = await upsertApplication(appData);
      if (saved.isNew) {
        result.newApplications++;
        const attTag = app.hasAttorney ? " [ATTORNEY — skip email]" : "";
        result.logs.push(
          `NEW TM: ${app.applicationNumber} - ${app.patentTitle || app.markText || "Untitled"}${attTag}`
        );
      } else {
        result.existingApplications++;
      }
    }

    await createLog(
      "uspto_fetch",
      "completed",
      `Fetched ${applications.length}, New: ${result.newApplications}`
    );

    result.logs.push("Processing emails (trademarks only, skip attorneys)...");
    await createLog("email_send", "started", "Sending to pro se trademark applicants");

    let template = await getDefaultTemplate();
    if (!template) {
      result.logs.push("Creating default trademark template...");
      const defaultTmpl = getDefaultEmailTemplate();
      const { createEmailTemplate } = await import("@/db/operations");
      template = await createEmailTemplate({
        name: "Default Trademark Template",
        subject: defaultTmpl.subject,
        body: defaultTmpl.body,
        isDefault: true,
      });
    }

    const unemailed = await getUnemailedApplications();

    for (const app of unemailed) {
      if (app.hasAttorney) {
        result.emailsSkippedAttorney++;
        result.logs.push(
          `SKIPPED (Attorney): ${app.applicationNumber} - ${app.attorneyName || "Unknown"}`
        );
        await markApplicationEmailSent(app.id, "skipped_attorney");
        continue;
      }

      if (!app.applicantEmail) {
        result.emailsSkippedNoEmail++;
        result.logs.push(`SKIPPED (no email): ${app.applicationNumber}`);
        continue;
      }

      try {
        const usptoApp = {
          serialNumber: app.applicationNumber,
          applicationNumber: app.applicationNumber,
          patentTitle: app.patentTitle || "",
          markText: app.patentTitle || "",
          filingDate: app.filingDate?.toISOString().split("T")[0] || "",
          publicationDate: app.publicationDate?.toISOString().split("T")[0] || "",
          registrationDate: app.publicationDate?.toISOString().split("T")[0] || "",
          applicantName: app.applicantName || "",
          ownerName: app.applicantName || "",
          applicantAddress: app.applicantAddress || "",
          ownerAddress: app.applicantAddress || "",
          applicantEmail: app.applicantEmail || "",
          ownerEmail: app.applicantEmail || "",
          inventorName: app.inventorName || "",
          correspondentName: app.inventorName || "",
          attorneyName: app.attorneyName || "",
          attorneyEmail: app.attorneyEmail || "",
          hasAttorney: false,
          status: app.status || "",
          patentType: "Trademark",
          markType: "Trademark",
          abstract: app.abstract || "",
          goodsAndServices: app.abstract || "",
          raw: (app.usptoApiData as Record<string, unknown>) || {},
        };

        const emailResult = await sendEmailWithTemplate(
          usptoApp,
          { subject: template.subject, body: template.body },
          template.id
        );

        if (emailResult.success) {
          result.emailsSent++;
          await markApplicationEmailSent(app.id, "sent");
          result.logs.push(`Email sent: ${app.applicationNumber} -> ${app.applicantEmail}`);
        } else {
          result.emailsFailed++;
          result.logs.push(`Email failed: ${app.applicationNumber} - ${emailResult.error}`);
        }
      } catch (error) {
        result.emailsFailed++;
        result.logs.push(`Email error: ${app.applicationNumber} - ${error}`);
      }
    }

    await createLog(
      "email_send",
      "completed",
      `Sent: ${result.emailsSent}, Attorney skip: ${result.emailsSkippedAttorney}, No email: ${result.emailsSkippedNoEmail}, Failed: ${result.emailsFailed}`
    );

    const googleConfig = await getGoogleConfig();
    if (googleConfig && googleConfig.isActive) {
      for (const app of unemailed) {
        try {
          const isAttorney = app.hasAttorney || !!app.attorneyName;
          const sheetRow: SheetRow = {
            applicationNumber: app.applicationNumber,
            patentTitle: app.patentTitle || "",
            filingDate: app.filingDate?.toLocaleDateString() || "",
            publicationDate: app.publicationDate?.toLocaleDateString() || "",
            applicantName: app.applicantName || "",
            applicantAddress: app.applicantAddress || "",
            applicantEmail: app.applicantEmail || "",
            inventorName: app.inventorName || "",
            attorneyName: app.attorneyName || "",
            attorneyEmail: app.attorneyEmail || "",
            hasAttorney: isAttorney ? "Yes" : "No",
            status: app.status || "",
            patentType: "Trademark",
            abstract: app.abstract || "",
            emailSent: isAttorney ? "Skipped (Attorney)" : app.emailSent ? "Yes" : "No",
            emailSentAt: app.emailSentAt ? app.emailSentAt.toLocaleString() : "",
            replyReceived: "No",
            lastUpdated: new Date().toLocaleString(),
          };
          await appendToSheet(sheetRow);
          result.sheetsUpdated++;
        } catch (error) {
          result.logs.push(`Sheet failed: ${app.applicationNumber} - ${error}`);
        }
      }
    } else {
      result.logs.push("Google Sheets not active — skipped.");
    }

    result.logs.push("Sync complete (trademarks only).");
    await createLog("sync", "completed", JSON.stringify(result));
    return result;
  } catch (error) {
    result.logs.push(`Sync error: ${error}`);
    await createLog("sync", "error", String(error));
    return result;
  }
}
