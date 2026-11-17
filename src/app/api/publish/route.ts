import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBaseUrl, unauthorizedResponse, verifyApiAuth } from "@/lib/zynth/auth";
import { getMediaRow } from "@/lib/zynth/media";
import { isMetricoolConfigured, scheduleViaMetricool } from "@/lib/zynth/metricool";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface Body {
  mediaId?: string;
  networks?: string[];
  caption?: string;
  scheduledAt?: string;
  timezone?: string;
}

/** POST /api/publish — جدولة/نشر وسيط عبر Metricool */
export async function POST(req: Request) {
  if (!verifyApiAuth(req)) return unauthorizedResponse();
  if (!isMetricoolConfigured()) {
    return NextResponse.json(
      {
        error:
          "النشر عبر Metricool غير مضبوط. أضف METRICOOL_USER_TOKEN و METRICOOL_USER_ID و METRICOOL_BLOG_ID في متغيرات البيئة.",
      },
      { status: 400 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "صيغة JSON غير صالحة" }, { status: 400 });
  }

  const mediaId = body.mediaId?.trim();
  const networks = (body.networks ?? []).filter(Boolean);
  const caption = (body.caption ?? "").trim();

  if (!mediaId) {
    return NextResponse.json({ error: "mediaId مطلوب" }, { status: 400 });
  }
  if (networks.length === 0) {
    return NextResponse.json({ error: "اختر شبكة اجتماعية واحدة على الأقل" }, { status: 400 });
  }
  if (!caption) {
    return NextResponse.json({ error: "نص المنشور (caption) مطلوب" }, { status: 400 });
  }

  const media = await getMediaRow(mediaId);
  if (!media || media.status !== "completed") {
    return NextResponse.json(
      { error: "الوسيط غير موجود أو غير مكتمل" },
      { status: 404 }
    );
  }

  const mediaUrl = `${getBaseUrl(req)}/api/media/${mediaId}/file`;
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "تاريخ الجدولة غير صالح" }, { status: 400 });
  }

  const publication = await db.publication.create({
    data: {
      mediaId,
      networks: JSON.stringify(networks),
      caption,
      status: "scheduled",
      scheduledAt: scheduledAt ?? null,
      timezone: body.timezone || process.env.METRICOOL_TIMEZONE || "UTC",
    },
  });

  try {
    const result = await scheduleViaMetricool({
      caption,
      networks,
      mediaUrl,
      scheduledAt,
      timezone: body.timezone,
    });

    const updated = await db.publication.update({
      where: { id: publication.id },
      data: {
        status: "scheduled",
        providerRef: result.refId ?? null,
        response: JSON.stringify(result.raw)?.slice(0, 1000) ?? null,
      },
    });

    return NextResponse.json({ publication: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const updated = await db.publication.update({
      where: { id: publication.id },
      data: { status: "failed", response: msg.slice(0, 1000) },
    });
    return NextResponse.json(
      { publication: updated, error: msg },
      { status: 502 }
    );
  }
}
