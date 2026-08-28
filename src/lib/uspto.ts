// USPTO Open Data Portal API Service
// Free API - no API key required for basic queries
// Docs: https://developer.uspto.gov/ds-api

const USPTO_API_BASE = "https://developer.uspto.gov/ds-api";
const USPTO_PEDS_API = "https://ped.uspto.gov/api/queries";

export interface USPTOApplication {
  applicationNumber: string;
  patentTitle?: string;
  filingDate?: string;
  publicationDate?: string;
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
  raw: Record<string, unknown>;
}

/**
 * Fetch recently published patent applications from USPTO
 * Uses the USPTO Open Data Portal API (free, no key required)
 */
export async function fetchRecentApplications(daysBack = 7, limit = 50): Promise<USPTOApplication[]> {
  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Method 1: USPTO Data Set API - Patent Publications
    const response = await fetch(`${USPTO_API_BASE}/patent/v1/applications/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        criteria: `publicationDate:[${startDateStr} TO ${endDateStr}]`,
        start: 0,
        rows: limit,
      }),
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.response?.docs) {
        return data.response.docs.map(parseUSPTODoc);
      }
    }

    // Method 2: Try PEDS API as fallback
    return await fetchFromPEDS(daysBack, limit);
  } catch (error) {
    console.error("USPTO API fetch error:", error);
    return [];
  }
}

/**
 * Fetch from PEDS (Patent Examination Data System) API
 */
async function fetchFromPEDS(daysBack: number, limit: number): Promise<USPTOApplication[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const response = await fetch(USPTO_PEDS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dataset: "patent",
        version: "1.0",
        criteria: {
          filingDate: {
            $gte: startDate.toISOString().split("T")[0],
            $lte: endDate.toISOString().split("T")[0],
          },
        },
        fields: [
          "applicationNumber",
          "patentTitle",
          "filingDate",
          "publicationDate",
          "applicantName",
          "inventorName",
          "status",
          "patentType",
          "abstract",
        ],
        start: 0,
        rows: limit,
      }),
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.results) {
        return data.results.map((doc: Record<string, unknown>) => parseUSPTODoc(doc));
      }
    }

    return [];
  } catch (error) {
    console.error("PEDS API error:", error);
    return [];
  }
}

/**
 * Search USPTO applications by applicant name or keyword
 */
export async function searchUSPTOApplications(query: string, limit = 20): Promise<USPTOApplication[]> {
  try {
    const response = await fetch(`${USPTO_API_BASE}/patent/v1/applications/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        criteria: `(applicantName:"${query}" OR patentTitle:"${query}")`,
        start: 0,
        rows: limit,
      }),
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.response?.docs) {
        return data.response.docs.map(parseUSPTODoc);
      }
    }

    return [];
  } catch (error) {
    console.error("USPTO search error:", error);
    return [];
  }
}

/**
 * Parse USPTO API response into standardized format
 */
function parseUSPTODoc(doc: Record<string, unknown>): USPTOApplication {
  // Extract attorney info from various possible field names
  const attorneyName = String(doc.attorneyName || doc.attorney_name || doc.agentName || doc.agent_name ||
    doc.attorneyAgentName || doc.attorney_agent_name || doc.primary_examiner || "");
  const attorneyEmail = String(doc.attorneyEmail || doc.attorney_email || doc.agentEmail || "");
  const hasAttorney = !!attorneyName && attorneyName !== "" && attorneyName !== "null";

  return {
    applicationNumber: String(doc.applicationNumber || doc.application_number || doc.applId || ""),
    patentTitle: String(doc.patentTitle || doc.title || doc.inventionTitle || ""),
    filingDate: String(doc.filingDate || doc.filing_date || ""),
    publicationDate: String(doc.publicationDate || doc.publication_date || doc.pubDate || ""),
    applicantName: String(doc.applicantName || doc.applicant_name || doc.assigneeName || ""),
    applicantAddress: String(doc.applicantAddress || doc.applicant_address || ""),
    applicantEmail: String(doc.applicantEmail || doc.applicant_email || doc.email || ""),
    inventorName: String(doc.inventorName || doc.inventor_name || doc.inventors || ""),
    attorneyName: attorneyName || undefined,
    attorneyEmail: attorneyEmail || undefined,
    hasAttorney,
    status: String(doc.status || doc.applicationStatus || doc.patentStatus || ""),
    patentType: String(doc.patentType || doc.type || doc.kind || ""),
    abstract: String(doc.abstract || doc.abstractText || ""),
    raw: doc,
  };
}

/**
 * Fetch a single application by number
 */
export async function fetchApplicationByNumber(applicationNumber: string): Promise<USPTOApplication | null> {
  try {
    const response = await fetch(`${USPTO_API_BASE}/patent/v1/applications/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        criteria: `applicationNumber:"${applicationNumber}"`,
        start: 0,
        rows: 1,
      }),
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.response?.docs?.length > 0) {
        return parseUSPTODoc(data.response.docs[0]);
      }
    }

    return null;
  } catch (error) {
    console.error("USPTO fetch by number error:", error);
    return null;
  }
}

/**
 * Get USPTO API info and status
 */
export async function getUSPTOAPIStatus(): Promise<{ status: string; message: string }> {
  try {
    const response = await fetch(`${USPTO_API_BASE}/patent/v1/applications/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria: "", start: 0, rows: 1 }),
      cache: "no-store",
    });

    if (response.ok) {
      return { status: "online", message: "USPTO API is accessible" };
    }
    return { status: "error", message: `HTTP ${response.status}: ${response.statusText}` };
  } catch (error) {
    return { status: "offline", message: `Connection failed: ${error}` };
  }
}
