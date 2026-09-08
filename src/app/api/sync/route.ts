import { runFullSync } from "@/lib/sync";
import { createLog } from "@/db/operations";

export const maxDuration = 60;

async function handleSync(daysBack: number, limit: number, source: string) {
  await createLog("sync", "started", `${source}: daysBack=${daysBack}, limit=${limit}`);
  const result = await runFullSync(daysBack, limit);
  return Response.json({
    success: true,
    message: "Sync completed (trademarks only)",
    result,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const daysBack = body.daysBack || 3;
    const limit = body.limit || 40;
    return await handleSync(daysBack, limit, "manual_sync");
  } catch (error) {
    await createLog("manual_sync", "error", String(error));
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/** Vercel Cron hits GET */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const daysBack = Number(url.searchParams.get("daysBack") || 2);
    const limit = Number(url.searchParams.get("limit") || 40);

    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${secret}`) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    return await handleSync(daysBack, limit, "cron_sync");
  } catch (error) {
    await createLog("cron_sync", "error", String(error));
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
