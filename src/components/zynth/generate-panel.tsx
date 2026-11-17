"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useZynthStore } from "@/lib/zynth/store";
import { ImageIcon, Loader2, Sparkles, VideoIcon, Wand2 } from "lucide-react";

const SIZE_OPTIONS = [
  { value: "square", label: "مربع 1:1" },
  { value: "portrait", label: "عمودي 9:16" },
  { value: "landscape", label: "أفقي 16:9" },
  { value: "wide", label: "عريض 2:1" },
];

const IMAGE_IDEAS = [
  "مدينة عائمة فوق السحاب وقت الغروب، جبال زجاجية مذابة، إضاءة ذهبية سوريالية",
  "غابة كتب طائرة بين الأشجار، ضباب بنفسجي، نجوم تتساقط ببطء",
  "حوت ضخم يسبح في سماء الصحراء فوق كثبان رملية، قمر عملاق",
  "سلالم لا نهائية تتشابك في الفضاء مع ساعات ذائبة، أسلوب دالي",
];

const VIDEO_IDEAS = [
  "كاميرا تتحرك ببطء عبر بوابة ضوئية تفتح على مدينة سوريالية عائمة، حركة سينمائية",
  "زهرة كريستالية تتفتح في الفضاء محررة سديم ملون، إضاءة درامية",
];

export function GeneratePanel() {
  const { toast } = useToast();
  const { refresh, features } = useZynthStore();

  // توليد الصور
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgSize, setImgSize] = useState("square");
  const [imgCount, setImgCount] = useState(1);
  const [imgLoading, setImgLoading] = useState(false);

  // توليد الفيديو
  const [vidPrompt, setVidPrompt] = useState("");
  const [vidLoading, setVidLoading] = useState(false);

  async function handleGenerateImage() {
    if (!imgPrompt.trim()) {
      toast({ title: "اكتب وصفاً للصورة أولاً", variant: "destructive" });
      return;
    }
    setImgLoading(true);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt.trim(), size: imgSize, count: imgCount }),
      });
      const json = await res.json();
      if (!res.ok && !json.media) {
        toast({ title: "فشل التوليد", description: json.error ?? "خطأ غير معروف", variant: "destructive" });
      } else {
        const ok = (json.media ?? []).filter((m: { status: string }) => m.status === "completed").length;
        toast({
          title: ok > 0 ? `تم توليد ${ok} صورة` : "فشل التوليد",
          description: ok > 0 ? "ستجدها في تبويب المعرض" : (json.errors?.[0]?.error ?? undefined),
          variant: ok > 0 ? "default" : "destructive",
        });
        if (ok > 0) setImgPrompt("");
      }
      await refresh({ silent: true });
    } catch (err) {
      toast({ title: "خطأ في الاتصال", description: String(err), variant: "destructive" });
    } finally {
      setImgLoading(false);
    }
  }

  async function handleGenerateVideo() {
    if (!vidPrompt.trim()) {
      toast({ title: "اكتب وصفاً للفيديو أولاً", variant: "destructive" });
      return;
    }
    setVidLoading(true);
    try {
      const res = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: vidPrompt.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast({ title: "تعذّر بدء التوليد", description: json.error ?? "خطأ غير معروف", variant: "destructive" });
      } else {
        toast({
          title: "بدأ توليد الفيديو",
          description: "تتبّع الحالة في تبويب المعرض — التحديث يجري تلقائياً",
        });
        setVidPrompt("");
      }
      await refresh({ silent: true });
    } catch (err) {
      toast({ title: "خطأ في الاتصال", description: String(err), variant: "destructive" });
    } finally {
      setVidLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* توليد الصور */}
      <Card className="backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="size-5 text-primary" />
            توليد صورة سوريالية
          </CardTitle>
          <CardDescription>
            مزوّد الصور الحالي:{" "}
            <span className="font-semibold text-primary">
              {features?.imageProvider === "openai"
                ? `OpenAI (${features?.imageModel})`
                : "المزوّد المدمج (معاينة)"}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="img-prompt">الوصف النصي (Prompt)</Label>
            <Textarea
              id="img-prompt"
              placeholder="مثال: مدينة عائمة فوق السحاب مع جبال زجاجية مذابة وقت الغروب..."
              value={imgPrompt}
              onChange={(e) => setImgPrompt(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {IMAGE_IDEAS.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImgPrompt(idea)}
                  className="text-xs rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Sparkles className="me-1 inline size-3" />
                  فكرة {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الأبعاد</Label>
              <Select value={imgSize} onValueChange={setImgSize}>
                <SelectTrigger aria-label="أبعاد الصورة">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عدد الصور: {imgCount}</Label>
              <div className="flex h-10 items-center px-2">
                <Slider
                  value={[imgCount]}
                  min={1}
                  max={4}
                  step={1}
                  onValueChange={([v]) => setImgCount(v)}
                  aria-label="عدد الصور"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleGenerateImage} disabled={imgLoading} className="w-full" size="lg">
            {imgLoading ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" />
                جارٍ التوليد...
              </>
            ) : (
              <>
                <Wand2 className="me-2 size-4" />
                توليد الصور
              </>
            )}
          </Button>
          {imgLoading && <Progress value={66} className="h-1" />}
        </CardContent>
      </Card>

      {/* توليد الفيديو */}
      <Card className="backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <VideoIcon className="size-5 text-primary" />
            توليد فيديو سوريالي
          </CardTitle>
          <CardDescription>
            المزوّد:{" "}
            <span className="font-semibold text-primary">
              {features?.videoProvider
                ? `Replicate (${features?.videoModel})`
                : "يتطلب REPLICATE_API_TOKEN"}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vid-prompt">الوصف النصي (Prompt)</Label>
            <Textarea
              id="vid-prompt"
              placeholder="مثال: كاميرا تتحرك عبر بوابة ضوئية نحو مدينة عائمة، حركة سينمائية بطيئة..."
              value={vidPrompt}
              onChange={(e) => setVidPrompt(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {VIDEO_IDEAS.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setVidPrompt(idea)}
                  className="text-xs rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Sparkles className="me-1 inline size-3" />
                  فكرة {i + 1}
                </button>
              ))}
            </div>
          </div>

          {!features?.videoProvider && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
              توليد الفيديو يتطلب مفتاح Replicate. أضف{" "}
              <code className="rounded bg-black/30 px-1">REPLICATE_API_TOKEN</code> في متغيرات
              البيئة (محلياً في .env أو في Vercel) ثم أعد المحاولة. بقية الميزات تعمل الآن.
            </p>
          )}

          <Button onClick={handleGenerateVideo} disabled={vidLoading} className="w-full" size="lg">
            {vidLoading ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" />
                جارٍ البدء...
              </>
            ) : (
              <>
                <VideoIcon className="me-2 size-4" />
                بدء توليد الفيديو
              </>
            )}
          </Button>
          {vidLoading && <Progress value={33} className="h-1" />}
          <p className="text-xs leading-relaxed text-muted-foreground">
            الفيديو يُولَّد بشكل غير متزامن (قد يستغرق دقيقة إلى ثلاث دقائق). الحالة تتحدث
            تلقائياً في المعرض حتى اكتمال المقطع.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
