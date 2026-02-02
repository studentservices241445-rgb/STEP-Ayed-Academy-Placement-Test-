(() => {
  const CFG = window.AYED?.CONFIG;
  const Core = window.AYED?.Core;
  if(!CFG || !Core) return;

  const { $, $$, toast, fillTemplate, shareText } = Core;

  const form = $("#quizForm");
  const startBtn = $("#quizStart");
  const shareBtn = $("#quizShare");
  const linkBox = $("#quizLink");

  const shell = $("#quizShell");
  const qPrompt = $("#qPrompt");
  const qMeta = $("#qMeta");
  const optionsWrap = $("#optionsWrap");
  const feedback = $("#feedback");
  const fbTitle = $("#fbTitle");
  const fbDesc = $("#fbDesc");
  const nextQBtn = $("#nextQBtn");
  const prevQBtn = $("#prevQBtn");
  const finishBtn = $("#finishBtn");
  const progressBar = $("#progressBarInner");

  const toggleExplain = $("#toggleExplain");

  let bank = null;
  let quiz = null;

  function mulberry32(seed){
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickRandom(arr, n, rng){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  }

  function parseParams(){
    const p = new URLSearchParams(location.search);
    return {
      section: p.get("section") || "",
      count: Number(p.get("count") || 10),
      difficulty: Number(p.get("difficulty") || 0),
      seed: Number(p.get("seed") || 0),
      topic: p.get("topic") || ""
    };
  }

  async function loadBank(){
    if(bank) return bank;
    const res = await fetch("./assets/questions.json", { cache: "no-store" });
    const j = await res.json();
    bank = j.questions || [];
    return bank;
  }

  function currentConfig(){
    const section = $("#qSection").value;
    const count = Number($("#qCount").value || 10);
    const difficulty = Number($("#qDiff").value || 0);
    const topic = ($("#qTopic").value || "").trim();
    return { section, count, difficulty, topic };
  }

  function buildLink(cfg, seed){
    const p = new URLSearchParams();
    p.set("section", cfg.section);
    p.set("count", String(cfg.count));
    if(cfg.difficulty) p.set("difficulty", String(cfg.difficulty));
    if(cfg.topic) p.set("topic", cfg.topic);
    p.set("seed", String(seed));
    return `./quiz.html?${p.toString()}`;
  }

  function startWith(cfg, seed){
    loadBank().then(all=>{
      const rng = mulberry32(seed);
      let pool = all.filter(q => q.section === cfg.section);
      if(cfg.topic){
        pool = pool.filter(q => (q.topic || "").toLowerCase().includes(cfg.topic.toLowerCase()));
      }
      if(cfg.difficulty){
        pool = pool.filter(q => q.difficulty >= cfg.difficulty);
      }
      if(pool.length < cfg.count){
        toast("عدد الأسئلة المتاحة أقل من المطلوب… بنكمّل من نفس القسم.");
        pool = all.filter(q => q.section === cfg.section);
      }

      const selected = pickRandom(pool, cfg.count, rng);
      quiz = {
        cfg, seed,
        items: selected,
        answers: Array(selected.length).fill(null),
        idx: 0,
        correct: 0
      };
      shell.style.display = "grid";
      form.style.display = "none";
      updateShareLink();
      render();
    }).catch(()=>{
      toast("تعذر تحميل بنك الأسئلة.");
    });
  }

  function updateShareLink(){
    if(!quiz) return;
    const url = buildLink(quiz.cfg, quiz.seed);
    linkBox.value = new URL(url, location.href).href;
  }

  function setProgress(){
    const pct = Math.round(((quiz.idx+1)/quiz.items.length)*100);
    progressBar.style.width = pct + "%";
  }

  function render(){
    const q = quiz.items[quiz.idx];
    if(!q) return;

    qMeta.innerHTML = `<small>سؤال ${quiz.idx+1} من ${quiz.items.length}</small> <span class="badge"><span class="dot"></span>${q.section} • ${q.topic}</span>`;
    qPrompt.textContent = q.prompt;

    optionsWrap.innerHTML = "";
    feedback.classList.remove("show");

    const answered = quiz.answers[quiz.idx];

    q.options.forEach((opt, optIdx)=>{
      const btn = document.createElement("button");
      btn.type="button";
      btn.className="opt";
      btn.textContent = opt;
      btn.disabled = answered!==null && answered!==undefined;
      btn.addEventListener("click", ()=> chooseAnswer(optIdx));
      optionsWrap.appendChild(btn);
    });

    if(answered!==null && answered!==undefined){
      const correctIdx = q.correctIndex;
      const optBtns = $$(".opt", optionsWrap);
      optBtns.forEach((b,i)=>{
        if(i===correctIdx) b.classList.add("correct");
        if(i===answered && answered!==correctIdx) b.classList.add("wrong");
      });
      showFeedback(answered===correctIdx, q);
    }

    prevQBtn.disabled = quiz.idx===0;
    nextQBtn.disabled = (answered===null || answered===undefined);
    finishBtn.style.display = (quiz.idx===quiz.items.length-1 ? "inline-flex" : "none");
    nextQBtn.style.display = (quiz.idx===quiz.items.length-1 ? "none" : "inline-flex");

    setProgress();
  }

  function showFeedback(isCorrect, q){
    feedback.classList.add("show");
    const showExplain = toggleExplain.checked;

    if(isCorrect){
      fbTitle.textContent = "✅ صحيح";
      fbDesc.textContent = showExplain ? q.explain_ar : "ممتاز!";
    }else{
      const correct = q.options[q.correctIndex];
      fbTitle.textContent = "❌ غلط";
      fbDesc.textContent = showExplain ? `الجواب الصحيح: ${correct}\n\n${q.explain_ar}` : `الجواب الصحيح: ${correct}`;
    }
  }

  function chooseAnswer(optIdx){
    const q = quiz.items[quiz.idx];
    quiz.answers[quiz.idx] = optIdx;

    const optBtns = $$(".opt", optionsWrap);
    optBtns.forEach((b,i)=>{
      b.disabled = true;
      if(i===q.correctIndex) b.classList.add("correct");
      if(i===optIdx && optIdx!==q.correctIndex) b.classList.add("wrong");
    });

    if(optIdx===q.correctIndex) quiz.correct++;
    showFeedback(optIdx===q.correctIndex, q);

    nextQBtn.disabled = false;
  }

  function next(){
    if(quiz.idx < quiz.items.length-1){
      quiz.idx++;
      render();
    }
  }
  function prev(){
    if(quiz.idx > 0){
      quiz.idx--;
      render();
    }
  }

  function finish(){
    const pct = Math.round((quiz.correct/quiz.items.length)*100);
    toast(`نتيجتك في الكويز: ${pct}% ✅`);
    // Show summary
    $("#quizSummary").style.display="block";
    $("#quizSummaryText").textContent = `أجبت صح على ${quiz.correct} من ${quiz.items.length} (${pct}%).`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function init(){
    // populate topic hints based on section
    const topic = $("#qTopic");
    $("#qSection").addEventListener("change", ()=>{
      const sec = $("#qSection").value;
      topic.placeholder = (sec==="Grammar") ? "مثال: Conditionals / Punctuation / Word Order"
                      : (sec==="Vocabulary") ? "مثال: Synonym / Antonym"
                      : (sec==="Reading") ? "مثال: Inflation / Tourism / Volcanoes"
                      : "مثال: Telescope / Flight Booking";
    });

    startBtn.addEventListener("click", ()=>{
      const cfg = currentConfig();
      const seed = Date.now();
      startWith(cfg, seed);
    });

    shareBtn.addEventListener("click", async ()=>{
      if(!quiz){
        toast("ابدأ كويز أولاً");
        return;
      }
      const url = linkBox.value || location.href;
      const txt = fillTemplate(CFG.share.quizTemplate, {
        section: quiz.cfg.section,
        count: quiz.cfg.count,
        url
      });
      await shareText(txt);
    });

    $("#copyQuizLink").addEventListener("click", async ()=>{
      await Core.copyToClipboard(linkBox.value);
    });

    nextQBtn.addEventListener("click", next);
    prevQBtn.addEventListener("click", prev);
    finishBtn.addEventListener("click", finish);

    // Auto start from URL params
    const p = parseParams();
    if(p.section){
      $("#qSection").value = p.section;
      $("#qCount").value = String(p.count || 10);
      if(p.difficulty) $("#qDiff").value = String(p.difficulty);
      if(p.topic) $("#qTopic").value = p.topic;
      const seed = p.seed || Date.now();
      startWith({ section: p.section, count: p.count || 10, difficulty: p.difficulty || 0, topic: p.topic || "" }, seed);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
