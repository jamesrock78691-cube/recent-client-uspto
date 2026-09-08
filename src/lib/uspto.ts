// USPTO Trademark Daily XML (TRTDXFAP) + optional TSDR enrichment
// Patents are NOT used. Primary source: official daily application bulk files.
//
// Download API (needs ODP key as x-api-key):
//   GET https://api.uspto.gov/api/v1/datasets/products/files/TRTDXFAP/apcYYMMDD.zip
// Docs: https://data.uspto.gov/apis/bulk-data/download
// Product page: https://data.uspto.gov/bulkdata/datasets/TRTDXFAP
//
// Optional TSDR key (USPTO-API-KEY) only for single-serial enrichment.

import { gunzipSync, inflateRawSync } from "zlib";

const ODP_FILE_BASE = "https://api.uspto.gov/api/v1/datasets/products/files/TRTDXFAP";
const TSDR_BASE = "https://tsdrapi.uspto.gov/ts/cd/casestatus";

export interface USPTOTrademark {
  serialNumber: string;
  markText?: string;
  filingDate?: string;
  registrationDate?: string;
  status?: string;
  statusDate?: string;
  ownerName?: string;
  ownerAddress?: string;
  ownerEmail?: string;
  correspondentName?: string;
  correspondentEmail?: string;
  attorneyName?: string;
  attorneyEmail?: string;
  hasAttorney: boolean;
  goodsAndServices?: string;
  markType?: string;
  internationalClasses?: string;
  raw: Record<string, unknown>;
}

export type USPTOApplication = USPTOTrademark & {
  applicationNumber: string;
  patentTitle?: string;
  publicationDate?: string;
  applicantName?: string;
  applicantAddress?: string;
  applicantEmail?: string;
  inventorName?: string;
  patentType?: string;
  abstract?: string;
};

function odpKey(): string | undefined {
  return (
    process.env.USPTO_ODP_API_KEY ||
    process.env.USPTO_API_KEY ||
    process.env.USPTO_TSDR_API_KEY ||
    undefined
  );
}

function tsdrKey(): string | undefined {
  return process.env.USPTO_TSDR_API_KEY || process.env.USPTO_API_KEY || undefined;
}

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function pickEmail(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = asString(c);
    if (s.includes("@") && s.includes(".")) return s.toLowerCase();
  }
  return "";
}

function yymmdd(d: Date): string {
  const y = String(d.getUTCFullYear()).slice(2);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Minimal ZIP reader (stored + deflate) for USPTO daily zips */
function extractZipToText(buf: Buffer): string {
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString("utf8");
  }

  const texts: string[] = [];
  let offset = 0;
  while (offset + 30 < buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const compression = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.slice(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    offset = dataStart + compSize;

    if (!name.toLowerCase().endsWith(".xml") && !name.toLowerCase().endsWith(".txt")) {
      continue;
    }

    let content: Buffer;
    if (compression === 0) {
      content = data;
    } else if (compression === 8) {
      content = inflateRawSync(data);
    } else {
      continue;
    }
    texts.push(content.toString("utf8"));
  }

  if (texts.length === 0) {
    throw new Error("ZIP contained no XML files (or unsupported compression)");
  }
  return texts.join("\n");
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
}

function allTags(block: string, name: string): string[] {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    out.push(m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim());
  }
  return out;
}

function parseCaseFile(block: string): USPTOTrademark | null {
  const serialNumber = tag(block, "serial-number").replace(/\D/g, "");
  if (!serialNumber) return null;

  const filingDateRaw = tag(block, "filing-date");
  let filingDate = filingDateRaw;
  if (/^\d{8}$/.test(filingDateRaw)) {
    filingDate = `${filingDateRaw.slice(0, 4)}-${filingDateRaw.slice(4, 6)}-${filingDateRaw.slice(6, 8)}`;
  }

  const markText =
    tag(block, "mark-identification") ||
    tag(block, "word-mark") ||
    tag(block, "mark-drawing-code") ||
    undefined;

  const status = tag(block, "status-code") || tag(block, "status") || undefined;

  const ownerBlocks = block.match(/<case-file-owner[\s\S]*?<\/case-file-owner>/gi) || [];
  const ownerNames: string[] = [];
  const ownerEmails: string[] = [];
  let ownerAddress = "";
  for (const ob of ownerBlocks) {
    const n =
      tag(ob, "party-name") ||
      tag(ob, "name") ||
      [tag(ob, "entity-name"), tag(ob, "first-name"), tag(ob, "last-name")].filter(Boolean).join(" ");
    if (n) ownerNames.push(n);
    const em = pickEmail(tag(ob, "email"), tag(ob, "e-mail"));
    if (em) ownerEmails.push(em);
    if (!ownerAddress) {
      ownerAddress = [tag(ob, "address-1"), tag(ob, "city"), tag(ob, "state"), tag(ob, "postcode")]
        .filter(Boolean)
        .join(", ");
    }
  }

  const attorneyBlocks =
    block.match(/<attorney[\s\S]*?<\/attorney>/gi) ||
    block.match(/<case-file-attorney[\s\S]*?<\/case-file-attorney>/gi) ||
    [];
  const attorneyNames: string[] = [];
  const attorneyEmails: string[] = [];
  for (const ab of attorneyBlocks) {
    const n =
      tag(ab, "attorney-name") ||
      tag(ab, "party-name") ||
      tag(ab, "name") ||
      [tag(ab, "first-name"), tag(ab, "last-name")].filter(Boolean).join(" ");
    if (n) attorneyNames.push(n);
    const em = pickEmail(tag(ab, "email"), tag(ab, "e-mail"));
    if (em) attorneyEmails.push(em);
  }

  const corrBlock =
    (block.match(/<correspondent[\s\S]*?<\/correspondent>/i) || [])[0] ||
    (block.match(/<domestic-representative[\s\S]*?<\/domestic-representative>/i) || [])[0] ||
    "";
  const correspondentName =
    tag(corrBlock, "party-name") ||
    tag(corrBlock, "address-1") ||
    tag(block, "correspondent-name") ||
    undefined;
  const correspondentEmail = pickEmail(
    tag(corrBlock, "email"),
    tag(corrBlock, "e-mail"),
    tag(block, "correspondent-email")
  );

  const statements = block.match(/<case-file-statement[\s\S]*?<\/case-file-statement>/gi) || [];
  const goodsParts: string[] = [];
  for (const st of statements) {
    const type = tag(st, "type-code") || "";
    if (/^GS/i.test(type) || /goods/i.test(type) || !type) {
      const t = tag(st, "text");
      if (t) goodsParts.push(t);
    }
  }

  const classes = allTags(block, "international-code").join(", ") || undefined;
  const hasAttorney = attorneyNames.length > 0;
  const ownerEmail =
    ownerEmails[0] || (!hasAttorney ? correspondentEmail : "") || undefined;

  return {
    serialNumber,
    markText: markText || undefined,
    filingDate: filingDate || undefined,
    status: status || undefined,
    ownerName: ownerNames[0] || undefined,
    ownerAddress: ownerAddress || undefined,
    ownerEmail,
    correspondentName,
    correspondentEmail: correspondentEmail || undefined,
    attorneyName: attorneyNames[0] || undefined,
    attorneyEmail: attorneyEmails[0] || undefined,
    hasAttorney,
    goodsAndServices: goodsParts.slice(0, 3).join(" | ") || undefined,
    internationalClasses: classes,
    markType: "Trademark",
    raw: { source: "TRTDXFAP", serialNumber },
  };
}

export function parseTrademarkDailyXml(xml: string): USPTOTrademark[] {
  const blocks = xml.match(/<case-file[\s\S]*?<\/case-file>/gi) || [];
  const out: USPTOTrademark[] = [];
  for (const b of blocks) {
    const parsed = parseCaseFile(b);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function toApplicationShape(tm: USPTOTrademark): USPTOApplication {
  const email =
    tm.ownerEmail || (!tm.hasAttorney ? tm.correspondentEmail : undefined) || undefined;
  return {
    ...tm,
    applicationNumber: tm.serialNumber,
    patentTitle: tm.markText,
    publicationDate: tm.registrationDate,
    applicantName: tm.ownerName,
    applicantAddress: tm.ownerAddress,
    applicantEmail: email,
    inventorName: tm.correspondentName,
    patentType: "Trademark",
    abstract: tm.goodsAndServices,
  };
}

export async function downloadDailyApplicationsZip(date: Date): Promise<Buffer | null> {
  const key = odpKey();
  if (!key) {
    console.warn("USPTO_ODP_API_KEY (or USPTO_API_KEY) not set — cannot download TRTDXFAP");
    return null;
  }

  const name = `apc${yymmdd(date)}.zip`;
  const url = `${ODP_FILE_BASE}/${name}`;

  const response = await fetch(url, {
    headers: { "x-api-key": key, Accept: "application/zip,*/*" },
    redirect: "follow",
    cache: "no-store",
  });

  if (response.status === 404) {
    console.warn(`Daily file not found: ${name}`);
    return null;
  }
  if (!response.ok) {
    const t = await response.text().catch(() => "");
    console.error(`ODP download ${name}: HTTP ${response.status}`, t.slice(0, 200));
    return null;
  }

  const ab = await response.arrayBuffer();
  return Buffer.from(ab);
}

/** Official daily XML — correct source for who filed recently (not TSDR UI). */
export async function fetchRecentTrademarks(
  daysBack = 2,
  limit = 200
): Promise<USPTOApplication[]> {
  const collected: USPTOTrademark[] = [];
  const seen = new Set<string>();

  for (let i = 0; i <= daysBack; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);

    try {
      const zipBuf = await downloadDailyApplicationsZip(d);
      if (!zipBuf) continue;

      const xml = extractZipToText(zipBuf);
      const parsed = parseTrademarkDailyXml(xml);
      console.log(`TRTDXFAP apc${yymmdd(d)}.zip → ${parsed.length} case-files`);

      for (const tm of parsed) {
        if (seen.has(tm.serialNumber)) continue;
        seen.add(tm.serialNumber);
        collected.push(tm);
        if (collected.length >= limit) break;
      }
    } catch (err) {
      console.error(`Daily XML day-${i} error:`, err);
    }

    if (collected.length >= limit) break;
  }

  collected.sort((a, b) => (b.filingDate || "").localeCompare(a.filingDate || ""));
  return collected.slice(0, limit).map(toApplicationShape);
}

export async function fetchRecentApplications(
  daysBack = 2,
  limit = 200
): Promise<USPTOApplication[]> {
  return fetchRecentTrademarks(daysBack, limit);
}

export async function fetchTrademarkBySerial(
  serialNumber: string
): Promise<USPTOTrademark | null> {
  const serial = serialNumber.replace(/\D/g, "");
  if (!serial) return null;
  const key = tsdrKey();
  try {
    const response = await fetch(`${TSDR_BASE}/sn${serial}/info.json`, {
      headers: {
        Accept: "application/json",
        ...(key ? { "USPTO-API-KEY": key } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    const nested =
      (data as { trademarks?: Record<string, unknown>[] }).trademarks?.[0] || data;
    const attorneyName = asString(
      (nested as Record<string, unknown>).attorneyName ||
        (nested as Record<string, unknown>).attorney
    );
    return {
      serialNumber: serial,
      markText:
        asString(
          (nested as Record<string, unknown>).markText ||
            (nested as Record<string, unknown>).markElement
        ) || undefined,
      filingDate: asString((nested as Record<string, unknown>).filingDate) || undefined,
      status: asString((nested as Record<string, unknown>).status) || undefined,
      ownerName: asString((nested as Record<string, unknown>).ownerName) || undefined,
      ownerEmail: pickEmail((nested as Record<string, unknown>).ownerEmail) || undefined,
      attorneyName: attorneyName || undefined,
      hasAttorney: !!attorneyName,
      raw: data,
    };
  } catch {
    return null;
  }
}

export async function fetchApplicationByNumber(
  applicationNumber: string
): Promise<USPTOApplication | null> {
  const tm = await fetchTrademarkBySerial(applicationNumber);
  return tm ? toApplicationShape(tm) : null;
}

export async function searchUSPTOApplications(query: string): Promise<USPTOApplication[]> {
  const digits = query.replace(/\D/g, "");
  if (digits.length >= 7) {
    const tm = await fetchTrademarkBySerial(digits);
    return tm ? [toApplicationShape(tm)] : [];
  }
  return [];
}

export async function getUSPTOAPIStatus(): Promise<{
  status: string;
  message: string;
  odpKeyConfigured: boolean;
  tsdrKeyConfigured: boolean;
}> {
  const odp = !!odpKey();
  const tsdr = !!tsdrKey();

  if (!odp) {
    return {
      status: "auth_required",
      message:
        "Set USPTO_ODP_API_KEY (from data.uspto.gov / account.uspto.gov) to download daily trademark XML (TRTDXFAP).",
      odpKeyConfigured: false,
      tsdrKeyConfigured: tsdr,
    };
  }

  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const name = `apc${yymmdd(d)}.zip`;
  try {
    const response = await fetch(`${ODP_FILE_BASE}/${name}`, {
      method: "HEAD",
      headers: { "x-api-key": odpKey()! },
      redirect: "follow",
      cache: "no-store",
    });
    if (response.ok || response.status === 404) {
      return {
        status: "online",
        message: response.ok
          ? `ODP bulk OK — ${name} available`
          : `ODP reachable; ${name} not published yet (try previous day)`,
        odpKeyConfigured: true,
        tsdrKeyConfigured: tsdr,
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: "auth_required",
        message: "ODP rejected API key. Create key at account.uspto.gov / data.uspto.gov",
        odpKeyConfigured: true,
        tsdrKeyConfigured: tsdr,
      };
    }
    return {
      status: "error",
      message: `HTTP ${response.status}`,
      odpKeyConfigured: true,
      tsdrKeyConfigured: tsdr,
    };
  } catch (e) {
    return {
      status: "offline",
      message: String(e),
      odpKeyConfigured: odp,
      tsdrKeyConfigured: tsdr,
    };
  }
}
