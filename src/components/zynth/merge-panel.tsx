"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useZynthStore } from "@/lib/zynth/store";
import { Film, ImagePlus, Loader2, Scissors, X } from "lucide-react";

export function MergePanel() {
  const { toast } = useToast();
  const { media, selectedIds, clearSelection, refresh } = useZynthStore();

  const selected = media.filter((m) => selectedIds.includes(m.id));
  const images = selected.filter((m) => m.type.includes("image") && m.status === "completed");
  const videos = selected.filter((m) => m.type.includes("video") && m.status === "completed");

  const [imgMerging, setImgMerging] = useState(false);
  const [vidMerging, setVidMerging] = useState(false);

  async function merge(kind: "images" | "videos") {
    const ids = (kind === "images" ? images : videos).map((m) => m.id);
    if (ids.length < 2) {
      toast({
        title: "تحديد غير كافٍ",
        description: "اختر عنصرين على الأقل من المعرض عبر زر الدائرة على كل بطاقة",
        variant: "destructive",
      });
      return;
    }
    if (kind === "images") {
      setImgMerging(true);
    } else {
      setVidMerging(true);
    }
    try {
      const res = await fetch(`/api/merge/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast({ title: "فشل الدمج", description: json.error ?? "خطأ غير معروف", variant: "destructive" });
      } else {
        toast({ title: "تم الدمج بنجاح", description: "الناتج متاح الآن في المعرض" });
        clearSelection();
      }
      await refresh({ silent: true });
    } catch (err) {
      toast({ title: "خطأ في الاتصال", description: String(err), variant: "destructive" });
    } finally {
      if (kind === "images") {
        setImgMerging(false);
      } else {
        setVidMerging(false);
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card className="backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scissors className="size-5 text-primary" />
            دمج الوسائط
          </CardTitle>
          <CardDescription>
            حدّد وسائط من المعرض (زر الدائرة أعلى كل بطاقة) ثم ادمجها: صور إلى كولاج، أو
            مقاطع إلى فيديو واحد.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-sm">
              المحدد: {selectedIds.length}
            </Badge>
            {selectedIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="me-1 size-4" />
                إلغاء التحديد
              </Button>
            )}
          </div>

          {selected.length > 0 && (
            <div className="zynth-scroll flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border p-3">
              {selected.map((m) =>
                m.type.startsWith("image") && m.url ? (
                  <img
                    key={m.id}
                    src={m.url}
                    alt={m.prompt ?? "وسيط محدد"}
                    className="size-16 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div
                    key={m.id}
                    className="flex size-16 items-center justify-center rounded-md border border-border bg-black/30"
                  >
                    <Film className="size-6 text-muted-foreground" />
                  </div>
                )
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="bg-card/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImagePlus className="size-4 text-primary" />
                  دمج كولاج صور ({images.length})
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يدمج 2–9 صور محددة في شبكة واحدة. يلزم صورتان مكتملتان على الأقل.
                </p>
                <Button
                  onClick={() => merge("images")}
                  disabled={imgMerging || images.length < 2}
                  className="w-full"
                >
                  {imgMerging ? <Loader2 className="me-2 size-4 animate-spin" /> : <ImagePlus className="me-2 size-4" />}
                  دمج الصور
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Film className="size-4 text-primary" />
                  دمج مقاطع فيديو ({videos.length})
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يدمج 2–6 مقاطع محددة في مقطع واحد متسلسل عبر ffmpeg. يلزم مقطعان مكتملان على الأقل.
                </p>
                <Button
                  onClick={() => merge("videos")}
                  disabled={vidMerging || videos.length < 2}
                  className="w-full"
                >
                  {vidMerging ? <Loader2 className="me-2 size-4 animate-spin" /> : <Film className="me-2 size-4" />}
                  دمج الفيديو
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
