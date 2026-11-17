/**
 * إعدادات Zynth AI — قراءة متغيرات البيئة وحالة الميزات
 * لا تكشف قيم المفاتيح أبداً، فقط ما إذا كانت مضبوطة.
 */

export type ImageProvider = "kie" | "openai" | "zai";
export type VideoProvider = "kie" | "replicate";

export const IMAGE_SIZES = {
  square: "1024x1024",
  portrait: "768x1344",
  landscape: "1344x768",
  wide: "1440x720",
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

/** خرائط الأبعاد لكل مزوّد */
export const OPENAI_SIZE_MAP: Record<string, string> = {
  "1024x1024": "1024x1024",
  "768x1344": "1024x1536",
  "1344x768": "1536x1024",
  "1440x720": "1536x1024",
};

/** مطابقة أبعاد الصور إلى نسب العرض في kie.ai */
export const KIE_ASPECT_MAP: Record<ImageSizeKey, string> = {
  square: "1:1",
  portrait: "9:16",
  landscape: "16:9",
  wide: "16:9",
};

/** أولوية المزوّدين: kie.ai أولاً ثم OpenAI ثم المزوّد المدمج للمعاينة */
export function getImageProvider(): ImageProvider {
  if (process.env.KIE_API_KEY) return "kie";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "zai";
}

export function getVideoProvider(): VideoProvider | null {
  if (process.env.KIE_API_KEY) return "kie";
  if (process.env.REPLICATE_API_TOKEN) return "replicate";
  return null;
}

/** نموذج الصور (افتراضي: GPT Image 2.6 Flare عبر kie.ai) */
export function getImageModel(): string {
  return (
    process.env.IMAGE_MODEL ??
    process.env.KIE_IMAGE_MODEL ??
    "gpt-image-2-6/flare-text-to-image"
  );
}

/** نموذج الفيديو (افتراضي: Grok Imagine Video 1.5 Preview عبر kie.ai) */
export function getVideoModel(): string {
  return (
    process.env.VIDEO_MODEL ??
    process.env.KIE_VIDEO_MODEL ??
    "grok-imagine-video-1-5-preview"
  );
}

/** مدخلات إضافية اختيارية للمزوّد (JSON في متغير بيئة، مثل IMAGE_INPUT أو VIDEO_INPUT) */
export function getProviderExtraInput(envName: string): Record<string, unknown> {
  const raw = process.env[envName];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** مدخلات إضافية اختيارية لنموذج الفيديو (JSON في متغير البيئة VIDEO_INPUT) */
export function getVideoExtraInput(): Record<string, unknown> {
  return getProviderExtraInput("VIDEO_INPUT");
}

export function getFeatureFlags() {
  return {
    imageProvider: getImageProvider(),
    imageModel: getImageModel(),
    videoProvider: getVideoProvider(),
    videoModel: getVideoModel(),
    kie: Boolean(process.env.KIE_API_KEY),
    metricool: Boolean(
      process.env.METRICOOL_USER_TOKEN &&
        process.env.METRICOOL_USER_ID &&
        process.env.METRICOOL_BLOG_ID
    ),
    gptAuth: Boolean(process.env.ZYNTH_API_KEY),
    turso: Boolean(process.env.TURSO_DATABASE_URL?.startsWith("libsql://")),
  };
}

/** الحد الأقصى لتخزين ملف وسطي داخل قاعدة البيانات (48MB) */
export const MAX_STORE_BYTES = 48 * 1024 * 1024;
