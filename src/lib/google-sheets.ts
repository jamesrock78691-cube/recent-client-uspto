import { google } from "googleapis";
import { getGoogleConfig } from "@/db/operations";

// Google Sheets column headers
export const SHEET_HEADERS = [
  "Application Number",
  "Patent Title",
  "Filing Date",
  "Publication Date",
  "Applicant Name",
  "Applicant Address",
  "Applicant Email",
  "Inventor Name",
  "Attorney Name",
  "Attorney Email",
  "Has Attorney",
  "Status",
  "Patent Type",
  "Abstract",
  "Email Sent",
  "Email Sent At",
  "Reply Received",
  "Last Updated",
];

export interface SheetRow {
  applicationNumber: string;
  patentTitle: string;
  filingDate: string;
  publicationDate: string;
  applicantName: string;
  applicantAddress: string;
  applicantEmail: string;
  inventorName: string;
  attorneyName: string;
  attorneyEmail: string;
  hasAttorney: string;
  status: string;
  patentType: string;
  abstract: string;
  emailSent: string;
  emailSentAt: string;
  replyReceived: string;
  lastUpdated: string;
}

/**
 * Get authenticated Google Sheets API instance
 */
async function getSheetsInstance() {
  const config = await getGoogleConfig();
  if (!config || !config.serviceAccountKey) {
    throw new Error("Google Sheets not configured. Add service account key in settings.");
  }

  const credentials = JSON.parse(config.serviceAccountKey);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

/**
 * Initialize spreadsheet with headers
 */
export async function initializeSheet(spreadsheetId: string, sheetName = "Sheet1") {
  const sheets = await getSheetsInstance();

  // Try to find the sheet
  try {
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = response.data.sheets?.find((s) => s.properties?.title === sheetName);

    if (!sheet) {
      // Create new sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: sheetName },
              },
            },
          ],
        },
      });
    }
  } catch {
    throw new Error("Could not access spreadsheet. Check permissions.");
  }

  // Write headers (A:R = 18 columns)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:R1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [SHEET_HEADERS],
    },
  });
}

/**
 * Append application data to Google Sheet
 * Returns the row number where data was added
 */
export async function appendToSheet(data: SheetRow): Promise<number> {
  const config = await getGoogleConfig();
  if (!config) throw new Error("Google Sheets not configured");

  const spreadsheetId = config.spreadsheetId;
  const sheetName = config.sheetName || "Sheet1";

  const sheets = await getSheetsInstance();

  // Initialize if needed - check if headers exist
  try {
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:R1`,
    });
    if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
      await initializeSheet(spreadsheetId, sheetName);
    }
  } catch {
    await initializeSheet(spreadsheetId, sheetName);
  }

  const values = [
    [
      data.applicationNumber,
      data.patentTitle,
      data.filingDate,
      data.publicationDate,
      data.applicantName,
      data.applicantAddress,
      data.applicantEmail,
      data.inventorName,
      data.attorneyName,
      data.attorneyEmail,
      data.hasAttorney,
      data.status,
      data.patentType,
      data.abstract,
      data.emailSent,
      data.emailSentAt,
      data.replyReceived,
      data.lastUpdated,
    ],
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:R`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  // Return the row number (updates.startRow + 1 for 1-indexed)
  const updates = response.data.updates;
  return updates?.updatedRange ? parseInt(updates.updatedRange.split("!")[1]?.replace(/[A-Z]/g, "") || "0") : 0;
}

/**
 * Bulk append multiple rows
 */
export async function bulkAppendToSheet(rows: SheetRow[]): Promise<number> {
  const config = await getGoogleConfig();
  if (!config) throw new Error("Google Sheets not configured");

  const spreadsheetId = config.spreadsheetId;
  const sheetName = config.sheetName || "Sheet1";
  const sheets = await getSheetsInstance();

  const values = rows.map((r) => [
    r.applicationNumber,
    r.patentTitle,
    r.filingDate,
    r.publicationDate,
    r.applicantName,
    r.applicantAddress,
    r.applicantEmail,
    r.inventorName,
    r.attorneyName,
    r.attorneyEmail,
    r.hasAttorney,
    r.status,
    r.patentType,
    r.abstract,
    r.emailSent,
    r.emailSentAt,
    r.replyReceived,
    r.lastUpdated,
  ]);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:R`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  return response.data.updates?.updatedRows || 0;
}

/**
 * Update a specific row in the sheet
 */
export async function updateSheetRow(rowNumber: number, data: Partial<SheetRow>): Promise<void> {
  const config = await getGoogleConfig();
  if (!config) throw new Error("Google Sheets not configured");

  const spreadsheetId = config.spreadsheetId;
  const sheetName = config.sheetName || "Sheet1";
  const sheets = await getSheetsInstance();

  // Get existing row data (18 columns: A:R)
  const existingResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}:R${rowNumber}`,
  });

  const existingRow = existingResponse.data.values?.[0] || Array(18).fill("");

  // Merge with new data
  const updatedRow = [...existingRow, ...Array(18 - existingRow.length).fill("")];

  if (data.applicantEmail) updatedRow[6] = data.applicantEmail;
  if (data.attorneyName) updatedRow[8] = data.attorneyName;
  if (data.attorneyEmail) updatedRow[9] = data.attorneyEmail;
  if (data.hasAttorney) updatedRow[10] = data.hasAttorney;
  if (data.emailSent) updatedRow[14] = data.emailSent;
  if (data.emailSentAt) updatedRow[15] = data.emailSentAt;
  if (data.replyReceived) updatedRow[16] = data.replyReceived;
  updatedRow[17] = new Date().toLocaleString();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}:R${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [updatedRow] },
  });
}

/**
 * Test Google Sheets connection
 */
export async function testGoogleConnection(spreadsheetId?: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = await getGoogleConfig();
    const id = spreadsheetId || config?.spreadsheetId;
    if (!id) return { success: false, message: "No spreadsheet ID configured" };

    const sheets = await getSheetsInstance();
    const response = await sheets.spreadsheets.get({ spreadsheetId: id });

    const sheetName = response.data.properties?.title || "Unknown";
    return { success: true, message: `Connected to: ${sheetName}` };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}
