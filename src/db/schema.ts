import { pgTable, serial, text, timestamp, varchar, boolean, jsonb, integer } from "drizzle-orm/pg-core";

// Email Templates
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(), // HTML content
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// USPTO Applications tracked
export const usptoApplications = pgTable("uspto_applications", {
  id: serial("id").primaryKey(),
  applicationNumber: varchar("application_number", { length: 50 }).notNull(),
  patentTitle: text("patent_title"),
  filingDate: timestamp("filing_date"),
  publicationDate: timestamp("publication_date"),
  applicantName: text("applicant_name"),
  applicantAddress: text("applicant_address"),
  applicantEmail: varchar("applicant_email", { length: 500 }),
  inventorName: text("inventor_name"),
  attorneyName: text("attorney_name"),
  attorneyEmail: varchar("attorney_email", { length: 500 }),
  hasAttorney: boolean("has_attorney").default(false),
  status: varchar("status", { length: 100 }),
  patentType: varchar("patent_type", { length: 50 }),
  abstract: text("abstract"),
  usptoApiData: jsonb("uspto_api_data"),
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  googleSheetRow: integer("google_sheet_row"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sent Emails
export const sentEmails = pgTable("sent_emails", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").references(() => usptoApplications.id),
  templateId: integer("template_id").references(() => emailTemplates.id),
  to: varchar("to", { length: 500 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  resendId: varchar("resend_id", { length: 255 }),
  replyReceived: boolean("reply_received").default(false),
  replyContent: text("reply_content"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Google Sheets Config
export const googleSyncConfig = pgTable("google_sync_config", {
  id: serial("id").primaryKey(),
  spreadsheetId: varchar("spreadsheet_id", { length: 255}).notNull(),
  spreadsheetName: varchar("spreadsheet_name", { length: 255 }),
  sheetName: varchar("sheet_name", { length: 255 }).default("Sheet1"),
  serviceAccountEmail: varchar("service_account_email", { length: 500 }),
  serviceAccountKey: text("service_account_key"),
  lastSyncAt: timestamp("last_sync_at"),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// System Settings
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Monitoring Logs
export const monitoringLogs = pgTable("monitoring_logs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  message: text("message"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
