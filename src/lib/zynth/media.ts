import { db } from "@/lib/db";
import type { Media } from "@prisma/client";
import { MAX_STORE_BYTES } from "./config";
import { downloadMedia, pollVideoJob } from "./providers/video";

export type MediaType = "image" | "video" | "merged_image" | "merged_video";

export interface PublicMedia {
  id: string;
  type: string;
  title: string | null;
  prompt: string | null;
  provider: string | null;
  status: string;
  mimeType: string | null;
  size: number | null;
  error: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
  meta: Record<string, unknown> | null;
}

/** يسلسل صف الوسيط للاستجابة العامة (بدون blob) */
export function serializeMedia(m: Media, baseUrl: string): PublicMedia {
  let meta: Record<string, unknown> | null = null;
  if (m.meta) {
    try {
      meta = JSON.parse(m.meta);
    } catch {
      meta = null;
    }
  }

  return {
    id: m.id,
    type: m.type,
    title: m.title,
    prompt: m.prompt,
    provider: m.provider,
    status: m.status,
    mimeType: m.mimeType,
    size: m.size,
    error: m.error,
    url: m.status === "completed" ? `${baseUrl}/api/media/${m.id}/file` : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    meta,
  };
}

export function createMedia(input: {
  type: MediaType;
  prompt?: string;
  provider?: string;
  providerJobId?: string;
  meta?: Record<string, unknown>;
}) {
  return db.media.create({
    data: {
      type: input.type,
      prompt: input.prompt,
      provider: input.provider,
      providerJobId: input.providerJobId,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      status: "processing",
    },
  });
}

export async function completeMedia(
  id: string,
  data: { buffer: Buffer; mimeType: string }
) {
  if (data.buffer.length > MAX_STORE_BYTES) {
    throw new Error(
      `حجم الملف يتجاوز حد التخزين (${Math.round(MAX_STORE_BYTES / 1024 / 1024)}MB)`
    );
  }
  return db.media.update({
    where: { id },
    data: {
      data: new Uint8Array(data.buffer),
      mimeType: data.mimeType,
      size: data.buffer.length,
      status: "completed",
      error: null,
    },
  });
}

export function failMedia(id: string, error: string) {
  return db.media.update({
    where: { id },
    data: { status: "failed", error: error.slice(0, 900) },
  });
}

/** مزامنة مهمة فيديو جارية (kie.ai أو Replicate) وتخزين الناتج عند الاكتمال */
export async function syncProcessingMedia(
  m: Media,
  baseUrl: string
): Promise<Media> {
  if (m.status !== "processing") return m;

  // مهام بدون providerJobId (توليد صور متزامن عالق) تُفشَل بعد ساعة
  const staleMs = Date.now() - m.updatedAt.getTime();
  if (!m.providerJobId && staleMs > 60 * 60 * 1000) {
    await failMedia(m.id, "انتهت مهلة المعالجة");
    return { ...m, status: "failed", error: "انتهت مهلة المعالجة" };
  }

  if (
    (m.provider === "replicate" || m.provider === "kie") &&
    m.providerJobId
  ) {
    const state = await pollVideoJob(m.providerJobId);
    if (state.status === "succeeded" && state.outputUrl) {
      try {
        const buffer = await downloadMedia(state.outputUrl);
        const updated = await completeMedia(m.id, {
          buffer,
          mimeType: "video/mp4",
        });
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await failMedia(m.id, msg);
        return { ...m, status: "failed", error: msg };
      }
    }
    if (state.status === "failed" || state.status === "canceled") {
      const msg = state.error ?? "فشلت مهمة التوليد";
      await failMedia(m.id, msg);
      return { ...m, status: "failed", error: msg };
    }
    // ما زالت قيد المعالجة — تُحدَّث وقت آخر تغيير لتفادي تصفير المهلة
    await db.media.update({ where: { id: m.id }, data: { updatedAt: new Date() } });
    return { ...m, updatedAt: new Date() };
  }

  return m;
}

export async function listMedia(options?: {
  types?: string[];
  limit?: number;
}): Promise<Media[]> {
  return db.media.findMany({
    where: options?.types?.length ? { type: { in: options.types } } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(options?.limit ?? 60, 120),
  });
}

export function getMediaRow(id: string) {
  return db.media.findUnique({ where: { id } });
}

export function deleteMediaRow(id: string) {
  return db.media.delete({ where: { id } });
}
