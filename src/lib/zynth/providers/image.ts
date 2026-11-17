import { getImageModel, getImageProvider, IMAGE_SIZES, OPENAI_SIZE_MAP, type ImageSizeKey } from "../config";

export interface ImageResult {
  buffer: Buffer;
  mimeType: string;
  provider: string;
  model: string;
}

/**
 * توليد صورة سوريالية من وصف نصي.
 * - الإنتاج (OPENAI_API_KEY مضبوط): OpenAI Images API — gpt-image-2.5
 * - المعاينة/التطوير: z-ai-web-dev-sdk (يعمل بدون مفاتيح)
 */
export async function generateImage(
  prompt: string,
  sizeKey: ImageSizeKey = "square"
): Promise<ImageResult> {
  const size = IMAGE_SIZES[sizeKey] ?? IMAGE_SIZES.square;

  if (getImageProvider() === "openai") {
    return generateWithOpenAI(prompt, size);
  }
  return generateWithZai(prompt, size);
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
