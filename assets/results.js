(() => {
  const CFG = window.AYED?.CONFIG;
  const Core = window.AYED?.Core;
  if(!CFG || !Core) return;

  const { $, $$, storage, toast, fillTemplate, shareText, baseUrl } = Core;

  function safe(v, fallback="—"){ return (v===undefined || v===null || v==="") ? fallback : v; }

  function formatDate(iso){
    try{
      const d = new Date(iso);
      return d.toLocaleString("ar-SA", { year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" });
    }catch(e){ return iso; }
  }

  function levelLabel(level){
    if(level==="متقدم") return "متقدم 🔥";
    if(level==="متوسط") return "متوسط ✅";
    if(level==="مبتدئ-متوسط") return "مبتدئ-متوسط 👌";
    return "مبتدئ 🌱";
  }

  function pickFocus(sectionScores){
    const sorted = sectionScores.slice().sort((a,b)=>a.pct-b.pct);
    const weak = sorted.slice(0,2).map(x=>x.section);
    const strong = sorted.slice(-1)[0]?.section;
    return { weak, strong };
  }

  function timelineInfo(code){
    switch(code){
      case "lt24": return { days: 1, title: "اختبارك خلال 24 ساعة" };
      case "lt3d": return { days: 3, title: "اختبارك خلال 3 أيام" };
      case "lt7d": return { days: 7, title: "اختبارك خلال أسبوع" };
      case "lt30d": return { days: 14, title: "اختبارك خلال شهر (نعطيك أول 14 يوم + نمط تكرار)" };
      default: return { days: 14, title: "لسه ما حجزت (خطة تأسيس 14 يوم + نصيحة للحجز)" };
    }
  }

  function normalizeWeights(sectionScores){
    // weight = (100 - pct) + 10
    const w = {};
    let sum = 0;
    sectionScores.forEach(s=>{
      const ww = (100 - s.pct) + 10;
      w[s.section] = ww;
      sum += ww;
    });
    return { w, sum };
  }

  function buildSchedule(profile, score){
    const t = timelineInfo(profile.examTimeline);
    const mins = Number(profile.minutesPerDay || 30);
    const sectionScores = score.sectionScores || [];
    const { w, sum } = normalizeWeights(sectionScores);

    const days = [];
    for(let d=1; d<=t.days; d++){
      const parts = [];

      // allocate minutes to each section
      const allocations = ["Grammar","Vocabulary","Reading","Listening"].map(sec=>{
        const m = Math.max(5, Math.round(mins * (w[sec] || 1) / sum));
        return { sec, m };
      });

      // tweak for very short timelines
      if(profile.examTimeline==="lt24"){
        // Make it more structured
        allocations.forEach(a=>{
          if(a.sec==="Listening") a.m = Math.max(8, Math.round(mins*0.15));
          if(a.sec==="Reading") a.m = Math.max(12, Math.round(mins*0.30));
          if(a.sec==="Grammar") a.m = Math.max(12, Math.round(mins*0.30));
          if(a.sec==="Vocabulary") a.m = Math.max(8, mins - (allocations.find(x=>x.sec==="Listening").m + allocations.find(x=>x.sec==="Reading").m + allocations.find(x=>x.sec==="Grammar").m));
        });
      }

      for(const a of allocations){
        const link = `./quiz.html?section=${encodeURIComponent(a.sec)}&count=10`;
        const label = ({
          Grammar: "قواعد",
          Vocabulary: "مفردات",
          Reading: "قراءة",
          Listening: "استماع"
        })[a.sec] || a.sec;

        const extra = (a.sec==="Reading")
          ? "قطعة قصيرة + أسئلة (ركز على main idea والكلمات)"
          : (a.sec==="Listening")
            ? "مقطع/نص + أسئلة (ركز على الفكرة العامة)"
            : (a.sec==="Vocabulary")
              ? "مرادفات/أضداد + مراجعة أخطاءك"
              : "If / ترتيب الجملة / أدوات الربط + تدريب مباشر";

        parts.push({
          sec: a.sec,
          label,
          minutes: a.m,
          text: `${label}: ${extra} — ${a.m} دقيقة`,
          link
        });
      }

      days.push({
        day: d,
        title: (profile.examTimeline==="lt24") ? "خطة اليوم" : `اليوم ${d}`,
        parts
      });
    }

    return { days, title: t.title, daysCount: t.days, minutesPerDay: mins };
  }

  function bookingAdvice(profile){
    const t = profile.examTimeline;
    if(t==="noBooking"){
      return "بما أنك لسه ما حجزت: ابدأ بخطة 14 يوم، وبعد ما توصل نسبة ثابتة (مثلاً 65%+ في الكويزات) احجز موعدك وأكمل خطة 7 أيام قبل الاختبار.";
    }
    if(t==="lt30d"){
      return "إذا اختبارك خلال شهر: الأفضل تمشي على نمط أسبوعين تركيز + أسبوعين تكرار (نفس الجدول) مع رفع عدد الكويزات تدريجيًا.";
    }
    if(t==="lt7d"){
      return "إذا اختبارك خلال أسبوع: ركّز على أضعف قسمين + حل كويز يومي، ولا تكثر مصادر.";
    }
    if(t==="lt3d"){
      return "إذا اختبارك خلال 3 أيام: خلك عملي — كويزات مركّزة + مراجعة الأخطاء فقط.";
    }
    return "إذا اختبارك خلال 24 ساعة: ركّز على الوقت، وتجنّب التشتت، وخلك على نقاطك الأضعف.";
  }

  function render(){
    const result = storage.get("last_result", null);
    if(!result){
      $("#noResult")?.style && ($("#noResult").style.display="block");
      $("#resultWrap")?.style && ($("#resultWrap").style.display="none");
      return;
    }

    const profile = result.profile || {};
    const score = result.score || {};
    const sectionScores = score.sectionScores || [];

    $("#rName").textContent = safe(profile.name);
    $("#rDate").textContent = formatDate(result.createdAt);
    $("#rPct").textContent = `${safe(score.pct, 0)}%`;
    $("#rLevel").textContent = levelLabel(safe(score.level, "مبتدئ"));

    // section bars
    const bars = $("#bars");
    bars.innerHTML = "";
    sectionScores.forEach(s=>{
      const row = document.createElement("div");
      row.className = "stat card";
      row.innerHTML = `
        <strong>${s.pct}%</strong>
        <span>${s.section} (${s.correct}/${s.total})</span>
        <div class="bar"><div style="width:${s.pct}%;"></div></div>
      `;
      bars.appendChild(row);
    });

    const focus = pickFocus(sectionScores);
    const focusText = `تركيزنا الأساسي: ${focus.weak.join(" + ")}.`;
    $("#focusText").textContent = focusText;

    // Advice + schedule
    $("#timelineTitle").textContent = timelineInfo(profile.examTimeline).title;
    $("#bookingAdvice").textContent = bookingAdvice(profile);

    const schedule = buildSchedule(profile, score);
    $("#scheduleSummary").textContent = `وقت يومي: ${schedule.minutesPerDay} دقيقة • مدة الخطة: ${schedule.daysCount} يوم`;

    const tbody = $("#scheduleBody");
    tbody.innerHTML = "";
    schedule.days.forEach(d=>{
      const tr = document.createElement("tr");
      const tasks = d.parts.map(p=>`• ${p.text}`).join("\n");
      tr.innerHTML = `<td><b>${d.title}</b></td><td style="white-space:pre-wrap">${tasks}</td>`;
      tbody.appendChild(tr);
    });

    // Buttons: Share plan
    $("#sharePlanBtn")?.addEventListener("click", async () => {
      const tpl = CFG.share.planTemplate;
      const txt = fillTemplate(tpl, {
        level: score.level,
        focus: focus.weak.join(" + "),
        minutes: schedule.minutesPerDay,
        url: baseUrl()
      });
      await shareText(txt);
    });

    // Copy plan text only
    $("#copyPlanBtn")?.addEventListener("click", async () => {
      const focusLine = `مستواي: ${score.level} | تركيزي: ${focus.weak.join(" + ")} | وقتي: ${schedule.minutesPerDay} دقيقة`;
      const txt = `${focusLine}\n\n${bookingAdvice(profile)}\n\nرابط البرنامج: ${baseUrl()}`;
      await Core.copyToClipboard(txt);
    });

    // PDF
    $("#pdfBtn")?.addEventListener("click", () => openPrint(result, schedule, focus));

    // Quick quiz
    $("#weakQuizBtn")?.addEventListener("click", () => {
      const sec = focus.weak[0] || "Grammar";
      window.location.href = `./quiz.html?section=${encodeURIComponent(sec)}&count=12`;
    });

    // Optional extra resources
    const extra = $("#extraBox");
    if(CFG.links.extraResourcesEnabled && CFG.links.extraResourcesUrl){
      extra.style.display = "block";
      $("#extraBtn").addEventListener("click", ()=> window.open(CFG.links.extraResourcesUrl, "_blank"));
    }else{
      extra.style.display = "none";
    }
  }

  function openPrint(result, schedule, focus){
    const profile = result.profile || {};
    const score = result.score || {};
    const url = baseUrl();

    const rows = schedule.days.map(d=>{
      const tasks = d.parts.map(p=>`<li>${p.text}</li>`).join("");
      return `<tr><td><b>${d.title}</b></td><td><ul style="margin:0; padding-right:18px;">${tasks}</ul></td></tr>`;
    }).join("");

    const html = `
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>جدول مذاكرة — ${profile.name || ""}</title>
<style>
  body{font-family: Arial, Tahoma, sans-serif; margin: 24px; color:#0B1220}
  .top{display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px}
  .logo{display:flex; align-items:center; gap:10px}
  .mark{width:44px;height:44px;border-radius:14px;background:#F6C343;display:grid;place-items:center}
  .mark span{font-weight:900}
  h1{margin:0;font-size:18px}
  small{color:#555}
  .box{border:1px solid #ddd; border-radius:14px; padding:14px; margin: 12px 0}
  table{width:100%; border-collapse:collapse; border:1px solid #ddd; border-radius:14px; overflow:hidden}
  th,td{border-bottom:1px solid #eee; padding:10px 10px; vertical-align:top; text-align:right}
  th{background:#FFF5D6}
  tr:last-child td{border-bottom:0}
  .footer{margin-top:14px; color:#666; font-size:12px}
  @media print{ .noprint{display:none} }
</style>
</head>
<body>
  <div class="top">
    <div class="logo">
      <div class="mark"><span>ع</span></div>
      <div>
        <h1>أكاديمية عايد الرسمية — جدول مذاكرة STEP</h1>
        <small>اسم الطالب: ${profile.name || "—"} • تاريخ الإنشاء: ${new Date(result.createdAt).toLocaleDateString("ar-SA")}</small>
      </div>
    </div>
    <div style="text-align:left">
      <small>رابط البرنامج:</small><br/>
      <b>${url}</b>
    </div>
  </div>

  <div class="box">
    <b>ملخص سريع</b>
    <div>مؤشر المستوى: <b>${score.level}</b> • النتيجة التدريبية: <b>${score.pct}%</b></div>
    <div>تركيز الخطة: <b>${focus.weak.join(" + ")}</b></div>
    <div style="margin-top:8px; color:#555">ملاحظة: هذا مؤشر تدريبي وليس درجة رسمية.</div>
  </div>

  <table>
    <thead><tr><th style="width:110px">اليوم</th><th>المهام</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    ﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾ • قال ﷺ: «احرص على ما ينفعك واستعن بالله ولا تعجز»
  </div>

  <div class="noprint" style="margin-top:14px">
    <button onclick="window.print()" style="padding:10px 12px;border-radius:12px;border:1px solid #ddd;background:#F6C343;font-weight:900;cursor:pointer">تحميل PDF (طباعة)</button>
    <small style="display:block;margin-top:8px;color:#666">اختر (Save as PDF) من نافذة الطباعة.</small>
  </div>
</body>
</html>
    `.trim();

    const w = window.open("", "_blank");
    if(!w){ toast("منع المتصفح فتح نافذة جديدة. جرّب مرة ثانية."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  document.addEventListener("DOMContentLoaded", render);
})();
