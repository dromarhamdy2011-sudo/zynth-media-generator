"use client";

import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { GeneratePanel } from "@/components/zynth/generate-panel";
import { GalleryPanel } from "@/components/zynth/gallery-panel";
import { MergePanel } from "@/components/zynth/merge-panel";
import { PublishPanel } from "@/components/zynth/publish-panel";
import { IntegratePanel } from "@/components/zynth/integrate-panel";
import { useZynthStore } from "@/lib/zynth/store";
import { Bot, Images, Layers, Send, Sparkles, Wand2 } from "lucide-react";

const POLL_INTERVAL_MS = 5000;

export default function Home() {
  const { refresh, media, processing, selectedIds, features } = useZynthStore();

  // تحميل أولي + اقتراع دوري أثناء وجود مهام قيد المعالجة
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (processing === 0) return;
    const timer = setInterval(() => refresh({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [processing, refresh]);

  return (
    <div className="dark zynth-bg flex min-h-screen flex-col">
      {/* الرأس */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-black/30 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
              <Sparkles className="size-6 text-white" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Zynth AI</h1>
              <p className="text-xs text-muted-foreground">
                مولّد الوسائط السوريالية — صور وفيديوهات، دمج، ونشر تلقائي
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Wand2 className="size-3.5 text-primary" />
              {media.length} وسيط
            </Badge>
            {processing > 0 && (
              <Badge className="animate-pulse gap-1.5 bg-primary text-primary-foreground">
                {processing} قيد التوليد
              </Badge>
            )}
            {selectedIds.length > 0 && (
              <Badge variant="outline" className="border-primary/60 text-primary">
                محدد: {selectedIds.length}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* المحتوى */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Tabs defaultValue="generate" dir="rtl">
          <TabsList className="zynth-scroll mb-6 flex w-full justify-start gap-1 overflow-x-auto sm:justify-center">
            <TabsTrigger value="generate" className="gap-1.5">
              <Wand2 className="size-4" />
              التوليد
            </TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1.5">
              <Images className="size-4" />
              المعرض
            </TabsTrigger>
            <TabsTrigger value="merge" className="gap-1.5">
              <Layers className="size-4" />
              الدمج
            </TabsTrigger>
            <TabsTrigger value="publish" className="gap-1.5">
              <Send className="size-4" />
              النشر
            </TabsTrigger>
            <TabsTrigger value="integrate" className="gap-1.5">
              <Bot className="size-4" />
              الربط
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            <GeneratePanel />
          </TabsContent>
          <TabsContent value="gallery">
            <GalleryPanel />
          </TabsContent>
          <TabsContent value="merge">
            <MergePanel />
          </TabsContent>
          <TabsContent value="publish">
            <PublishPanel />
          </TabsContent>
          <TabsContent value="integrate">
            <IntegratePanel />
          </TabsContent>
        </Tabs>
      </main>

      {/* التذييل (لاصق أسفل الشاشة) */}
      <footer className="mt-auto border-t border-border/60 bg-black/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <p>
            Zynth AI — ميديا جينريتور سوريالي · مزوّد الصور:{" "}
            {features?.imageProvider === "openai" ? "OpenAI" : "مدمج (معاينة)"}
          </p>
          <p>
            واجهات REST: <code className="rounded bg-white/10 px-1">/api/openapi</code> جاهزة
            لـ ChatGPT Actions
          </p>
        </div>
      </footer>
    </div>
  );
}
