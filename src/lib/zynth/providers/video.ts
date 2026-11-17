import { getKieVideoModel, getVideoExtraInput, getVideoModel, getVideoProvider, MAX_STORE_BYTES } from "../config";
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
 * - kie.ai (KIE_API_KEY): grok-imagine-video-1-5-preview عبر Jobs API الموحد
 * - Replicate (REPLICATE_API_TOKEN): بديل اختياري
 * 1) createVideoJob يبدأ المهمة ويعرّفها بـ jobId
 * 2) pollVideoJob يُستدعى لاحقاً لمعرفة الحالة وجلب الرابط النهائي
 */
export async function createVideoJob(prompt: string): Promise<VideoJobHandle> {
  const provider = getVideoProvider();

  if (provider === "kie") {
    const model = getKieVideoModel();
    const extra = getVideoExtraInput();
    const taskId = await kieCreateTask(model, {
      prompt,
      aspect_ratio: "9:16",
      ...extra,
    });
    return { jobId: `kie:${taskId}`, model };
  }

  if (!provider) {
    throw new Error(
      "توليد الفيديو يتطلب KIE_API_KEY أو REPLICATE_API_TOKEN. أضف أحدهما في متغيرات البيئة ثم أعد المحاولة."
    );
  }

  const token = process.env.REPLICATE_API_TOKEN;

  const model = getVideoModel();
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
        input: { prompt, ...getVideoExtraInput() },
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

export async function pollVideoJob(jobId: string): Promise<VideoJobState> {
  // مهام kie.ai — jobId بصيغة "kie:<taskId>"
  if (jobId.startsWith("kie:")) {
    const state = await kiePollTask(jobId.slice(4));
    return {
      status:
        state.status === "succeeded"
          ? "succeeded"
          : state.status === "failed"
            ? "failed"
            : "processing",
      outputUrl: state.resultUrl,
      error: state.error,
    };
  }

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

/** تنزيل ملف الفيديو الناتج (مع حد أقصى للتخزين) */
export async function downloadMedia(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`فشل تنزيل الملف الناتج (${res.status})`);

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
