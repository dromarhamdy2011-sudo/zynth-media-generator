"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useZynthStore } from "@/lib/zynth/store";
import { CalendarClock, CheckCircle2, Loader2, Send, XCircle } from "lucide-react";

const NETWORKS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "pinterest", label: "Pinterest" },
  { id: "threads", label: "Threads" },
];

const TIMEZONES = [
  { value: "Asia/Riyadh", label: "الرياض (GMT+3)" },
  { value: "Asia/Dubai", label: "دبي (GMT+4)" },
  { value: "Asia/Amman", label: "عمّان (GMT+3)" },
  { value: "Africa/Cairo", label: "القاهرة (GMT+2)" },
  { value: "UTC", label: "UTC" },
];

interface Publication {
  id: string;
  mediaId: string;
  mediaType: string;
  networks: string[];
  caption: string | null;
  status: string;
  scheduledAt: string | null;
  error: string | null;
  createdAt: string;
}

export function PublishPanel() {
  const { toast } = useToast();
  const { media, features } = useZynthStore();

  const completed = useMemo(
    () => media.filter((m) => m.status === "completed"),
    [media]
  );

  const [mediaId, setMediaId] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [networks, setNetworks] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [timezone, setTimezone] = useState("Asia/Riyadh");
  const [publishing, setPublishing] = useState(false);
  const [history, setHistory] = useState<Publication[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/publications", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { publications: Publication[] };
        setHistory(json.publications ?? []);
      }
    } catch {
      // تجاهل
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function toggleNetwork(id: string) {
    setNetworks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handlePublish() {
    if (!mediaId) {
      toast({ title: "اختر وسيطاً للنشر", variant: "destructive" });
      return;
    }
    if (networks.length === 0) {
      toast({ title: "اختر شبكة اجتماعية واحدة على الأقل", variant: "destructive" });
      return;
    }
    if (!caption.trim()) {
      toast({ title: "اكتب نص المنشور", variant: "destructive" });
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          networks,
          caption: caption.trim(),
          scheduledAt: scheduleMode && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          timezone,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast({ title: "فشل النشر", description: json.error ?? "خطأ غير معروف", variant: "destructive" });
      } else {
        toast({
          title: scheduleMode ? "تمت الجدولة في Metricool" : "تم النشر في Metricool",
          description: `الشبكات: ${networks.map((n) => NETWORKS.find((x) => x.id === n)?.label ?? n).join("، ")}`,
        });
        setCaption("");
      }
      await loadHistory();
    } catch (err) {
      toast({ title: "خطأ في الاتصال", description: String(err), variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="size-5 text-primary" />
            النشر التلقائي عبر Metricool
          </CardTitle>
          <CardDescription>
            {features?.metricool
              ? "الحساب مضبوط — اختر وسيطاً مكتمل المحتوى، الشبكات، ونص المنشور."
              : "يتطلب: METRICOOL_USER_TOKEN و METRICOOL_USER_ID و METRICOOL_BLOG_ID في متغيرات البيئة."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الوسيط</Label>
              <Select value={mediaId} onValueChange={setMediaId}>
                <SelectTrigger aria-label="اختيار الوسيط">
                  <SelectValue placeholder={completed.length ? "اختر من المعرض" : "المعرض فارغ"} />
                </SelectTrigger>
                <SelectContent className="zynth-scroll max-h-64">
                  {completed.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {(m.type === "video" || m.type === "merged_video" ? "فيديو: " : "صورة: ") +
                        (m.prompt ?? m.id).slice(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المنطقة الزمنية</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger aria-label="المنطقة الزمنية">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>نص المنشور</Label>
            <Textarea
              placeholder="اكتب التعليق المرافق للمنشور... #ZynthAI"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>الشبكات الاجتماعية</Label>
            <div className="flex flex-wrap gap-2">
              {NETWORKS.map((n) => {
                const active = networks.includes(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => toggleNetwork(n.id)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {n.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Switch
              id="schedule-mode"
              checked={scheduleMode}
              onCheckedChange={setScheduleMode}
              aria-label="تفعيل الجدولة"
            />
            <Label htmlFor="schedule-mode" className="cursor-pointer">
              جدولة لوقت لاحق (بدون تفعيل: النشر الفوري)
            </Label>
          </div>

          {scheduleMode && (
            <div className="space-y-2">
              <Label htmlFor="schedule-at">موعد النشر</Label>
              <Input
                id="schedule-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={handlePublish}
            disabled={publishing || !features?.metricool}
            className="w-full"
            size="lg"
          >
            {publishing ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" />
                جارٍ الإرسال إلى Metricool...
              </>
            ) : scheduleMode ? (
              <>
                <CalendarClock className="me-2 size-4" />
                جدولة المنشور
              </>
            ) : (
              <>
                <Send className="me-2 size-4" />
                نشر الآن
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">سجل النشر</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد عمليات نشر بعد</p>
          ) : (
            <ul className="zynth-scroll max-h-72 space-y-3 overflow-y-auto pe-1">
              {history.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-sm leading-relaxed line-clamp-2">{p.caption}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.networks.join("، ")}
                      {p.scheduledAt &&
                        ` — ${new Date(p.scheduledAt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}`}
                    </p>
                    {p.error && <p className="text-xs text-destructive">{p.error}</p>}
                  </div>
                  {p.status === "scheduled" ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="size-5 shrink-0 text-destructive" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
