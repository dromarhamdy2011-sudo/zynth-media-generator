import { NextResponse } from "next/server";
import { getBaseUrl, unauthorizedResponse, verifyApiAuth } from "@/lib/zynth/auth";
import { deleteMediaRow, getMediaRow, serializeMedia, syncProcessingMedia } from "@/lib/zynth/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/media/[id] — تفاصيل وسيط (مع مزامنة حالة مهمة الفيديو الجارية) */
export async function GET(req: Request, ctx: Ctx) {
  if (!verifyApiAuth(req)) return unauthorizedResponse();

  const { id } = await ctx.params;
  let row = await getMediaRow(id);
  if (!row) return NextResponse.json({ error: "الوسيط غير موجود" }, { status: 404 });

  if (row.status === "processing") {
    row = await syncProcessingMedia(row, getBaseUrl(req));
  }

  return NextResponse.json({ media: serializeMedia(row, getBaseUrl(req)) });
}

/** DELETE /api/media/[id] — حذف وسيط */
export async function DELETE(req: Request, ctx: Ctx) {
  if (!verifyApiAuth(req)) return unauthorizedResponse();

  const { id } = await ctx.params;
  const row = await getMediaRow(id);
  if (!row) return NextResponse.json({ error: "الوسيط غير موجود" }, { status: 404 });

  await deleteMediaRow(id);
  return NextResponse.json({ ok: true, id });
}
