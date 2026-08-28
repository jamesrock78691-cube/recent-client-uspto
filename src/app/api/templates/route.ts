import {
  getEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/db/operations";

export async function GET() {
  try {
    const templates = await getEmailTemplates();
    return Response.json({ success: true, templates });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const template = await createEmailTemplate(body);
    return Response.json({ success: true, template });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
