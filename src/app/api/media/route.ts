import { NextResponse } from "next/server";
import { getBaseUrl, unauthorizedResponse, verifyApiAuth } from "@/lib/zynth/auth";
import { listMedia, serializeMedia, syncProcessingMedia } from "@/lib/zynth/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/media?refresh=1&limit=60 — قائمة الوسائط مع مزامنة المهام الجارية */
export async function GET(req: Request) {
  if (!verifyApiAuth(req)) return unauthorizedResponse();

  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 120);
  const types = url.searchParams.get("types")?.split(",").filter(Boolean);

  let rows = await listMedia({ types, limit });

  if (refresh) {
    const processing = rows.filter((r) => r.status === "processing");
    if (processing.length > 0) {
      await Promise.allSettled(processing.map((r) => syncProcessingMedia(r, getBaseUrl(req))));
      rows = await listMedia({ types, limit });
    }
  }

  const baseUrl = getBaseUrl(req);
  return NextResponse.json({
    media: rows.map((r) => serializeMedia(r, baseUrl)),
    processing: rows.filter((r) => r.status === "processing").length,
  });
}
