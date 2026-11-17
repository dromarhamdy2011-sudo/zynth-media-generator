/**
 * عميل kie.ai الموحّد — Jobs API (صور + فيديو)
 * إنشاء مهمة:  POST https://api.kie.ai/api/v1/jobs/createTask
 * حالة المهمة: GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
 * المصادقة:    Authorization: Bearer <KIE_API_KEY>
 *
 * ملاحظات مهمة:
 * - الأخطاء تعود بحالة HTTP 200 مع حقل code — يجب فحص code === 200 دائماً.
 * - حالات المهمة: waiting | queuing | generating | success | fail
 * - النتيجة داخل حقل resultJson (نص JSON) بصيغة {"resultUrls":["..."]}
 */

import { MAX_STORE_BYTES } from "../config";

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";

export function isKieConfigured(): boolean {
  return Boolean(process.env.KIE_API_KEY);
}

interface KieResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

interface KieTaskData {
  taskId?: string;
}

interface KieRecordData {
  state?: string;
  resultJson?: string;
  failMsg?: string;
  failCode?: string;
  progress?: number;
}

async function kieHeaders(): Promise<Record<string, string>> {
  const key = process.env.KIE_API_KEY;
  if (!key) {
    throw new Error(
      "KIE_API_KEY مفقود. أضفه في متغيرات البيئة (محلياً في .env أو في Vercel → Environment Variables) ثم أعد المحاولة."
    );
  }
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function requireOk<T>(json: KieResponse<T>): T {
  if (json.code !== 200 || json.data === undefined) {
    throw new Error(
      `kie.ai (code ${json.code}): ${json.msg ?? "خطأ غير معروف"}`
    );
  }
  return json.data;
}

/** إنشاء مهمة توليد على kie.ai وإرجاع معرّفها (taskId) */
export async function kieCreateTask(
  model: string,
  input: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${KIE_BASE}/createTask`, {
    method: "POST",
    headers: await kieHeaders(),
    body: JSON.stringify({ model, input }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`kie.ai HTTP (${res.status}): ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as KieResponse<KieTaskData>;
  const data = requireOk(json);
  if (!data.taskId) throw new Error("kie.ai لم يُرجع معرّف المهمة (taskId)");
  return data.taskId;
}

export interface KieTaskSnapshot {
  state: string;
  url?: string;
  failMsg?: string;
  progress?: number;
}

/** استعلام حالة مهمة واستخراج أول رابط نتيجة إن وُجد */
export async function kiePollTask(taskId: string): Promise<KieTaskSnapshot> {
  const res = await fetch(
    `${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: await kieHeaders() }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`kie.ai poll HTTP (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as KieResponse<KieRecordData>;
  const data = requireOk(json);

  let url: string | undefined;
  if (data.resultJson) {
    try {
      const parsed = JSON.parse(data.resultJson) as { resultUrls?: unknown };
      if (Array.isArray(parsed.resultUrls)) {
        url = parsed.resultUrls.find(
          (u): u is string => typeof u === "string" && u.length > 0
        );
      }
    } catch {
      // resultJson ليس JSON صالحاً — تجاهل بهدوء
    }
  }

  return {
    state: data.state ?? "waiting",
    url,
    failMsg: data.failMsg || undefined,
    progress: data.progress ?? undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** انتظار اكتمال المهمة وإرجاع رابط النتيجة النهائي */
export async function kieWaitForTask(
  taskId: string,
  timeoutMs = 240_000,
  intervalMs = 3_000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const snap = await kiePollTask(taskId);
    if (snap.state === "success") {
      if (!snap.url) {
        throw new Error("kie.ai أرجع النجاح بدون رابط نتيجة (resultUrls)");
      }
      return snap.url;
    }
    if (snap.state === "fail") {
      throw new Error(
        `فشلت مهمة kie.ai: ${snap.failMsg ?? "بدون تفاصيل"}`
      );
    }
    if (Date.now() + intervalMs >= deadline) {
      throw new Error(
        `انتهت مهلة انتظار مهمة kie.ai (${Math.round(timeoutMs / 1000)} ثانية) — الحالة الأخيرة: ${snap.state}`
      );
    }
    await sleep(intervalMs);
  }
}

function guessMime(url: string, contentType?: string): string {
  const clean = contentType?.split(";")[0]?.trim().toLowerCase();
  if (clean && clean !== "application/octet-stream") return clean;
  if (/\.(jpe?g)(\?|$)/i.test(url)) return "image/jpeg";
  if (/\.(webp)(\?|$)/i.test(url)) return "image/webp";
  if (/\.(mp4)(\?|$)/i.test(url)) return "video/mp4";
  if (/\.(webm)(\?|$)/i.test(url)) return "video/webm";
  return "image/png";
}

/** تنزيل ملف ناتج من kie.ai مع حد أقصى للتخزين */
export async function downloadKieMedia(
  url: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`فشل تنزيل الناتج من kie.ai (${res.status})`);

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_STORE_BYTES) {
    throw new Error(
      `حجم الملف (${Math.round(contentLength / 1024 / 1024)}MB) يتجاوز حد التخزين (${Math.round(MAX_STORE_BYTES / 1024 / 1024)}MB)`
    );
  }

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_STORE_BYTES) {
    throw new Error(
      `حجم الملف (${Math.round(arrayBuf.byteLength / 1024 / 1024)}MB) يتجاوز حد التخزين (${Math.round(MAX_STORE_BYTES / 1024 / 1024)}MB)`
    );
  }

  return {
    buffer: Buffer.from(arrayBuf),
    mimeType: guessMime(url, res.headers.get("content-type") ?? undefined),
  };
}
