/**
 * إعدادات Zynth AI — قراءة متغيرات البيئة وحالة الميزات
 * لا تكشف قيم المفاتيح أبداً، فقط ما إذا كانت مضبوطة.
 */

export type ImageProvider = "openai" | "zai";

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

export function getImageProvider(): ImageProvider {
  return process.env.OPENAI_API_KEY ? "openai" : "zai";
}

export function getImageModel(): string {
  return process.env.IMAGE_MODEL ?? "gpt-image-2.5-sunburst";
}

export function getVideoModel(): string {
  return process.env.VIDEO_MODEL ?? "alibaba/wan-3";
}

/** مدخلات إضافية اختيارية لنموذج الفيديو (JSON في متغير البيئة VIDEO_INPUT) */
export function getVideoExtraInput(): Record<string, unknown> {
  if (!process.env.VIDEO_INPUT) return {};
  try {
    const parsed = JSON.parse(process.env.VIDEO_INPUT);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function getFeatureFlags() {
  return {
    imageProvider: getImageProvider(),
    imageModel: getImageModel(),
    videoProvider: process.env.REPLICATE_API_TOKEN ? "replicate" : null,
    videoModel: getVideoModel(),
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
