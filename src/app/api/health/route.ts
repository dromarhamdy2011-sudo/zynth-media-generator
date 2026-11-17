import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/zynth/config";

export const dynamic = "force-dynamic";

/** GET /api/health — فحص جاهزية الخدمة وحالة الميزات (بدون كشف أي أسرار) */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "zynth-ai",
    version: "1.0.0",
    features: getFeatureFlags(),
    time: new Date().toISOString(),
  });
}
