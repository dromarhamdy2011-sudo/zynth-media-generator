import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const CELL = 768;
const BG = "#0a0a12";
const FFMPEG_TIMEOUT_MS = 240_000;

/** شبكة كولاج من صور (sharp) — تُستخدم لميزة "الدمج" */
export async function collageImages(buffers: Uint8Array[]): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  if (buffers.length === 0) throw new Error("لا توجد صور للدمج");
  if (buffers.length > 9) throw new Error("الحد الأقصى 9 وسائط للدمج في المرة");

  const cols = Math.ceil(Math.sqrt(buffers.length));
  const rows = Math.ceil(buffers.length / cols);

  const cells = await Promise.all(
    buffers.map((buf) =>
      sharp(buf)
        .resize(CELL, CELL, { fit: "contain", background: BG })
        .png()
        .toBuffer()
    )
  );

  const composite = cells.map((input, i) => ({
    input,
    left: (i % cols) * CELL,
    top: Math.floor(i / cols) * CELL,
  }));

  return sharp({
    create: {
      width: cols * CELL,
      height: rows * CELL,
      channels: 3,
      background: BG,
    },
  })
    .png()
    .composite(composite)
    .toBuffer();
}

/** البحث عن ffmpeg: النظام أولاً ثم ffmpeg-static إن وُجد */
async function resolveFfmpeg(): Promise<string> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 10_000 });
    return "ffmpeg";
  } catch {
    try {
      const mod = await import("ffmpeg-static");
      const bin = (mod as { default?: string }).default;
      if (bin) return bin;
    } catch {
      // غير مثبّت
    }
  }
  throw new Error(
    "ffmpeg غير متاح في هذه البيئة. على Vercel ثبّت ffmpeg-static (bun add ffmpeg-static) أو استخدم بيئة تدعم ffmpeg."
  );
}

/** دمج مقاطع فيديو في ملف واحد (ffmpeg concat) */
export async function concatVideos(buffers: Uint8Array[]): Promise<Buffer> {
  if (buffers.length < 2) throw new Error("يلزم مقطعان على الأقل لدمج الفيديو");
  if (buffers.length > 6) throw new Error("الحد الأقصى 6 مقاطع للدمج في المرة");

  const ffmpeg = await resolveFfmpeg();
  const workDir = await mkdtemp(path.join(tmpdir(), "zynth-merge-"));
  const outFile = path.join(workDir, "out.mp4");
  const listFile = path.join(workDir, "list.txt");

  try {
    const inputs: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const file = path.join(workDir, `in_${i}.mp4`);
      await writeFile(file, buffers[i]);
      inputs.push(`file '${file}'`);
    }
    await writeFile(listFile, inputs.join("\n") + "\n");

    // محاولة أولى: نسخ مباشر بدون إعادة ترميز (أسرع)
    let copyOk = true;
    try {
      await execFileAsync(
        ffmpeg,
        [
          "-y", "-hide_banner", "-loglevel", "error",
          "-f", "concat", "-safe", "0",
          "-i", listFile,
          "-c", "copy",
          "-movflags", "+faststart",
          outFile,
        ],
        { timeout: FFMPEG_TIMEOUT_MS }
      );
    } catch {
      copyOk = false;
    }

    // محاولة ثانية: إعادة ترميز موحّدة (تتعامل مع اختلاف الترميزات والأبعاد)
    if (!copyOk) {
      await execFileAsync(
        ffmpeg,
        [
          "-y", "-hide_banner", "-loglevel", "error",
          "-f", "concat", "-safe", "0",
          "-i", listFile,
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
          "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart",
          "-fflags", "+genpts",
          outFile,
        ],
        { timeout: FFMPEG_TIMEOUT_MS }
      );
    }

    return await readFile(outFile);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
