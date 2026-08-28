import { getEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from "@/db/operations";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const template = await getEmailTemplate(parseInt(id));
    if (!template) {
      return Response.json({ success: false, error: "Template not found" }, { status: 404 });
    }
    return Response.json({ success: true, template });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const template = await updateEmailTemplate(parseInt(id), body);
    return Response.json({ success: true, template });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteEmailTemplate(parseInt(id));
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
