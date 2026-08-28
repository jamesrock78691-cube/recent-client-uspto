import { fetchRecentApplications } from "@/lib/uspto";
import { upsertApplication, getUnemailedApplications, getDefaultTemplate, getGoogleConfig, createLog } from "@/db/operations";
import { processTemplate, sendEmailWithTemplate, getDefaultEmailTemplate } from "@/lib/email";
import { appendToSheet, type SheetRow } from "@/lib/google-sheets";

export interface SyncResult {
  totalFetched: number;
  newApplications: number;
  existingApplications: number;
  emailsSent: number;
  emailsSkippedAttorney: number;
  emailsFailed: number;
  sheetsUpdated: number;
  logs: string[];
}

/**
 * Main sync function - runs on cron or manual trigger
 * 1. Fetch recent USPTO applications
 * 2. Save to database (upsert)
 * 3. Send emails to applicants (SKIP if attorney present)
 * 4. Sync ALL to Google Sheets (including attorney info)
 */
export async function runFullSync(daysBack = 3, limit = 50): Promise<SyncResult> {
  const result: SyncResult = {
    totalFetched: 0,
    newApplications: 0,
    existingApplications: 0,
    emailsSent: 0,
    emailsSkippedAttorney: 0,
    emailsFailed: 0,
    sheetsUpdated: 0,
    logs: [],
  };

  try {
    // Step 1: Fetch from USPTO
    result.logs.push("Fetching recent applications from USPTO...");
    await createLog("uspto_fetch", "started", "Fetching applications from USPTO API");

    const applications = await fetchRecentApplications(daysBack, limit);
    result.totalFetched = applications.length;
    result.logs.push(`Found ${applications.length} applications from USPTO`);

    if (applications.length === 0) {
      result.logs.push("No new applications found. Sync complete.");
      await createLog("uspto_fetch", "completed", "No new applications found");
      return result;
    }

    // Step 2: Save to database
    result.logs.push("Saving applications to database...");
    for (const app of applications) {
      const appData = {
        applicationNumber: app.applicationNumber,
        patentTitle: app.patentTitle,
        filingDate: app.filingDate ? new Date(app.filingDate) : undefined,
        publicationDate: app.publicationDate ? new Date(app.publicationDate) : undefined,
        applicantName: app.applicantName,
        applicantAddress: app.applicantAddress,
        applicantEmail: app.applicantEmail || undefined,
        inventorName: app.inventorName,
        attorneyName: app.attorneyName || undefined,
        attorneyEmail: app.attorneyEmail || undefined,
        hasAttorney: app.hasAttorney || false,
        status: app.status,
        patentType: app.patentType,
        abstract: app.abstract,
        usptoApiData: app.raw,
      };

      const saved = await upsertApplication(appData);
      if (saved.isNew) {
        result.newApplications++;
        const attTag = app.hasAttorney ? " [ATTORNEY]" : "";
        result.logs.push(`NEW: ${app.applicationNumber} - ${app.patentTitle || "Untitled"}${attTag}`);
      } else {
        result.existingApplications++;
      }
    }

    await createLog("uspto_fetch", "completed", `Fetched ${applications.length}, New: ${result.newApplications}`);

    // Step 3: Send emails to applicants (SKIP if has attorney)
    result.logs.push("Processing emails...");
    await createLog("email_send", "started", "Sending emails to applicants (skipping attorney cases)");

    const unemailed = await getUnemailedApplications();
    const template = await getDefaultTemplate();

    if (!template) {
      result.logs.push("No default template found. Creating one...");
      const defaultTmpl = getDefaultEmailTemplate();
      const { createEmailTemplate } = await import("@/db/operations");
      await createEmailTemplate({
        name: "Default Welcome Template",
        subject: defaultTmpl.subject,
        body: defaultTmpl.body,
        isDefault: true,
      });
    }

    const finalTemplate = template || getDefaultEmailTemplate();

    for (const app of unemailed) {
      // ⚠️ SKIP EMAIL if application has an attorney
      if (app.hasAttorney) {
        result.emailsSkippedAttorney++;
        result.logs.push(`⚖️ SKIPPED (Attorney): ${app.applicationNumber} - ${app.attorneyName || "Unknown attorney"}`);
        continue;
      }

      if (!app.applicantEmail) {
        result.logs.push(`Skipping ${app.applicationNumber} - no email address`);
        continue;
      }

      try {
        const usptoApp = {
          applicationNumber: app.applicationNumber,
          patentTitle: app.patentTitle || "",
          filingDate: app.filingDate?.toISOString().split("T")[0] || "",
          publicationDate: app.publicationDate?.toISOString().split("T")[0] || "",
          applicantName: app.applicantName || "",
          applicantAddress: app.applicantAddress || "",
          applicantEmail: app.applicantEmail || "",
          inventorName: app.inventorName || "",
          attorneyName: app.attorneyName || "",
          attorneyEmail: app.attorneyEmail || "",
          hasAttorney: app.hasAttorney || false,
          status: app.status || "",
          patentType: app.patentType || "",
          abstract: app.abstract || "",
          raw: app.usptoApiData as Record<string, unknown> || {},
        };

        const emailResult = await sendEmailWithTemplate(usptoApp, finalTemplate, template?.id);

        if (emailResult.success) {
          result.emailsSent++;
          result.logs.push(`✅ Email sent: ${app.applicationNumber} -> ${app.applicantEmail}`);
        } else {
          result.emailsFailed++;
          result.logs.push(`❌ Email failed: ${app.applicationNumber} - ${emailResult.error}`);
        }
      } catch (error) {
        result.emailsFailed++;
        result.logs.push(`❌ Email error: ${app.applicationNumber} - ${error}`);
      }
    }

    await createLog("email_send", "completed", `Sent: ${result.emailsSent}, Skipped (Attorney): ${result.emailsSkippedAttorney}, Failed: ${result.emailsFailed}`);

    // Step 4: Sync ALL applications to Google Sheets (including attorney ones)
    result.logs.push("Syncing ALL applications to Google Sheets...");
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
            patentType: app.patentType || "",
            abstract: app.abstract || "",
            emailSent: isAttorney ? "Skipped (Attorney)" : (app.emailSent ? "Yes" : "No"),
            emailSentAt: app.emailSentAt ? app.emailSentAt.toLocaleString() : "",
            replyReceived: "No",
            lastUpdated: new Date().toLocaleString(),
          };

          const rowNumber = await appendToSheet(sheetRow);
          result.sheetsUpdated++;
          result.logs.push(`📑 Sheet updated: ${app.applicationNumber} -> Row ${rowNumber}${isAttorney ? " [ATTORNEY]" : ""}`);
        } catch (error) {
          result.logs.push(`❌ Sheet sync failed: ${app.applicationNumber} - ${error}`);
        }
      }
      await createLog("google_sheets", "completed", `Updated ${result.sheetsUpdated} rows`);
    } else {
      result.logs.push("Google Sheets not configured or inactive. Skipping sheet sync.");
    }

    result.logs.push("✅ Sync complete!");
    await createLog("sync", "completed", JSON.stringify(result));

    return result;
  } catch (error) {
    result.logs.push(`Sync error: ${error}`);
    await createLog("sync", "error", String(error));
    return result;
  }
}
