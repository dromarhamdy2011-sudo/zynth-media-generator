# Zynth AI — مولّد الوسائط السوريالية 🎨

منصة كاملة لتوليد الصور والفيديوهات السوريالية بالذكاء الاصطناعي، دمجها معاً،
ونشرها/جدولتها تلقائياً على شبكات التواصل عبر **Metricool** — بواجهة عربية RTL
وواجهات REST جاهزة للربط مع **ChatGPT (Custom GPT Actions)**.

## الميزات

| الميزة | الوصف | المزوّد |
| --- | --- | --- |
| توليد صور سوريالية | 1–4 صور لكل طلب، 4 أبعاد (مربع/عمودي/أفقي/عريض) | OpenAI Images (`gpt-image-2.5`) أو المزوّد المدمج للمعاينة |
| توليد فيديو سوريالي | مهام غير متزامنة مع تتبّع تلقائي للحالة | Replicate (`alibaba/wan-3` افتراضياً، قابل للتبديل) |
| دمج الصور | كولاج شبكي حتى 9 صور | sharp |
| دمج الفيديو | تسلسل حتى 6 مقاطع في ملف واحد | ffmpeg (نظامي أو `ffmpeg-static`) |
| النشر التلقائي | نشر فوري أو جدولة بتوقيت/منطقة زمنية محددة | Metricool API v2 |
| واجهات REST | مواصفة OpenAPI 3.1 جاهزة لاستيرادها في ChatGPT | `/api/openapi` |
| قاعدة بيانات | تخزين الوسائط والسجل | Turso (libSQL) / SQLite |

## البنية التقنية

- **Next.js 16 (App Router) + TypeScript** — واجهة صفحة واحدة + مسارات API
- **Tailwind CSS 4 + shadcn/ui** — تصميم داكن بنفسجي سوريالي، RTL كامل بخط Cairo
- **Prisma + @prisma/adapter-libsql** — نفس الكود يعمل مع Turso (إنتاج) و SQLite محلي (تطوير)
- **zustand** — حالة الواجهة، **zod** — التحقق، **sharp / ffmpeg** — الدمج

## هيكل المشروع

```
src/
├── app/
│   ├── page.tsx                    # لوحة التحكم (تبويبات: توليد/معرض/دمج/نشر/ربط)
│   └── api/
│       ├── health/route.ts         # فحص الجاهزية وحالة الميزات
│       ├── openapi/route.ts        # مواصفة OpenAPI لـ ChatGPT Actions
│       ├── generate/image/route.ts # POST — توليد صور
│       ├── generate/video/route.ts # POST — بدء توليد فيديو
│       ├── media/route.ts          # GET — القائمة (+ مزامنة المهام الجارية)
│       ├── media/[id]/route.ts     # GET/DELETE — تفاصيل/حذف
│       ├── media/[id]/file/…       # GET — تقديم الملف الخام (عام، لـ Metricool)
│       ├── merge/images/route.ts   # POST — كولاج
│       ├── merge/videos/route.ts   # POST — تسلسل فيديو
│       ├── publish/route.ts        # POST — نشر/جدولة عبر Metricool
│       └── publications/route.ts   # GET — سجل النشر
├── lib/zynth/
│   ├── config.ts  auth.ts  media.ts  metricool.ts  merge.ts  store.ts
│   └── providers/{image,video}.ts
└── components/zynth/               # مكوّنات الواجهة
scripts/setup-db.mjs                 # إنشاء جداول Turso بأمان (re-runnable)
prisma/schema.prisma                 # جدولا Media و Publication
```

## التشغيل المحلي

```bash
bun install
cp .env.example .env        # عدّل القيم إن رغبت (يعمل بدونها بوضع المعاينة)
npm run db:push             # إنشاء الجداول في SQLite المحلي
npm run dev                 # http://localhost:3000
```

بدون أي مفاتيح: توليد الصور يعمل عبر المزوّد المدمج، وبقية الميزات تُظهر رسائل
إرشادية واضحة عند الضبط الناقص.

## النشر على Vercel + Turso

1. **ارفع المستودع** إلى GitHub (مستودعك: `zynth-media-generator`):

   ```bash
   git remote add origin https://github.com/<اسم-حسابك>/zynth-media-generator.git
   git push -u origin main
   ```

2. **استورد المشروع في Vercel**: vercel.com/new → اختر المستودع → Framework:
   Next.js (يُكتشف تلقائياً).

3. **أضف متغيرات البيئة** في Vercel → Settings → Environment Variables
   (القائمة الكاملة مع الشرح في `.env.example`):

   | المتغير | ملاحظات |
   | --- | --- |
   | `TURSO_DATABASE_URL` | `libsql://...` من لوحة Turso |
   | `TURSO_AUTH_TOKEN` | توكن قاعدة البيانات |
   | `OPENAI_API_KEY` | توليد الصور |
   | `IMAGE_MODEL` | اختياري — افتراضي `gpt-image-2.5-sunburst` |
   | `REPLICATE_API_TOKEN` | توليد الفيديو |
   | `VIDEO_MODEL` | اختياري — افتراضي `alibaba/wan-3` |
   | `VIDEO_INPUT` | اختياري — JSON مدخلات إضافية للنموذج |
   | `METRICOOL_USER_TOKEN` | من Metricool → Settings → API |
   | `METRICOOL_USER_ID` | معرّف مستخدم Metricool |
   | `METRICOOL_BLOG_ID` | معرّف البراند (من رابط المتصفح في Metricool) |
   | `METRICOOL_USER_EMAIL` | اختياري |
   | `METRICOOL_TIMEZONE` | اختياري — افتراضي UTC |
   | `ZYNTH_API_KEY` | مفتاح حماية REST (ChatGPT Action) |
   | `PUBLIC_BASE_URL` | رابط Vercel النهائي — يُبنى منه رابط الوسائط للنشر |

4. **أنشئ الجداول في Turso مرة واحدة**:

   ```bash
   export TURSO_DATABASE_URL=libsql://...   # (على ويندوز: set)
   export TURSO_AUTH_TOKEN=...
   npm run db:setup:turso
   ```

5. ملاحظات مهمة:
   - الملفات المولّدة تُخزَّن داخل قاعدة البيانات (حتى ~48MB لكل وسيط). للملفات
     الأكبر أو الاستخدام المكثّف، التوصية بإضافة Vercel Blob لاحقاً.
   - دمج الفيديو يحتاج ffmpeg. على Vercel: `bun add ffmpeg-static` ويكفي عادةً
     (المسار يُكتشف تلقائياً)، أو استخدم خطة تدعم حِزم ffmpeg.

## الربط مع ChatGPT (Custom GPT Actions)

1. بعد النشر، انسخ رابط المواصفة:
   `https://<رابط-تطبيقك>/api/openapi`
2. ChatGPT → Explore GPTs → **Create** → Configure → **Actions** →
   **Import from URL** والصق الرابط.
3. المصادقة: **API Key** → Auth type: Custom → Header name:
   `x-api-key` → القيمة: `ZYNTH_API_KEY`.
4. في Instructions اقترح على الـ GPT: توليد الصور/الفيديو، متابعة الحالة عبر
   `getMedia` حتى `completed`، الدمج، ثم `publishMedia` للنشر.

حماية الواجهات: عند ضبط `ZYNTH_API_KEY` تُقبل الاتصالات الخارجية بالمفتاح فقط،
بينما تعمل لوحة التحكم (نفس النطاق) بلا مفتاح. مسار تقديم الملفات
`/api/media/{id}/file` عام بالتصميم (يدعم `<img>/<video>` ويحتاجه Metricool)،
ومعرّفات الوسائط غير قابلة للتخمين.

## مرجع واجهات REST

| المسار | الطريقة | الوظيفة |
| --- | --- | --- |
| `/api/health` | GET | الحالة والميزات المضبوطة |
| `/api/openapi` | GET | مواصفة OpenAPI 3.1 |
| `/api/generate/image` | POST | `{prompt, size, count}` → وسائط مكتملة |
| `/api/generate/video` | POST | `{prompt}` → وسيط `processing` |
| `/api/media` | GET | `?refresh=1&limit=60&types=…` |
| `/api/media/{id}` | GET / DELETE | التفاصيل (تزامن المهمة) / الحذف |
| `/api/media/{id}/file` | GET | الملف الخام (عام) |
| `/api/merge/images` | POST | `{ids:[2..9]}` → كولاج |
| `/api/merge/videos` | POST | `{ids:[2..6]}` → فيديو واحد |
| `/api/publish` | POST | `{mediaId, networks, caption, scheduledAt?, timezone?}` |
| `/api/publications` | GET | سجل النشر |

جميع المسارات (عدا `health` و `openapi` و `file`) تتحقق من
`x-api-key` عند ضبط `ZYNTH_API_KEY`.
