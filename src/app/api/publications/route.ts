import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unauthorizedResponse, verifyApiAuth } from "@/lib/zynth/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/publications — سجل عمليات النشر/الجدولة */
export async function GET(req: Request) {
  if (!verifyApiAuth(req)) return unauthorizedResponse();

  const publications = await db.publication.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      media: { select: { id: true, type: true, mimeType: true, prompt: true } },
    },
  });

  return NextResponse.json({
    publications: publications.map((p) => ({
      id: p.id,
      mediaId: p.mediaId,
      mediaType: p.media.type,
      networks: JSON.parse(p.networks) as string[],
      caption: p.caption,
      status: p.status,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      timezone: p.timezone,
      providerRef: p.providerRef,
      error: p.status === "failed" ? p.response : null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
