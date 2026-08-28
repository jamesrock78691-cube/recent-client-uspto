import { getLogs } from "@/db/operations";
import { getUSPTOAPIStatus } from "@/lib/uspto";
import { getGoogleConfig } from "@/db/operations";
import { testGoogleConnection } from "@/lib/google-sheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "status") {
      const usptoStatus = await getUSPTOAPIStatus();
      const googleConfig = await getGoogleConfig();
      const googleStatus = googleConfig?.spreadsheetId
        ? await testGoogleConnection()
        : { success: false, message: "Not configured" };

      return Response.json({
        success: true,
        status: {
          uspto: usptoStatus,
          googleSheets: googleStatus,
          resend: process.env.RESEND_API_KEY ? "configured" : "not_configured",
          lastSync: googleConfig?.lastSyncAt,
        },
      });
    }

    const limit = parseInt(url.searchParams.get("limit") || "50");
    const logs = await getLogs(limit);
    return Response.json({ success: true, logs });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
