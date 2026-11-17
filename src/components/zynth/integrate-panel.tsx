"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useZynthStore } from "@/lib/zynth/store";
import { Bot, CheckCircle2, Cloud, Copy, KeyRound, ListOrdered, XCircle } from "lucide-react";

function CopyBox({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      {label && <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>}
      <pre className="zynth-scroll overflow-x-auto rounded-lg border border-border bg-black/40 p-3 text-xs leading-relaxed" dir="ltr">
        <code>{text}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        aria-label="نسخ"
        className="absolute end-2 top-8 rounded-md bg-white/10 p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Copy className="size-4" />
      </button>
      {copied && (
        <span className="absolute end-2 bottom-2 rounded bg-emerald-600 px-2 py-0.5 text-[10px] text-white">
          تم النسخ
        </span>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
        {n}
      </span>
      <div className="space-y-2 pb-4">{children}</div>
    </div>
  );
}

export function IntegratePanel() {
  const { features } = useZynthStore();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* حالة الإعداد */}
      <Card className="backdrop-blur-sm lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListOrdered className="size-5 text-primary" />
            حالة الإعداد الحالية
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="gap-1.5 py-1.5">
            {features?.turso ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-amber-400" />}
            قاعدة Turso
          </Badge>
          <Badge variant="secondary" className="gap-1.5 py-1.5">
            {features?.imageProvider === "openai" ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-amber-400" />}
            مفاتيح توليد الصور (OpenAI)
          </Badge>
          <Badge variant="secondary" className="gap-1.5 py-1.5">
            {features?.videoProvider ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-amber-400" />}
            توليد الفيديو (Replicate)
          </Badge>
          <Badge variant="secondary" className="gap-1.5 py-1.5">
            {features?.metricool ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-amber-400" />}
            Metricool
          </Badge>
          <Badge variant="secondary" className="gap-1.5 py-1.5">
            {features?.gptAuth ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-amber-400" />}
            مفتاح ChatGPT Action
          </Badge>
        </CardContent>
      </Card>

      {/* ربط Vercel */}
      <Card className="backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cloud className="size-5 text-primary" />
            الربط مع Vercel
          </CardTitle>
          <CardDescription>نشر المشروع من مستودع GitHub إلى Vercel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <Step n={1} title="ارفع الكود إلى مستودعك">
            <CopyBox
              label="نفّذ هذه الأوامر داخل مجلد المشروع"
              text={`git remote add origin https://github.com/<اسم-حسابك>/zynth-media-generator.git\ngit push -u origin main`}
            />
          </Step>
          <Step n={2} title="استورد المشروع في Vercel">
            <p className="text-muted-foreground">
              vercel.com/new → اختر مستودع <span className="font-mono">zynth-media-generator</span> →
              Framework: Next.js (يُكتشف تلقائياً).
            </p>
          </Step>
          <Step n={3} title="أضف متغيرات البيئة">
            <p className="text-muted-foreground">
              في صفحة الإعدادات → Environment Variables، أضف المتغيرات الموجودة في ملف{" "}
              <span className="font-mono">.env.example</span> (Turso، OpenAI، Replicate، Metricool، ZYNTH_API_KEY،
              PUBLIC_BASE_URL برابط Vercel النهائي).
            </p>
          </Step>
          <Step n={4} title="انشر (Deploy) ثم فعّل جداول قاعدة البيانات">
            <p className="text-muted-foreground">
              بعد أول نشر، أنشئ الجداول في Turso مرة واحدة:
            </p>
            <CopyBox label="من مجلد المشروع محلياً" text={`set TURSO_DATABASE_URL=libsql://...  # رابط قاعدتك\nset TURSO_AUTH_TOKEN=...       # توكن قاعدتك\nnpm run db:setup:turso`} />
            <p className="text-xs text-muted-foreground">
              (على لينكس/ماك استخدم export بدل set). السكربت ينشئ الجداول بأمان دون مساس بالبيانات.
            </p>
          </Step>
        </CardContent>
      </Card>

      {/* ربط ChatGPT */}
      <Card className="backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="size-5 text-primary" />
            الربط مع ChatGPT (Custom GPT)
          </CardTitle>
          <CardDescription>حوّل ChatGPT إلى مساعد يولّد وينشر نيابة عنك</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <Step n={1} title="افتح مواصفة الـ API">
            <p className="text-muted-foreground">
              بعد النشر، هذه الروابط جاهزة (استبدل الرابط برابط Vercel أو المعاينة الحالية):
            </p>
            <CopyBox text={`${typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/openapi`} />
          </Step>
          <Step n={2} title="أنشئ GPT خاصاً">
            <p className="text-muted-foreground">
              chat.openai.com → Explore GPTs → Create → Configure → Actions → «Import from URL»
              والصق رابط المواصفة أعلاه.
            </p>
          </Step>
          <Step n={3} title="اضبط المصادقة">
            <p className="text-muted-foreground">
              في Actions → Authentication اختر «API Key» → Auth type:{" "}
              <span className="font-mono">Custom</span> → Header name:{" "}
              <span className="font-mono">x-api-key</span> → API Key: قيمة{" "}
              <span className="font-mono">ZYNTH_API_KEY</span> التي ضبطتها في Vercel.
            </p>
          </Step>
          <Step n={4} title="تعليمات الـ GPT">
            <CopyBox
              label="الصق هذا في حقل Instructions"
              text={`أنت مساعد Zynth AI. عند طلب المستخدم:\n- صورة سوريالية: استدعِ generateImage ثم اعرض الرابط من url.\n- فيديو: استدعِ generateVideo ثم تحقق كل 20 ثانية عبر getMedia حتى تصبح الحالة completed ثم اعرض url.\n- دمج: استدعِ mergeImages أو mergeVideos بمعرّفات الوسائط المطلوبة.\n- نشر: استدعِ publishMedia مع networks المناسبة واقترح caption جذاب.\nأجب دائماً بالعربية وباختصار.`}
            />
          </Step>
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            <p>
              إن لم تضبط <span className="font-mono">ZYNTH_API_KEY</span> فالواجهة تعمل بدون مفتاح
              (وضع مفتوح). يُنصح بضبطه قبل ربط ChatGPT حتى لا يستطيع أحد غيره استخدام حسابك.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
