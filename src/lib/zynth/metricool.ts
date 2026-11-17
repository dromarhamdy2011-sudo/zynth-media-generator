/**
 * تكامل Metricool — جدولة/نشر المنشورات تلقائياً
 * Endpoint: POST https://app.metricool.com/api/v2/scheduler/posts
 * التوثيق: ?userId=<USER_ID>&blogId=<BLOG_ID> والترويسة X-Mc-Auth: <USER_TOKEN>
 */

export interface MetricoolScheduleInput {
  caption: string;
  networks: string[];
  mediaUrl?: string;
  scheduledAt?: Date;
  timezone?: string;
}

export interface MetricoolScheduleResult {
  refId?: string;
  raw: unknown;
}

export function isMetricoolConfigured(): boolean {
  return Boolean(
    process.env.METRICOOL_USER_TOKEN &&
      process.env.METRICOOL_USER_ID &&
      process.env.METRICOOL_BLOG_ID
  );
}

/** تنسيق التاريخ بصيغة ISO محلي بدون إزاحة نطاق زمني (كما تتطلب Metricool) */
function formatLocalIso(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;
}

export async function scheduleViaMetricool(
  input: MetricoolScheduleInput
): Promise<MetricoolScheduleResult> {
  if (!isMetricoolConfigured()) {
    throw new Error(
      "النشر عبر Metricool غير مضبوط. أضف METRICOOL_USER_TOKEN و METRICOOL_USER_ID و METRICOOL_BLOG_ID في متغيرات البيئة."
    );
  }

  const timezone = input.timezone || process.env.METRICOOL_TIMEZONE || "UTC";
  const when = input.scheduledAt ?? new Date();

  const body: Record<string, unknown> = {
    publicationDate: {
      dateTime: formatLocalIso(when, timezone),
      timezone,
    },
    text: input.caption,
    providers: input.networks.map((network) => ({ network })),
    autoPublish: true,
    draft: false,
    shortener: false,
    saveExternalMediaFiles: Boolean(input.mediaUrl),
    ...(input.mediaUrl ? { media: [input.mediaUrl] } : {}),
    ...(process.env.METRICOOL_USER_EMAIL
      ? { creatorUserMail: process.env.METRICOOL_USER_EMAIL }
      : {}),
  };

  const url =
    `https://app.metricool.com/api/v2/scheduler/posts` +
    `?userId=${encodeURIComponent(process.env.METRICOOL_USER_ID!)}` +
    `&blogId=${encodeURIComponent(process.env.METRICOOL_BLOG_ID!)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mc-Auth": process.env.METRICOOL_USER_TOKEN!,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `Metricool API (${res.status}): ${rawText.slice(0, 500) || "خطأ غير معروف"}`
    );
  }

  let raw: unknown = rawText;
  try {
    raw = JSON.parse(rawText);
  } catch {
    // استجابة نصية غير JSON — تُخزَّن كما هي
  }

  const refId =
    typeof raw === "object" && raw !== null
      ? ((raw as Record<string, unknown>).id as string | undefined) ??
        ((raw as Record<string, unknown>).postId as string | undefined)
      : undefined;

  return { refId, raw };
}

/** الشبكات المدعومة الشائعة في Metricool */
export const METRICOOL_NETWORKS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "pinterest", label: "Pinterest" },
  { id: "threads", label: "Threads" },
  { id: "bluesky", label: "Bluesky" },
] as const;
