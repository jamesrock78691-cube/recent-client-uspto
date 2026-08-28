import { getApplications, getApplicationById, getUnemailedApplications } from "@/db/operations";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    if (action === "unemailed") {
      const apps = await getUnemailedApplications();
      return Response.json({ success: true, applications: apps });
    }

    const apps = await getApplications(limit, offset);
    return Response.json({ success: true, applications: apps });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
