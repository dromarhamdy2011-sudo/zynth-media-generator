"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useZynthStore, type PublicMedia } from "@/lib/zynth/store";
import { CheckCircle2, Circle, Film, ImageIcon, Layers, Loader2, Trash2 } from "lucide-react";

function typeLabel(type: string): string {
  switch (type) {
    case "image":
      return "صورة";
    case "video":
      return "فيديو";
    case "merged_image":
      return "كولاج";
    case "merged_video":
      return "فيديو مدمج";
    default:
      return type;
  }
}

function MediaCard({ media }: { media: PublicMedia }) {
  const { toast } = useToast();
  const { selectedIds, toggleSelect, removeMedia } = useZynthStore();
  const selected = selectedIds.includes(media.id);

  async function handleDelete() {
    try {
      const res = await fetch(`/api/media/${media.id}`, { method: "DELETE" });
      if (res.ok) {
        removeMedia(media.id);
        toast({ title: "تم حذف الوسيط" });
      } else {
        toast({ title: "فشل الحذف", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    }
  }

  return (
    <Card className="overflow-hidden group">
      <div className="relative aspect-square bg-black/40">
        {media.status === "completed" && media.type.includes("image") && media.url && (
          <img
            src={media.url}
            alt={media.prompt ?? "صورة مولّدة"}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
        {media.status === "completed" && media.type.includes("video") && media.url && (
          <video
            src={media.url}
            controls
            playsInline
            className="size-full object-contain"
            preload="metadata"
          />
        )}
        {media.status === "processing" && (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-sm">جارٍ التوليد...</span>
          </div>
        )}
        {media.status === "failed" && (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-sm font-semibold text-destructive">فشل التوليد</span>
            <span className="text-xs leading-relaxed text-muted-foreground line-clamp-4">
              {media.error}
            </span>
          </div>
        )}

        {/* زر التحديد للدمج/النشر */}
        {media.status === "completed" && (
          <button
            type="button"
            onClick={() => toggleSelect(media.id)}
            aria-label={selected ? "إلغاء التحديد" : "تحديد للدمج أو النشر"}
            className="absolute top-2 end-2 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          >
            {selected ? (
              <CheckCircle2 className="size-5 text-primary" />
            ) : (
              <Circle className="size-5 opacity-70" />
            )}
          </button>
        )}

        <Badge className="absolute top-2 start-2 bg-black/60 text-white border-0" variant="secondary">
          {media.type.includes("video") ? (
            <Film className="me-1 size-3" />
          ) : (
            <ImageIcon className="me-1 size-3" />
          )}
          {typeLabel(media.type)}
        </Badge>
      </div>
      <CardContent className="p-3 space-y-2">
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 min-h-8">
          {media.prompt ?? "—"}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/70">
            {new Date(media.createdAt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            aria-label="حذف"
            className="size-7 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function GalleryPanel() {
  const { media, loading, loaded } = useZynthStore();

  if (!loaded && loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="me-2 size-5 animate-spin" />
        جارٍ التحميل...
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
        <Layers className="size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          المعرض فارغ — ابدأ بتوليد صورة أو فيديو من تبويب التوليد
        </p>
      </div>
    );
  }

  return (
    <div className="zynth-scroll grid max-h-[560px] gap-4 overflow-y-auto pe-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {media.map((m) => (
        <MediaCard key={m.id} media={m} />
      ))}
    </div>
  );
}
