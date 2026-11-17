import { NextResponse } from "next/server";
import { getMediaRow } from "@/lib/zynth/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/media/[id]/file — تقديم ملف الوسيط الخام.
 * مسار عام (بدون مفتاح) لأن الصور/الفيديو تُعرض في <img>/<video>
 * ولأن Metricool يحتاج جلب الوسيط من رابط عام.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await getMediaRow(id);

  if (!row || row.status !== "completed" || !row.data) {
    return NextResponse.json(
      { error: "الملف غير متاح (غير مكتمل أو غير موجود)" },
      { status: 404 }
    );
  }

  const body = new Uint8Array(row.data);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": row.mimeType ?? "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="zynth-${row.id}.${extOf(row.mimeType)}"`,
    },
  });
}

function extOf(mime: string | null): string {
  if (mime?.includes("png")) return "png";
  if (mime?.includes("jpeg") || mime?.includes("jpg")) return "jpg";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("mp4")) return "mp4";
  if (mime?.includes("webm")) return "webm";
  return "bin";
}
