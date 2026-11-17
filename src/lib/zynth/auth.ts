import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * التحقق من هوية المتصل بواجهات REST.
 * - إذا لم يُضبط ZYNTH_API_KEY: الوضع مفتوح (للتطوير/المعاينة).
 * - إذا ضُبط: مسموح لاتصالات نفس النطاق (لوحة التحكم)،
 *   وأي عميل خارجي (ChatGPT Action / curl) يلزمه x-api-key أو Bearer.
 */
export function verifyApiAuth(req: Request): boolean {
  const required = process.env.ZYNTH_API_KEY;
  if (!required) return true;

  // اتصال من نفس النطاق (المتصفح في لوحة التحكم)
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      const host =
        req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      if (host && o.host === host) return true;
    } catch {
      // Origin غير صالح — نكمل بفحص المفتاح
    }
  }

  const bearer = req.headers.get("authorization");
  const provided =
    req.headers.get("x-api-key") ??
    (bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7) : null);

  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(required);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "مفتاح API غير صالح أو مفقود (x-api-key)" },
    { status: 401 }
  );
}

/** يبني عنوان URL العام للتطبيق من الترويسات أو PUBLIC_BASE_URL */
export function getBaseUrl(req: Request): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${proto}://${host ?? "localhost:3000"}`;
}
