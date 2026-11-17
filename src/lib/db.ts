import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * طبقة قاعدة البيانات لـ Zynth AI
 * - في الإنتاج: يتصل بـ Turso عبر TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 * - في التطوير المحلي: يستخدم ملف SQLite عبر DATABASE_URL (fallback تلقائي)
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;

  if (tursoUrl && tursoUrl.startsWith("libsql://")) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter, log: ["error"] });
  }

  // وضع التطوير المحلي: SQLite ملفي
  return new PrismaClient({
    log: ["error"],
    datasources: { db: { url: process.env.DATABASE_URL ?? "file:./db/custom.db" } },
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export const usingTurso = Boolean(
  process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
);
