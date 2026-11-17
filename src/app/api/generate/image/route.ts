import { NextResponse } from "next/server";
import { getBaseUrl, unauthorizedResponse, verifyApiAuth } from "@/lib/zynth/auth";
import { getImageProvider, IMAGE_SIZES, type ImageSizeKey } from "@/lib/zynth/config";
import { completeMedia, createMedia, failMedia, getMediaRow, serializeMedia } from "@/lib/zynth/media";
import { generateImage } from "@/lib/zynth/providers/image";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Body {
  prompt?: string;
  size?: string;
  count?: number;
}

/** POST /api/generate/image — توليد صور سوريالية (1..4) من وصف نصي */
export async function POST(req: Request) {
  if (!verifyApiAuth(req)) return unauthorizedResponse();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "صيغة JSON غير صالحة" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "الوصف النصي (prompt) مطلوب" }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "الوصف أطول من 2000 حرف" }, { status: 400 });
  }

  const sizeKey = (body.size && body.size in IMAGE_SIZES ? body.size : "square") as ImageSizeKey;
  const count = Math.min(Math.max(Number(body.count) || 1, 1), 4);
  const provider = getImageProvider();

  // إنشاء سجلات الوسائط أولاً (status=processing)
  const rows = await Promise.all(
    Array.from({ length: count }, () =>
      createMedia({ type: "image", prompt, provider, meta: { size: sizeKey } })
    )
  );

  // توليد متوازٍ ثم تحديث الحالة لكل سجل
  const settled = await Promise.allSettled(
    rows.map(async (row) => {
      try {
        const result = await generateImage(prompt, sizeKey);
        const updated = await completeMedia(row.id, {
          buffer: result.buffer,
          mimeType: result.mimeType,
        });
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await failMedia(row.id, msg);
        throw err;
      }
    })
  );

  const baseUrl = getBaseUrl(req);
  const media = rows.map((row) => serializeMedia(row, baseUrl));
  const errors = settled
    .map((s, i) => (s.status === "rejected" ? { id: rows[i].id, error: String(s.reason).slice(0, 300) } : null))
    .filter((x): x is { id: string; error: string } => x !== null);

  // إعادة قراءة الحالة النهائية للسجلات
  const finalRows = await Promise.all(rows.map((r) => getMediaRow(r.id)));
  const finalMedia = finalRows
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => serializeMedia(r, baseUrl));

  return NextResponse.json({ media: finalMedia, errors }, { status: errors.length === count ? 502 : 200 });
}
