# أكاديمية عايد الرسمية — برنامج تحديد مستوى STEP (موقع + PWA)

هذا مشروع موقع ثابت (Static) يعمل بدون سيرفر، وقابل للتثبيت كتطبيق (PWA) على الجوال/الكمبيوتر.

## أهم الملفات
- `index.html` الصفحة الرئيسية
- `test.html` اختبار 50 سؤال (تحديد مستوى)
- `results.html` النتيجة + التحليل + الخطة + جدول PDF
- `quiz.html` إنشاء كويزات قابلة للمشاركة
- `progress.html` سجل النتائج السابقة
- `support.html` الدعم (حفظ محلي)
- `assets/questions.json` بنك الأسئلة (580+ سؤال تدريبي)
- `assets/site-data.js` إعدادات النصوص والرسائل والروابط (أهم ملف للتعديل)
- `sw.js` Service Worker (لعمل التطبيق Offline)
- `manifest.json` إعدادات التثبيت (PWA)

## تعديل الاسم/الشعار/النصوص بسرعة
افتح: `assets/site-data.js`
- عدّل `academyName`, `appName`, `tagline`
- عدّل رسائل المشاركة `share.*`
- عدّل رسائل المساعد `assistant.*`

## بنك الأسئلة
الأسئلة موجودة في: `assets/questions.json`
- كل سؤال له: `section`, `topic`, `difficulty`, `prompt`, `options`, `correctIndex`, `explain_ar`
- تقدر تضيف أو تعدل أو تستبدل بالكامل.

> ملاحظة: الأسئلة هنا تدريبية للتعلم وليست أسئلة رسمية لأي اختبار.

## رفع الموقع (اختيارات سهلة)
### 1) GitHub Pages
1. أنشئ مستودع جديد على GitHub.
2. ارفع كل الملفات داخل المستودع.
3. من Settings → Pages:
   - Source: Deploy from a branch
   - Branch: `main` + folder `/root`
4. افتح رابط الصفحات.

### 2) Netlify (الأسرع)
1. افتح netlify.com
2. اسحب مجلد المشروع كامل (Drag & Drop) على Netlify
3. يعطيك رابط مباشر.

### 3) Vercel
1. ارفع المشروع في GitHub
2. اربطه مع Vercel
3. Deploy.

## ملاحظة عن الخصوصية
النتائج والخطة تُحفظ على الجهاز فقط باستخدام LocalStorage.
صفحة الدعم تسجل الرسالة محليًا كذلك لأنها نسخة بدون سيرفر.
