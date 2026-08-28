"use client";

import { useState, useEffect } from "react";

// Types
interface Application {
  id: number;
  applicationNumber: string;
  patentTitle: string | null;
  filingDate: Date | null;
  publicationDate: Date | null;
  applicantName: string | null;
  applicantAddress: string | null;
  applicantEmail: string | null;
  inventorName: string | null;
  attorneyName: string | null;
  attorneyEmail: string | null;
  hasAttorney: boolean | null;
  status: string | null;
  patentType: string | null;
  abstract: string | null;
  emailSent: boolean | null;
  emailSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SystemStatus {
  uspto?: { status?: string; message?: string };
  googleSheets?: { success?: boolean; message?: string };
  resend?: string;
  lastSync?: string;
}

interface Log {
  id: number;
  action: string;
  status: string;
  message: string | null;
  createdAt: Date;
}

type Tab = "dashboard" | "applications" | "templates" | "emails" | "sheets" | "logs";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDays, setSyncDays] = useState(3);
  const [syncLimit, setSyncLimit] = useState(50);

  // Load initial data
  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [appsRes, statusRes] = await Promise.all([
        fetch("/api/applications?limit=20"),
        fetch("/api/logs?action=status"),
      ]);
      const appsData = await appsRes.json();
      const statusData = await statusRes.json();

      if (appsData.success) setApplications(appsData.applications || []);
      if (statusData.success) setStatus(statusData.status);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    }
  }

  async function handleSync() {
    setLoading(true);
    setShowSyncModal(false);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysBack: syncDays, limit: syncLimit }),
      });
      const data = await res.json();
      setSyncResult(data.result);
      loadDashboard();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a73e8] to-[#0d47a1] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📋</div>
              <div>
                <h1 className="text-xl font-bold">USPTO Monitor</h1>
                <p className="text-xs text-blue-100">Patent Application Tracking System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusDot label="USPTO" status={status?.uspto?.status as string} />
              <StatusDot label="Sheets" status={status?.googleSheets?.success ? "online" : "offline"} />
              <StatusDot label="Email" status={status?.resend === "configured" ? "online" : "offline"} />
              <button
                onClick={() => setShowSyncModal(true)}
                disabled={loading}
                className="bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  "🔄"
                )}
                {loading ? "Syncing..." : "Run Sync"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-sm border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {([
              { id: "dashboard" as Tab, icon: "📊", label: "Dashboard" },
              { id: "applications" as Tab, icon: "📄", label: "Applications" },
              { id: "templates" as Tab, icon: "📝", label: "Templates" },
              { id: "emails" as Tab, icon: "✉️", label: "Emails" },
              { id: "sheets" as Tab, icon: "📑", label: "Google Sheets" },
              { id: "logs" as Tab, icon: "📋", label: "Logs" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#1a73e8] text-[#1a73e8]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "dashboard" && (
          <DashboardTab
            applications={applications}
            status={status}
            syncResult={syncResult}
          />
        )}
        {activeTab === "applications" && (
          <ApplicationsTab applications={applications} />
        )}
        {activeTab === "templates" && (
          <TemplatesTab templates={templates} setTemplates={setTemplates} />
        )}
        {activeTab === "emails" && (
          <EmailsTab />
        )}
        {activeTab === "sheets" && (
          <SheetsTab />
        )}
        {activeTab === "logs" && (
          <LogsTab logs={logs} setLogs={setLogs} />
        )}
      </main>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">🔄 Sync USPTO Data</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Days Back
                </label>
                <input
                  type="number"
                  value={syncDays}
                  onChange={(e) => setSyncDays(parseInt(e.target.value))}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                  min={1}
                  max={30}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Max Results
                </label>
                <input
                  type="number"
                  value={syncLimit}
                  onChange={(e) => setSyncLimit(parseInt(e.target.value))}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                  min={1}
                  max={200}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="flex-1 border border-[var(--border)] text-[var(--text-secondary)] px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSync}
                  className="flex-1 bg-[#1a73e8] text-white px-4 py-2 rounded-lg hover:bg-[#1557b0] transition-colors font-medium"
                >
                  Start Sync
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Status dot component
function StatusDot({ label, status }: { label: string; status?: string }) {
  const isOnline = status === "online" || status === "configured";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}`}></span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

// Dashboard Tab
function DashboardTab({ applications, status, syncResult }: {
  applications: Application[];
  status: SystemStatus | null;
  syncResult: Record<string, unknown> | null;
}) {
  const stats = {
    total: applications.length,
    emailed: applications.filter((a) => a.emailSent).length,
    pending: applications.filter((a) => !a.emailSent && !a.hasAttorney).length,
    attorney: applications.filter((a) => a.hasAttorney).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Applications" value={stats.total} icon="📄" color="blue" />
        <StatCard title="Emails Sent" value={stats.emailed} icon="✅" color="green" />
        <StatCard title="⚖️ With Attorney" value={stats.attorney} icon="⚖️" color="orange" />
        <StatCard title="Pending Emails" value={stats.pending} icon="⏳" color="yellow" />
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
          <h3 className="font-semibold mb-4">📊 Last Sync Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{String(syncResult.totalFetched)}</p>
              <p className="text-sm text-blue-600/70">Fetched</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{String(syncResult.newApplications)}</p>
              <p className="text-sm text-green-600/70">New Apps</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{String(syncResult.emailsSent)}</p>
              <p className="text-sm text-purple-600/70">Emails Sent</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{String(syncResult.emailsSkippedAttorney ?? 0)}</p>
              <p className="text-sm text-orange-600/70">⚖️ Attorney Skip</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{String(syncResult.sheetsUpdated)}</p>
              <p className="text-sm text-orange-600/70">Sheets Updated</p>
            </div>
          </div>
          {syncResult && (syncResult.logs as string[] | undefined) && Array.isArray(syncResult.logs) && (
            <div className="mt-4 bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
              {(syncResult.logs as string[]).map((log: string, i: number) => (
                <p key={i} className="text-xs font-mono text-gray-600 py-0.5">▸ {log}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
        <h3 className="font-semibold mb-4">🔗 System Status</h3>
        <div className="space-y-3">
          <StatusRow
            label="USPTO API"
            status={(status?.uspto as { status?: string })?.status || "unknown"}
            message={(status?.uspto as { message?: string })?.message || ""}
          />
          <StatusRow
            label="Google Sheets"
            status={(status?.googleSheets as { success?: boolean })?.success ? "online" : "offline"}
            message={(status?.googleSheets as { message?: string })?.message || ""}
          />
          <StatusRow
            label="Resend Email"
            status={(status?.resend as string) || "unknown"}
            message={(status?.resend as string) === "configured" ? "API key configured" : "Not configured"}
          />
        </div>
      </div>

      {/* Recent Applications */}
      <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
        <h3 className="font-semibold mb-4">📋 Recent Applications</h3>
        {applications.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-8">
            No applications yet. Run a sync to fetch data from USPTO.
          </p>
        ) : (
          <div className="space-y-2">
            {applications.slice(0, 5).map((app) => (
              <div key={app.id} className={`flex items-center justify-between p-3 rounded-lg ${app.hasAttorney ? "bg-orange-50" : "bg-gray-50"}`}>
                <div>
                  <p className="font-medium text-sm">{app.applicationNumber}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{app.patentTitle || "Untitled"}</p>
                  {app.hasAttorney && app.attorneyName && (
                    <p className="text-xs text-orange-600 mt-0.5">⚖️ {app.attorneyName}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  app.hasAttorney ? "bg-orange-100 text-orange-700" :
                  app.emailSent ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {app.hasAttorney ? "⚖️ No Email" : app.emailSent ? "Emailed" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    orange: "bg-orange-50 border-orange-200",
    purple: "bg-purple-50 border-purple-200",
  };
  const textColors: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-green-600",
    yellow: "text-yellow-600",
    orange: "text-orange-600",
    purple: "text-purple-600",
  };

  return (
    <div className={`rounded-xl border p-5 ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${textColors[color] || textColors.blue}`}>{value}</p>
      <p className={`text-sm ${textColors[color] || textColors.blue} opacity-70`}>{title}</p>
    </div>
  );
}

function StatusRow({ label, status, message }: { label: string; status: string; message: string }) {
  const isOnline = status === "online" || status === "configured";
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full ${isOnline ? "bg-green-500" : "bg-red-400"}`}></span>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-xs text-[var(--text-secondary)]">{message}</span>
    </div>
  );
}

// Applications Tab
function ApplicationsTab({ applications }: { applications: Application[] }) {
  const attorneyCount = applications.filter((a) => a.hasAttorney).length;
  const noAttorneyCount = applications.filter((a) => !a.hasAttorney).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filter Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-4">
          <p className="text-2xl font-bold text-blue-600">{applications.length}</p>
          <p className="text-sm text-[var(--text-secondary)]">Total Applications</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-4">
          <p className="text-2xl font-bold text-green-600">{attorneyCount}</p>
          <p className="text-sm text-[var(--text-secondary)]">⚖️ With Attorney (Email Skipped)</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-4">
          <p className="text-2xl font-bold text-purple-600">{noAttorneyCount}</p>
          <p className="text-sm text-[var(--text-secondary)]">📧 Direct Applicants (Email Eligible)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[var(--border)]">
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">📄 All Applications</h2>
          <p className="text-sm text-[var(--text-secondary)]">⚖️ = Has Attorney (No Email) | 📧 = Direct (Email Sent/Pending)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-[var(--border)]">
              <tr>
                <th className="text-left px-3 py-3 font-medium text-xs">App #</th>
                <th className="text-left px-3 py-3 font-medium text-xs">Title</th>
                <th className="text-left px-3 py-3 font-medium text-xs">Applicant</th>
                <th className="text-left px-3 py-3 font-medium text-xs">Attorney</th>
                <th className="text-left px-3 py-3 font-medium text-xs">Filing Date</th>
                <th className="text-left px-3 py-3 font-medium text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--text-secondary)]">
                    No applications found. Run a sync to fetch data.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className={`border-b border-[var(--border)] hover:bg-gray-50 ${app.hasAttorney ? "bg-orange-50/50" : ""}`}>
                    <td className="px-3 py-3 font-mono text-xs">{app.applicationNumber}</td>
                    <td className="px-3 py-3 max-w-xs truncate">{app.patentTitle || "-"}</td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-medium">{app.applicantName || "-"}</p>
                        {app.applicantEmail && (
                          <p className="text-xs text-[var(--text-secondary)]">{app.applicantEmail}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {app.hasAttorney ? (
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">⚖️ {app.attorneyName || "Yes"}</span>
                          {app.attorneyEmail && (
                            <p className="text-xs text-[var(--text-secondary)] mt-1">{app.attorneyEmail}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{app.filingDate ? new Date(app.filingDate).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-3">
                      {app.hasAttorney ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">⚖️ No Email</span>
                      ) : app.emailSent ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">📧 Sent</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">⏳ Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Templates Tab
function TemplatesTab({ templates, setTemplates }: { templates: Template[]; setTemplates: (t: Template[]) => void }) {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    isDefault: false,
  });

  async function loadTemplates() {
    const res = await fetch("/api/templates");
    const data = await res.json();
    if (data.success) {
      setTemplates(data.templates);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingTemplate ? `/api/templates/${editingTemplate.id}` : "/api/templates";
    const method = editingTemplate ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setShowForm(false);
      setEditingTemplate(null);
      setFormData({ name: "", subject: "", body: "", isDefault: false });
      loadTemplates();
    }
  }

  function startEdit(template: Template) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      isDefault: template.isDefault || false,
    });
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    loadTemplates();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">📝 Email Templates</h2>
          <p className="text-sm text-[var(--text-secondary)]">Create and manage email templates</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingTemplate(null); setFormData({ name: "", subject: "", body: "", isDefault: false }); }}
          className="bg-[#1a73e8] text-white px-4 py-2 rounded-lg hover:bg-[#1557b0] transition-colors text-sm font-medium"
        >
          + New Template
        </button>
      </div>

      {/* Template Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6 animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                  placeholder="e.g., Welcome Email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject Line</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                  placeholder="Your Application {{applicationNumber}}"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Email Body (HTML)
                <span className="text-[var(--text-secondary)] font-normal ml-2">
                  Variables: {`{{applicationNumber}}`} {`{{patentTitle}}`} {`{{applicantName}}`} {`{{filingDate}}`} {`{{publicationDate}}`} {`{{inventorName}}`} {`{{status}}`} {`{{patentType}}`} {`{{abstract}}`}
                </span>
              </label>
              <div className="flex gap-2 mb-2">
                {["<b>B</b>", "<i>I</i>", "<u>U</u>", "<h2>H2</h2>", "<p>P</p>", "<ul>List</ul>", "<table>Table</table>"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById("template-body") as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        textarea.value = text.slice(0, start) + tag + text.slice(end);
                        setFormData({ ...formData, body: textarea.value });
                      }
                    }}
                    className="px-2 py-1 text-xs border border-[var(--border)] rounded hover:bg-gray-100"
                    dangerouslySetInnerHTML={{ __html: tag }}
                  />
                ))}
              </div>
              <textarea
                id="template-body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8] font-mono text-sm"
                rows={12}
                placeholder="<div style='font-family: Arial, sans-serif;'>...</div>"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="rounded border-[var(--border)]"
              />
              <label htmlFor="isDefault" className="text-sm">Set as default template</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingTemplate(null); }}
                className="border border-[var(--border)] px-4 py-2 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#1a73e8] text-white px-6 py-2 rounded-lg hover:bg-[#1557b0] transition-colors text-sm font-medium"
              >
                {editingTemplate ? "Update Template" : "Create Template"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-3">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.isDefault && (
                    <span className="bg-[#1a73e8] text-white text-xs px-2 py-0.5 rounded-full">Default</span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-2">Subject: {template.subject}</p>
                <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <div className="text-xs font-mono text-gray-600 whitespace-pre-wrap">{template.body.slice(0, 300)}...</div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => startEdit(template)}
                  className="text-[#1a73e8] hover:bg-blue-50 px-3 py-1 rounded text-sm"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-sm"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {templates.length === 0 && !showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-12 text-center">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-[var(--text-secondary)]">No templates created yet.</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Create your first email template to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Emails Tab
function EmailsTab() {
  const [emails, setEmails] = useState<Array<Record<string, unknown>>>([]);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  async function loadEmails() {
    const res = await fetch("/api/emails/sent");
    const data = await res.json();
    if (data.success) setEmails(data.emails);
  }

  useEffect(() => {
    loadEmails();
  }, []);

  async function sendTest() {
    setTestResult(null);
    const res = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", to: testEmail }),
    });
    const data = await res.json();
    setTestResult(data.success ? "✅ Test email sent successfully!" : `❌ ${data.error}`);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Send Test Email */}
      <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
        <h3 className="font-semibold mb-4">✉️ Send Test Email</h3>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
          />
          <button
            onClick={sendTest}
            disabled={!testEmail}
            className="bg-[#1a73e8] text-white px-6 py-2 rounded-lg hover:bg-[#1557b0] disabled:opacity-50 transition-colors text-sm font-medium"
          >
            Send Test
          </button>
        </div>
        {testResult && (
          <p className={`mt-3 text-sm ${testResult.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
            {testResult}
          </p>
        )}
      </div>

      {/* Sent Emails List */}
      <div className="bg-white rounded-xl shadow-sm border border-[var(--border)]">
        <div className="p-6 border-b border-[var(--border)]">
          <h3 className="font-semibold">📤 Sent Emails</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {emails.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-secondary)]">
              No emails sent yet. Run a sync or send a test email.
            </div>
          ) : (
            emails.map((email: Record<string, unknown>) => (
              <div key={email.id as string} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{email.subject as string}</p>
                    <p className="text-xs text-[var(--text-secondary)]">To: {email.to as string}</p>
                    {Boolean(email.replyReceived) && (
                      <p className="text-xs text-green-600 mt-1">✅ Reply received</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      email.status === "replied" ? "bg-green-100 text-green-700" :
                      email.status === "sent" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {email.status as string}
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {email.createdAt ? new Date(email.createdAt as string).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Google Sheets Tab
function SheetsTab() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [connection, setConnection] = useState<Record<string, unknown> | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [serviceAccountKey, setServiceAccountKey] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadConfig() {
    const res = await fetch("/api/google-sheets");
    const data = await res.json();
    if (data.success) {
      setConfig(data.config);
      setConnection(data.connection);
      if (data.config) {
        setSpreadsheetId(data.config.spreadsheetId || "");
        setSheetName(data.config.sheetName || "Sheet1");
        setIsActive(data.config.isActive || false);
      }
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  async function handleSave() {
    setLoading(true);
    const res = await fetch("/api/google-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spreadsheetId,
        sheetName,
        serviceAccountKey: serviceAccountKey || undefined,
        isActive,
      }),
    });
    const data = await res.json();
    if (data.success) {
      loadConfig();
    }
    setLoading(false);
  }

  async function handleTest() {
    setLoading(true);
    const res = await fetch("/api/google-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", spreadsheetId }),
    });
    const data = await res.json();
    setConnection(data);
    setLoading(false);
  }

  async function handleInit() {
    setLoading(true);
    const res = await fetch("/api/google-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "init", sheetName }),
    });
    const data = await res.json();
    if (data.success) {
      alert("✅ Sheet initialized with headers!");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-800 mb-2">📑 Google Sheets Integration Setup</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Go to <a href="https://console.cloud.google.com" target="_blank" className="underline">Google Cloud Console</a></li>
          <li>Create a Service Account and download the JSON key</li>
          <li>Create a Google Sheet and share it with the service account email</li>
          <li>Paste the JSON key content below</li>
          <li>Enter the Spreadsheet ID (from the sheet URL)</li>
        </ol>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
        <h3 className="font-semibold mb-4">⚙️ Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Spreadsheet ID</label>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8] font-mono text-sm"
              placeholder="1abc123xyz..."
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Found in sheet URL: docs.google.com/spreadsheets/d/<strong>[THIS_PART]</strong>/edit
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sheet Name</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              placeholder="Sheet1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Service Account Key (JSON)</label>
            <textarea
              value={serviceAccountKey}
              onChange={(e) => setServiceAccountKey(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a73e8] font-mono text-xs"
              rows={6}
              placeholder='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            <label htmlFor="isActive" className="text-sm font-medium">Enable Google Sheets sync</label>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={loading || !spreadsheetId}
              className="bg-[#1a73e8] text-white px-6 py-2 rounded-lg hover:bg-[#1557b0] disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {loading ? "Saving..." : "💾 Save Config"}
            </button>
            <button
              onClick={handleTest}
              disabled={loading || !spreadsheetId}
              className="border border-[var(--border)] px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
            >
              {loading ? "Testing..." : "🔗 Test Connection"}
            </button>
            <button
              onClick={handleInit}
              disabled={loading || !spreadsheetId}
              className="border border-[var(--border)] px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
            >
              📋 Initialize Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {connection && (
        <div className={`rounded-xl p-4 ${connection.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <p className={`font-medium ${connection.success ? "text-green-700" : "text-red-700"}`}>
            {connection.success ? "✅" : "❌"} {connection.message as string}
          </p>
        </div>
      )}
    </div>
  );
}

// Logs Tab
function LogsTab({ logs, setLogs }: { logs: Log[]; setLogs: (l: Log[]) => void }) {
  async function loadLogs() {
    const res = await fetch("/api/logs");
    const data = await res.json();
    if (data.success) setLogs(data.logs);
  }

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const actionColors: Record<string, string> = {
    uspto_fetch: "bg-blue-100 text-blue-700",
    email_send: "bg-purple-100 text-purple-700",
    google_sheets: "bg-green-100 text-green-700",
    sync: "bg-orange-100 text-orange-700",
    manual_sync: "bg-yellow-100 text-yellow-700",
  };

  const statusColors: Record<string, string> = {
    started: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] animate-fade-in">
      <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
        <div>
          <h3 className="font-semibold">📋 Activity Logs</h3>
          <p className="text-sm text-[var(--text-secondary)]">Real-time system activity</p>
        </div>
        <button onClick={loadLogs} className="text-sm text-[#1a73e8] hover:underline">
          🔄 Refresh
        </button>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-secondary)]">
            No logs yet. Run a sync to see activity.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || "bg-gray-100"}`}>
                    {log.action}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[log.status] || "bg-gray-100"}`}>
                    {log.status}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {log.message && (
                <p className="text-sm text-[var(--text-secondary)] mt-1 font-mono">{log.message}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
