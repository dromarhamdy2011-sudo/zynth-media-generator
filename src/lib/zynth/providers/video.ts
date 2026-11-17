import { getVideoModel, MAX_STORE_BYTES, getProviderExtraInput } from "../config";
import { kieCreateTask, kiePollTask } from "./kie";

export type VideoJobStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export interface VideoJobHandle {
  jobId: string;
  model: string;
}

export interface VideoJobState {
  status: VideoJobStatus;
  outputUrl?: string;
  error?: string;
}

/**
 * توليد فيديو سوريالي (نمط غير متزامن):
 * 1) createVideoJob يبدأ المهمة ويعرّفها بـ jobId
 * 2) pollVideoJob يُستدعى لاحقاً لمعرفة الحالة وجلب الرابط النهائي
 *
 * المزوّد الأساسي: kie.ai — grok-imagine-video-1-5-preview
 * البديل: Replicate (يُستخدم فقط عند غياب KIE_API_KEY)
 */
export async function createVideoJob(prompt: string): Promise<VideoJobHandle> {
  if (process.env.KIE_API_KEY) return createWithKie(prompt);
  if (process.env.REPLICATE_API_TOKEN) return createWithReplicate(prompt);

  throw new Error(
    "توليد الفيديو يتطلب KIE_API_KEY (أو REPLICATE_API_TOKEN كبديل). أضفه في متغيرات البيئة ثم أعد المحاولة."
  );
}

export async function pollVideoJob(jobId: string): Promise<VideoJobState> {
  if (process.env.KIE_API_KEY) return pollWithKie(jobId);
  if (process.env.REPLICATE_API_TOKEN) return pollWithReplicate(jobId);

  throw new Error("لا يوجد مزوّد فيديو مضبوط (KIE_API_KEY مفقود)");
}

/* ============ kie.ai — grok-imagine-video-1-5-preview ============ */

async function createWithKie(prompt: string): Promise<VideoJobHandle> {
  const model = getVideoModel();

  const input = {
    prompt,
    // المحتوى العمودي (تيك توك / ريلز) هو الافتراضي لـ zynth_ai
    aspect_ratio: "9:16",
    ...getProviderExtraInput("VIDEO_INPUT"),
  };

  const jobId = await kieCreateTask(model, input);
  return { jobId, model };
}

async function pollWithKie(jobId: string): Promise<VideoJobState> {
  const snap = await kiePollTask(jobId);

  if (snap.state === "success") {
    return { status: "succeeded", outputUrl: snap.url };
  }
  if (snap.state === "fail") {
    return {
      status: "failed",
      error: snap.failMsg ?? "فشلت مهمة kie.ai بدون تفاصيل",
    };
  }
  return { status: "processing" };
}

/* ============ Replicate (بديل اختياري) ============ */

async function createWithReplicate(prompt: string): Promise<VideoJobHandle> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN مفقود");

  const model = process.env.REPLICATE_VIDEO_MODEL ?? "minimax/video-01";
  const res = await fetch(
    `https://api.replicate.com/v1/models/${model}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "respond-async",
      },
      body: JSON.stringify({
        input: { prompt, ...getProviderExtraInput("VIDEO_INPUT") },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Replicate (${res.status}): ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Replicate لم يُرجع معرّف المهمة");

  return { jobId: json.id, model };
}

async function pollWithReplicate(jobId: string): Promise<VideoJobState> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN مفقود");

  const res = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Replicate poll (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    status: VideoJobStatus;
    output?: string | string[];
    error?: string | null;
  };

  let outputUrl: string | undefined;
  if (Array.isArray(json.output)) {
    outputUrl = json.output.find((u) => typeof u === "string");
  } else if (typeof json.output === "string") {
    outputUrl = json.output;
  }

  return {
    status: json.status,
    outputUrl,
    error: json.error ?? undefined,
  };
}

/** تنزيل ملف الفيديو الناتج (مع حد أقصى للتخزين) — يعمل مع أي مزوّد */
export async function downloadMedia(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`فشل تنزيل الملف الناتج (${res.status})`);

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

  return Buffer.from(arrayBuf);
}
