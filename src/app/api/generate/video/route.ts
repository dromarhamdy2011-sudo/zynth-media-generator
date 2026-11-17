import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBaseUrl, unauthorizedResponse, verifyApiAuth } from "@/lib/zynth/auth";
import { getVideoModel } from "@/lib/zynth/config";
import { createMedia, failMedia, getMediaRow, serializeMedia } from "@/lib/zynth/media";
import { createVideoJob } from "@/lib/zynth/providers/video";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** POST /api/generate/video — بدء توليد فيديو سوريالي (مهمة غير متزامنة عبر Replicate) */
export async function POST(req: Request) {
  if (!verifyApiAuth(req)) return unauthorizedResponse();

  let body: { prompt?: string };
  try {
    body = (await req.json()) as { prompt?: string };
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

  const row = await createMedia({ type: "video", prompt, provider: "replicate" });

  try {
    const job = await createVideoJob(prompt);
    await db.media.update({
      where: { id: row.id },
      data: {
        providerJobId: job.jobId,
        meta: JSON.stringify({ model: job.model }),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failMedia(row.id, msg);
    const failed = await getMediaRow(row.id);
    return NextResponse.json(
      { media: failed ? serializeMedia(failed, getBaseUrl(req)) : null, error: msg },
      { status: 502 }
    );
  }

  const updated = await getMediaRow(row.id);
  return NextResponse.json({
    media: updated ? serializeMedia(updated, getBaseUrl(req)) : null,
  });
}
