import { getImageModel, getImageProvider, getKieImageModel, IMAGE_SIZES, OPENAI_SIZE_MAP, type ImageSizeKey } from "../config";
import { downloadKieMedia, kieCreateTask, kiePollTask, sleep } from "./kie";

export interface ImageResult {
  buffer: Buffer;
  mimeType: string;
  provider: string;
  model: string;
}

/**
 * توليد صورة سوريالية من وصف نصي.
 * - الإنتاج (KIE_API_KEY مضبوط): kie.ai — GPT Image 2.6 Flare
 * - بديل (OPENAI_API_KEY مضبوط): OpenAI Images API
 * - المعاينة/التطوير: z-ai-web-dev-sdk (يعمل بدون مفاتيح)
 */
export async function generateImage(
  prompt: string,
  sizeKey: ImageSizeKey = "square"
): Promise<ImageResult> {
  const size = IMAGE_SIZES[sizeKey] ?? IMAGE_SIZES.square;

  if (getImageProvider() === "kie") {
    return generateWithKie(prompt, size);
  }
  if (getImageProvider() === "openai") {
    return generateWithOpenAI(prompt, size);
  }
  return generateWithZai(prompt, size);
}

/** خريطة الأبعاد إلى نسب العرض لـ kie.ai */
const KIE_ASPECT_MAP: Record<string, string> = {
  "1024x1024": "1:1",
  "768x1344": "9:16",
  "1344x768": "16:9",
  "1440x720": "21:9",
};

async function generateWithKie(prompt: string, size: string): Promise<ImageResult> {
  const model = getKieImageModel();
  // نسخة بديلة لاسم النموذج (شرطة/نقطة) في حال رفض المزوّد للاسم الأساسي
  const altModel = model.includes("-2-6/")
    ? model.replace(/-2-6\//, "-2.6/")
    : model.includes("-2.6/")
      ? model.replace(/-2\.6\//, "-2-6/")
      : null;

  let taskId: string;
  try {
    taskId = await kieCreateTask(model, {
      prompt,
      aspect_ratio: KIE_ASPECT_MAP[size] ?? "1:1",
      resolution: "1K",
    });
  } catch (err) {
    if (!altModel) throw err;
    taskId = await kieCreateTask(altModel, {
      prompt,
      aspect_ratio: KIE_ASPECT_MAP[size] ?? "1:1",
      resolution: "1K",
    });
  }

  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const state = await kiePollTask(taskId);
    if (state.status === "succeeded" && state.resultUrl) {
      const buffer = await downloadKieMedia(state.resultUrl);
      const mime = /\.(webp)(\?|$)/i.test(state.resultUrl) ? "image/webp" : "image/png";
      return { buffer, mimeType: mime, provider: "kie", model };
    }
    if (state.status === "failed") {
      throw new Error(state.error ?? "فشل توليد الصورة عبر kie.ai");
    }
    await sleep(6000);
  }
  throw new Error("انتهت مهلة توليد الصورة عبر kie.ai (4 دقائق)");
}

async function generateWithOpenAI(prompt: string, size: string): Promise<ImageResult> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getImageModel(),
      prompt,
      n: 1,
      size: OPENAI_SIZE_MAP[size] ?? "1024x1024",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI Images API (${res.status}): ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI لم يُرجع صورة صالحة");

  return {
    buffer: Buffer.from(b64, "base64"),
    mimeType: "image/png",
    provider: "openai",
    model: getImageModel(),
  };
}

async function generateWithZai(prompt: string, size: string): Promise<ImageResult> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const response = await zai.images.generations.create({
    prompt,
    size: size as "1024x1024",
  });

  const b64 = response?.data?.[0]?.base64;
  if (!b64) throw new Error("مزوّد الصور لم يُرجع نتيجة صالحة");

  return {
    buffer: Buffer.from(b64, "base64"),
    mimeType: "image/png",
    provider: "zai",
    model: "zai-image-gen",
  };
}
