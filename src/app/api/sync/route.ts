import { runFullSync } from "@/lib/sync";
import { createLog } from "@/db/operations";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const daysBack = body.daysBack || 3;
    const limit = body.limit || 50;

    await createLog("manual_sync", "started", `Manual sync triggered: daysBack=${daysBack}, limit=${limit}`);

    const result = await runFullSync(daysBack, limit);

    return Response.json({
      success: true,
      message: "Sync completed",
      result,
    });
  } catch (error) {
    await createLog("manual_sync", "error", String(error));
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// Run every 5 minutes via Vercel Cron
export const maxDuration = 60;
