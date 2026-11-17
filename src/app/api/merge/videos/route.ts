import { NextResponse } from "next/server";
import { getBaseUrl, unauthorizedResponse, verifyApiAuth } from "@/lib/zynth/auth";
import { concatVideos } from "@/lib/zynth/merge";
import { completeMedia, createMedia, failMedia, getMediaRow, serializeMedia } from "@/lib/zynth/media";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** POST /api/merge/videos — دمج عدة مقاطع فيديو في مقطع واحد (ffmpeg) */
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
    return NextResponse.json({ error: "اختر مقطعين على الأقل للدمج" }, { status: 400 });
  }
  if (ids.length > 6) {
    return NextResponse.json({ error: "الحد الأقصى 6 مقاطع للدمج" }, { status: 400 });
  }

  const rows = await Promise.all(ids.map((id) => getMediaRow(id)));
  const videos = rows.filter(
    (r): r is NonNullable<typeof r> =>
      r !== null && r.status === "completed" && r.type.includes("video") && r.data !== null
  );

  if (videos.length < 2) {
    return NextResponse.json(
      { error: "لا توجد مقاطع فيديو مكتملة كافية للدمج" },
      { status: 400 }
    );
  }

  const row = await createMedia({
    type: "merged_video",
    prompt: `دمج ${videos.length} مقاطع`,
    provider: "ffmpeg",
    meta: { sourceIds: videos.map((r) => r.id) },
  });

  try {
    const buffer = await concatVideos(videos.map((r) => r.data!));
    await completeMedia(row.id, { buffer, mimeType: "video/mp4" });
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
