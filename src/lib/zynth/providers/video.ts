import { getVideoExtraInput, getVideoModel, MAX_STORE_BYTES } from "../config";

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
 * توليد فيديو سوريالي عبر Replicate (نمط غير متزامن):
 * 1) createVideoJob يبدأ المهمة ويعرّفها بـ jobId
 * 2) pollVideoJob يُستدعى لاحقاً لمعرفة الحالة وجلب الرابط النهائي
 */
export async function createVideoJob(prompt: string): Promise<VideoJobHandle> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      "توليد الفيديو يتطلب REPLICATE_API_TOKEN. أضفه في متغيرات البيئة (أو في Vercel) ثم أعد المحاولة."
    );
  }

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
