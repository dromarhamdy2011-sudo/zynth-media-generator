/**
 * عميل kie.ai الموحد (Jobs API)
 * التوثيق: https://docs.kie.ai
 * - إنشاء مهمة: POST https://api.kie.ai/api/v1/jobs/createTask
 * - متابعة المهمة: GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
 * المصادقة: ترويسة Authorization: Bearer <KIE_API_KEY>
 * حالات المهمة: waiting | queuing | generating | success | fail
 */

import { MAX_STORE_BYTES } from "../config";

const KIE_API_BASE = "https://api.kie.ai/api/v1/jobs";

export function kieApiKey(): string {
  const key = process.env.KIE_API_KEY;
  if (!key) {
    throw new Error("KIE_API_KEY مفقود. أضفه في متغيرات البيئة (أو في Vercel) ثم أعد المحاولة.");
  }
  return key;
}

/** إنشاء مهمة توليد وإرجاع taskId */
export async function kieCreateTask(
  model: string,
  input: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${KIE_API_BASE}/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kieApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  const json = (await res.json().catch(() => null)) as
    | { code?: number; msg?: string; data?: { taskId?: string } }
    | null;

  if (!res.ok || !json || json.code !== 200 || !json.data?.taskId) {
    throw new Error(
      `kie.ai createTask (${res.status}): ${json?.msg ?? "استجابة غير صالحة"}`
    );
  }
  return json.data.taskId;
}

export interface KiePollState {
  status: "processing" | "succeeded" | "failed";
  resultUrl?: string;
  error?: string;
}

/** قراءة حالة مهمة واستخراج رابط الناتج عند الاكتمال */
export async function kiePollTask(taskId: string): Promise<KiePollState> {
  const res = await fetch(
    `${KIE_API_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${kieApiKey()}` } }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`kie.ai recordInfo (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json().catch(() => null)) as
    | {
        code?: number;
        msg?: string;
        data?: {
          state?: string;
          resultJson?: string;
          failMsg?: string;
          failCode?: string;
        };
      }
    | null;

  if (!json || (json.code !== undefined && json.code !== 200)) {
    throw new Error(`kie.ai recordInfo: ${json?.msg ?? "استجابة غير صالحة"}`);
  }

  const d = json.data ?? {};
  const state = d.state ?? "";

  if (state === "success") {
    const url = extractResultUrl(d.resultJson);
    if (!url) return { status: "failed", error: "اكتملت المهمة دون رابط ناتج صالح" };
    return { status: "succeeded", resultUrl: url };
  }

  if (state === "fail") {
    return {
      status: "failed",
      error: d.failMsg ?? `فشلت المهمة (${d.failCode ?? "بدون رمز خطأ"})`,
    };
  }

  // waiting | queuing | generating — ما زالت قيد المعالجة
  return { status: "processing" };
}

/** resultJson يصل غالباً كسلسلة JSON تحتوي resultUrl (نص أو مصفوفة) */
function extractResultUrl(resultJson?: string): string | undefined {
  if (!resultJson) return undefined;
  try {
    const parsed = JSON.parse(resultJson) as unknown;
    if (typeof parsed === "string") {
      return parsed.startsWith("http") ? parsed : undefined;
    }
    const obj = parsed as { resultUrl?: string | string[]; url?: string | string[] };
    const pick = (v: string | string[] | undefined): string | undefined =>
      Array.isArray(v)
        ? v.find((u) => typeof u === "string" && u.length > 0)
        : typeof v === "string" && v.length > 0
          ? v
          : undefined;
    return pick(obj.resultUrl) ?? pick(obj.url);
  } catch {
    return resultJson.startsWith("http") ? resultJson : undefined;
  }
}

/** تنزيل ملف ناتج من kie.ai مع حد أقصى للتخزين */
export async function downloadKieMedia(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`فشل تنزيل الملف الناتج من kie.ai (${res.status})`);

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_STORE_BYTES) {
    throw new Error(
      `حجم الملف (${Math.round(contentLength / 1024 / 1024)}MB) يتجاوز حد التخزين`
    );
  }

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_STORE_BYTES) {
    throw new Error(
      `حجم الملف (${Math.round(arrayBuf.byteLength / 1024 / 1024)}MB) يتجاوز حد التخزين`
    );
  }

  return Buffer.from(arrayBuf);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
