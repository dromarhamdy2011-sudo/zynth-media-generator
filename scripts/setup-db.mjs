#!/usr/bin/env node
/**
 * إعداد جداول قاعدة البيانات لـ Zynth AI
 * يعمل مباشرة عبر @libsql/client — يدعم Turso (libsql://) و SQLite المحلي (file:)
 *
 * الاستخدام:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/setup-db.mjs
 * أو مع npm script:
 *   npm run db:setup:turso
 *
 * آمن للتنفيذ المتكرر: يستخدم CREATE TABLE IF NOT EXISTS فقط.
 */

import { createClient } from "@libsql/client";

const url =
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "file:./db/custom.db";

const authToken = url.startsWith("libsql://")
  ? process.env.TURSO_AUTH_TOKEN
  : undefined;

if (url.startsWith("libsql://") && !authToken) {
  console.error("✗ TURSO_AUTH_TOKEN مطلوب عند استخدام رابط Turso");
  process.exit(1);
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "prompt" TEXT,
    "provider" TEXT,
    "providerJobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "mimeType" TEXT,
    "size" INTEGER,
    "data" BLOB,
    "sourceUrl" TEXT,
    "meta" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaId" TEXT NOT NULL,
    "networks" TEXT NOT NULL,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledAt" DATETIME,
    "timezone" TEXT,
    "providerRef" TEXT,
    "response" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Publication_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Media_type_status_idx" ON "Media" ("type", "status")`,
  `CREATE INDEX IF NOT EXISTS "Media_createdAt_idx" ON "Media" ("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Publication_mediaId_idx" ON "Publication" ("mediaId")`,
];

async function main() {
  console.log(`• الاتصال بقاعدة البيانات: ${url.replace(/libsql:\/\/([^.]*)\./, "libsql://***.")}`);
  const client = createClient({ url, authToken });

  for (const stmt of DDL) {
    await client.execute(stmt);
  }

  // تحقق سريع
  const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = res.rows.map((r) => r.name).join(", ");
  console.log(`✓ الجداول جاهزة: ${tables}`);
  client.close();
}

main().catch((err) => {
  console.error("✗ فشل الإعداد:", err.message);
  process.exit(1);
});
