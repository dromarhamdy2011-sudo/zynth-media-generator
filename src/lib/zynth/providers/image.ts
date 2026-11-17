import {
  getImageModel,
  getImageProvider,
  IMAGE_SIZES,
  KIE_ASPECT_MAP,
  OPENAI_SIZE_MAP,
  getProviderExtraInput,
  type ImageSizeKey,
} from "../config";
import { kieCreateTask, kieWaitForTask, downloadKieMedia } from "./kie";

export interface ImageResult {
  buffer: Buffer;
  mimeType: string;
  provider: string;
  model: string;
}

/**
 * توليد صورة سوريالية من وصف نصي.
 * - الإنتاج (KIE_API_KEY مضبوط): kie.ai — gpt-image-2-6/flare-text-to-image
 * - بديل (OPENAI_API_KEY): OpenAI Images API
 * - المعاينة/التطوير بدون مفاتيح: z-ai-web-dev-sdk
 */
export async function generateImage(
  prompt: string,
  sizeKey: ImageSizeKey = "square"
): Promise<ImageResult> {
  const provider = getImageProvider();

  if (provider === "kie") return generateWithKie(prompt, sizeKey);
  if (provider === "openai") return generateWithOpenAI(prompt, sizeKey);
  return generateWithZai(prompt, sizeKey);
}

/** kie.ai — gpt-image-2-6/flare-text-to-image (مهام غير متزامنة ثم تنزيل الناتج) */
async function generateWithKie(
  prompt: string,
  sizeKey: ImageSizeKey
): Promise<ImageResult> {
  const model = getImageModel();
  const aspectRatio = KIE_ASPECT_MAP[sizeKey] ?? "1:1";

  const input = {
    prompt,
    aspectRatio,
    outputFormat: "png",
    ...getProviderExtraInput("IMAGE_INPUT"),
  };

  const taskId = await kieCreateTask(model, input);
  const url = await kieWaitForTask(taskId, 240_000, 3_000);
  const media = await downloadKieMedia(url);

  return {
    buffer: media.buffer,
    mimeType: media.mimeType,
    provider: "kie",
    model,
  };
}

async function generateWithOpenAI(
  prompt: string,
  sizeKey: ImageSizeKey
): Promise<ImageResult> {
  const size = IMAGE_SIZES[sizeKey] ?? IMAGE_SIZES.square;
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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
    model,
  };
}

async function generateWithZai(prompt: string, sizeKey: ImageSizeKey): Promise<ImageResult> {
  const size = IMAGE_SIZES[sizeKey] ?? IMAGE_SIZES.square;
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
