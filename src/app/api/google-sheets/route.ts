import { getGoogleConfig, updateGoogleConfig } from "@/db/operations";
import { testGoogleConnection, initializeSheet } from "@/lib/google-sheets";

export async function GET() {
  try {
    const config = await getGoogleConfig();
    const connection = config?.spreadsheetId ? await testGoogleConnection() : { success: false, message: "Not configured" };

    return Response.json({
      success: true,
      config: config
        ? { ...config, serviceAccountKey: config.serviceAccountKey ? "[configured]" : null }
        : null,
      connection,
    });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, spreadsheetId, sheetName, serviceAccountKey, serviceAccountEmail, isActive } = body;

    if (action === "test") {
      const result = await testGoogleConnection(spreadsheetId);
      return Response.json(result);
    }

    if (action === "init") {
      const config = await getGoogleConfig();
      if (!config) {
        return Response.json({ success: false, error: "Configure Google Sheets first" }, { status: 400 });
      }
      await initializeSheet(config.spreadsheetId, sheetName || config.sheetName || "Sheet1");
      return Response.json({ success: true, message: "Sheet initialized with headers" });
    }

    const config = await updateGoogleConfig({
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
      serviceAccountKey: serviceAccountKey || undefined,
      serviceAccountEmail: serviceAccountEmail || undefined,
      isActive: isActive,
    });

    return Response.json({ success: true, config: { ...config, serviceAccountKey: "[hidden]" } });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
