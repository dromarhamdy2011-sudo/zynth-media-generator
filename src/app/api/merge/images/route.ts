import { NextResponse } from "next/server";
import { getBaseUrl, unauthorizedResponse, verifyApiAuth } from "@/lib/zynth/auth";
import { collageImages } from "@/lib/zynth/merge";
import { completeMedia, createMedia, failMedia, getMediaRow, serializeMedia } from "@/lib/zynth/media";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** POST /api/merge/images — دمج عدة صور في كولاج واحد */
export async function POST(req: Request) {
  if (!verifyApiAuth(req)) return unauthorizedResponse();

  let body: { ids?: string[] };
  try {
    body = (await req.json()) as { ids?: string[] };
  } catch {
    return NextResponse.json({ error: "صيغة JSON غير صالحة" }, { status: 400 });
  }

  const ids = (body.ids ?? []).filter(Boolean);
  if (ids.length < 2) {
    return NextResponse.json({ error: "اختر صورتين على الأقل للدمج" }, { status: 400 });
  }
  if (ids.length > 9) {
    return NextResponse.json({ error: "الحد الأقصى 9 صور للدمج" }, { status: 400 });
  }

  const rows = await Promise.all(ids.map((id) => getMediaRow(id)));
  const images = rows.filter(
    (r): r is NonNullable<typeof r> =>
      r !== null && r.status === "completed" && r.type.startsWith("image") && r.data !== null
  );

  if (images.length < 2) {
    return NextResponse.json(
      { error: "لا توجد صور مكتملة كافية للدمج (يلزم صورتان مكتملتان على الأقل)" },
      { status: 400 }
    );
  }

  const row = await createMedia({
    type: "merged_image",
    prompt: `دمج ${images.length} صور`,
    provider: "sharp",
    meta: { sourceIds: images.map((r) => r.id), layout: "grid" },
  });

  try {
    const buffer = await collageImages(images.map((r) => r.data!));
    await completeMedia(row.id, { buffer, mimeType: "image/png" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failMedia(row.id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const updated = await getMediaRow(row.id);
  return NextResponse.json({
    media: updated ? serializeMedia(updated, getBaseUrl(req)) : null,
  });
}
