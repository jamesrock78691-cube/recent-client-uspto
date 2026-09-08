import { db } from "@/db";
import { eq, desc, gte, isNull } from "drizzle-orm";
import { emailTemplates, usptoApplications, sentEmails, googleSyncConfig, systemSettings, monitoringLogs } from "@/db/schema";

// Email Templates CRUD
export async function getEmailTemplates() {
  return db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
}

export async function getEmailTemplate(id: number) {
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  return template;
}

export async function getDefaultTemplate() {
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.isDefault, true));
  return template;
}

export async function createEmailTemplate(data: { name: string; subject: string; body: string; isDefault?: boolean }) {
  if (data.isDefault) {
    await db.update(emailTemplates).set({ isDefault: false }).where(eq(emailTemplates.isDefault, true));
  }
  const [template] = await db.insert(emailTemplates).values(data).returning();
  return template;
}

export async function updateEmailTemplate(id: number, data: Partial<{ name: string; subject: string; body: string; isDefault: boolean }>) {
  if (data.isDefault) {
    await db.update(emailTemplates).set({ isDefault: false }).where(eq(emailTemplates.isDefault, true));
  }
  const [template] = await db.update(emailTemplates).set({ ...data, updatedAt: new Date() }).where(eq(emailTemplates.id, id)).returning();
  return template;
}

export async function deleteEmailTemplate(id: number) {
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
}

// USPTO Applications
export async function getApplications(limit = 100, offset = 0) {
  return db.select()
    .from(usptoApplications)
    .orderBy(desc(usptoApplications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getApplicationById(id: number) {
  const [app] = await db.select().from(usptoApplications).where(eq(usptoApplications.id, id));
  return app;
}

export async function getApplicationByNumber(number: string) {
  const [app] = await db.select().from(usptoApplications).where(eq(usptoApplications.applicationNumber, number));
  return app;
}

export async function getUnemailedApplications() {
  return db.select()
    .from(usptoApplications)
    .where(eq(usptoApplications.emailSent, false));
}

export async function markApplicationEmailSent(id: number, _reason?: string) {
  const [row] = await db
    .update(usptoApplications)
    .set({ emailSent: true, emailSentAt: new Date(), updatedAt: new Date() })
    .where(eq(usptoApplications.id, id))
    .returning();
  return row;
}

export async function upsertApplication(data: {
  applicationNumber: string;
  patentTitle?: string;
  filingDate?: Date;
  publicationDate?: Date;
  applicantName?: string;
  applicantAddress?: string;
  applicantEmail?: string;
  inventorName?: string;
  attorneyName?: string;
  attorneyEmail?: string;
  hasAttorney?: boolean;
  status?: string;
  patentType?: string;
  abstract?: string;
  usptoApiData?: Record<string, unknown>;
}) {
  const existing = await getApplicationByNumber(data.applicationNumber);
  if (existing) {
    const [updated] = await db
      .update(usptoApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(usptoApplications.applicationNumber, data.applicationNumber))
      .returning();
    return { ...updated, isNew: false };
  }
  const [created] = await db.insert(usptoApplications).values(data).returning();
  return { ...created, isNew: true };
}

// Sent Emails
export async function getSentEmails(limit = 100) {
  return db.select()
    .from(sentEmails)
    .orderBy(desc(sentEmails.createdAt))
    .limit(limit);
}

export async function createSentEmail(data: {
  applicationId?: number;
  templateId?: number;
  to: string;
  subject: string;
  body: string;
  resendId?: string;
}) {
  const [email] = await db.insert(sentEmails).values({
    ...data,
    status: "sent",
  }).returning();
  return email;
}

export async function updateEmailReply(emailId: number, replyContent: string) {
  const [email] = await db
    .update(sentEmails)
    .set({
      replyReceived: true,
      replyContent,
      repliedAt: new Date(),
      status: "replied",
    })
    .where(eq(sentEmails.id, emailId))
    .returning();
  return email;
}

// Google Sync Config
export async function getGoogleConfig() {
  const [config] = await db.select().from(googleSyncConfig).limit(1);
  return config;
}

export async function updateGoogleConfig(data: {
  spreadsheetId: string;
  spreadsheetName?: string;
  sheetName?: string;
  serviceAccountEmail?: string;
  serviceAccountKey?: string;
  isActive?: boolean;
}) {
  const existing = await getGoogleConfig();
  if (existing) {
    const [updated] = await db
      .update(googleSyncConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(googleSyncConfig.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db.insert(googleSyncConfig).values(data).returning();
  return created;
}

// System Settings
export async function getSetting(key: string) {
  const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  return setting?.value;
}

export async function setSetting(key: string, value: string) {
  const existing = await getSetting(key);
  if (existing !== undefined) {
    await db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value });
  }
}

// Monitoring Logs
export async function createLog(action: string, status: string, message?: string, data?: Record<string, unknown>) {
  await db.insert(monitoringLogs).values({ action, status, message, data });
}

export async function getLogs(limit = 50) {
  return db.select().from(monitoringLogs).orderBy(desc(monitoringLogs.createdAt)).limit(limit);
}
