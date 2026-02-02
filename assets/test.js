(() => {
  const CFG = window.AYED?.CONFIG;
  const Core = window.AYED?.Core;
  if(!CFG || !Core) return;

  const { $, $$, storage, toast, formatMs } = Core;

  const cooldownMs = (CFG.test.fullTestCooldownHours || 24) * 3600 * 1000;

  // Elements
  const wizard = $("#wizard");
  const steps = $$(".step-pane");
  const stepper = $("#stepper");
  const nextBtn = $("#nextStep");
  const prevBtn = $("#prevStep");
  const startBtn = $("#startTestBtn");
  const cooldownBox = $("#cooldownBox");
  const cooldownText = $("#cooldownText");

  const testShell = $("#testShell");
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
  const qNavGrid = $("#qNavGrid");

  const toggleInstantWizard = $("#toggleInstantWizard");
  const toggleExplainWizard = $("#toggleExplainWizard");
  const toggleInstantTest = $("#toggleInstantTest");
  const toggleExplainTest = $("#toggleExplainTest");

  let profile = {};
  let bank = null;

  // Test state
  let state = null; // { seed, questionIds, answers, idx, settings }
  let selected = []; // question objects

  // ----- Utils -----
  function now(){ return Date.now(); }

  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

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
    // Fisher-Yates
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  }

  function loadProfile(){
    return storage.get("profile", {});
  }
  function saveProfile(p){
    storage.set("profile", p);
  }

  function readForm(){
    const v = (id) => ($(id)?.value || "").trim();
    const checked = (name) => {
      const el = document.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : "";
    };
    const multi = (name) => $$( `input[name="${name}"]:checked`).map(x => x.value);

    const p = {
      name: v("#name"),
      goal: checked("goal"),
      region: v("#region"),
      heardFrom: checked("heardFrom"),
      purpose: checked("purpose"),
      examTimeline: checked("examTimeline"),
      minutesPerDay: Number(checked("minutesPerDay") || 30),
      preferredTime: checked("preferredTime"),
      workSchedule: checked("workSchedule"),
      educationStage: checked("educationStage"),
      universityDetails: v("#uniDetails"),
      major: v("#major"),
      learningStyle: checked("learningStyle"),
      weakGuess: checked("weakGuess"),
      triedBefore: checked("triedBefore"),
      previousScore: Number(v("#previousScore") || 0),
      targetScore: Number(v("#targetScore") || 0),
      previousCourses: multi("previousCourses"),
      coursePain: v("#coursePain"),
      notes: v("#notes")
    };

    // Basic validation fallback
    if(!p.name) p.name = "صديقنا";
    if(!p.examTimeline) p.examTimeline = "noBooking";
    if(!p.minutesPerDay) p.minutesPerDay = 30;
    return p;
  }

  function showStep(i){
    steps.forEach((s,idx) => s.style.display = (idx===i ? "block" : "none"));
    const pills = $$(".step");
    pills.forEach((p,idx) => p.classList.toggle("active", idx===i));
    prevBtn.style.display = (i===0 ? "none" : "inline-flex");
    nextBtn.style.display = (i===steps.length-1 ? "none" : "inline-flex");
    startBtn.style.display = (i===steps.length-1 ? "inline-flex" : "none");
  }

  function initStepper(){
    if(!stepper) return;
    const labels = ["بياناتك", "موعدك", "تفضيلاتك", "خلفيتك", "جاهز؟"];
    stepper.innerHTML = labels.map((t,idx)=>`<span class="step ${idx===0?'active':''}">${t}</span>`).join("");
  }

  function cooldownRemaining(){
    const last = storage.get("last_full_test_at", 0);
    if(!last) return 0;
    const rem = (last + cooldownMs) - now();
    return rem > 0 ? rem : 0;
  }

  function updateCooldownUI(){
    const rem = cooldownRemaining();
    if(rem <= 0){
      if(cooldownBox) cooldownBox.style.display = "none";
      if(startBtn) startBtn.disabled = false;
      return;
    }
    if(cooldownBox) cooldownBox.style.display = "block";
    if(cooldownText) cooldownText.textContent = `تقدر تسوي الاختبار الكامل بعد: ${formatMs(rem)} (محاولة واحدة كل 24 ساعة)`;
    if(startBtn) startBtn.disabled = true;
  }

  async function loadBank(){
    if(bank) return bank;
    const res = await fetch("./assets/questions.json", { cache: "no-store" });
    const j = await res.json();
    bank = j.questions || [];
    return bank;
  }

  function chooseQuestions(all, quotas, seed){
    const rng = mulberry32(seed);

    // Difficulty preference based on last score
    const last = storage.get("last_result", null);
    let minD = 2, maxD = 4;
    if(last?.score?.pct >= 80){ minD = 3; maxD = 5; }
    else if(last?.score?.pct <= 40){ minD = 1; maxD = 3; }

    const within = (q) => (q.difficulty>=minD && q.difficulty<=maxD);

    const chosen = [];
    for(const [section, count] of Object.entries(quotas)){
      const pool = all.filter(q => q.section === section && within(q));
      const pick = pickRandom(pool.length?pool:all.filter(q=>q.section===section), count, rng);
      chosen.push(...pick);
    }
    // Shuffle overall
    return pickRandom(chosen, chosen.length, rng);
  }

  function persistState(){
    storage.set("current_test_state", state);
  }

  function clearState(){
    storage.del("current_test_state");
  }

  function loadState(){
    return storage.get("current_test_state", null);
  }

  function renderNav(){
    if(!qNavGrid) return;
    qNavGrid.innerHTML = "";
    for(let i=0;i<selected.length;i++){
      const btn = document.createElement("button");
      btn.type="button";
      btn.className = "qn";
      btn.textContent = String(i+1);
      btn.addEventListener("click", ()=> goTo(i));
      qNavGrid.appendChild(btn);
    }
    updateNavStyles();
  }

  function updateNavStyles(){
    const btns = $$(".qn", qNavGrid);
    btns.forEach((b,i)=>{
      b.classList.toggle("current", i===state.idx);
      const a = state.answers[i];
      const q = selected[i];
      const instant = state.settings.instantCheck;
      b.classList.toggle("answered", a!==null && a!==undefined && (instant ? a===q.correctIndex : true));
      b.classList.toggle("wrong", instant && a!==null && a!==undefined && a!==q.correctIndex);
    });
  }

  function setProgress(){
    const pct = Math.round(((state.idx+1)/selected.length)*100);
    if(progressBar) progressBar.style.width = pct + "%";
  }

  function syncToggles(){
    if(toggleInstantTest) toggleInstantTest.checked = !!state.settings.instantCheck;
    if(toggleExplainTest) toggleExplainTest.checked = !!state.settings.showExplain;
  }

  function renderQuestion(){
    const q = selected[state.idx];
    if(!q) return;

    syncToggles();

    if(qMeta) qMeta.innerHTML = `<small>سؤال ${state.idx+1} من ${selected.length}</small> <span class="badge"><span class="dot"></span>${q.section} • ${q.topic}</span>`;
    if(qPrompt) qPrompt.textContent = q.prompt;

    optionsWrap.innerHTML = "";
    feedback.classList.remove("show");

    const answered = state.answers[state.idx];
    const instant = state.settings.instantCheck;
    const showExplain = state.settings.showExplain;

    q.options.forEach((opt, optIdx) => {
      const btn = document.createElement("button");
      btn.type="button";
      btn.className="opt";
      btn.textContent = opt;
      btn.disabled = answered!==null && answered!==undefined; // lock after answer
      btn.addEventListener("click", ()=> chooseAnswer(optIdx));
      optionsWrap.appendChild(btn);
    });

    // If answered, show selection and feedback
    if(answered!==null && answered!==undefined){
      const optBtns = $$(".opt", optionsWrap);
      const correctIdx = q.correctIndex;
      optBtns.forEach((b,i)=>{
        if(i===correctIdx) b.classList.add("correct");
        if(i===answered && answered!==correctIdx) b.classList.add("wrong");
      });
      if(instant){
        showFeedback(answered===correctIdx, q, showExplain);
      }
    }

    prevQBtn.disabled = state.idx===0;
    nextQBtn.disabled = (state.answers[state.idx]===null || state.answers[state.idx]===undefined) ? true : false;
    finishBtn.style.display = (state.idx===selected.length-1 ? "inline-flex" : "none");
    nextQBtn.style.display = (state.idx===selected.length-1 ? "none" : "inline-flex");

    setProgress();
    updateNavStyles();
    persistState();
  }

  function showFeedback(isCorrect, q, showExplain){
    feedback.classList.add("show");
    if(isCorrect){
      fbTitle.textContent = `✅ صحيح يا ${profile.name}`;
      fbDesc.textContent = showExplain ? q.explain_ar : "ممتاز! كمل على نفس التركيز.";
    }else{
      const correct = q.options[q.correctIndex];
      fbTitle.textContent = `❌ مو مشكلة يا ${profile.name}`;
      fbDesc.textContent = showExplain ? `الجواب الصحيح: ${correct}\n\n${q.explain_ar}` : `الجواب الصحيح: ${correct}`;
    }
  }

  function chooseAnswer(optIdx){
    const q = selected[state.idx];
    const instant = state.settings.instantCheck;
    const showExplain = state.settings.showExplain;

    state.answers[state.idx] = optIdx;

    // Update option styles
    const optBtns = $$(".opt", optionsWrap);
    optBtns.forEach((b,i)=>{
      b.disabled = true;
      if(i===q.correctIndex) b.classList.add("correct");
      if(i===optIdx && optIdx!==q.correctIndex) b.classList.add("wrong");
    });

    if(instant){
      showFeedback(optIdx===q.correctIndex, q, showExplain);
    }

    nextQBtn.disabled = false;
    updateNavStyles();
    persistState();
  }

  function goTo(i){
    state.idx = clamp(i, 0, selected.length-1);
    renderQuestion();
  }

  function next(){
    if(state.idx < selected.length-1){
      state.idx++;
      renderQuestion();
    }
  }

  function prev(){
    if(state.idx > 0){
      state.idx--;
      renderQuestion();
    }
  }

  function computeScore(){
    let correct=0;
    const bySection = {};
    selected.forEach((q,i)=>{
      const a = state.answers[i];
      const ok = (a!==null && a!==undefined && a===q.correctIndex);
      if(ok) correct++;
      bySection[q.section] = bySection[q.section] || { total:0, correct:0 };
      bySection[q.section].total++;
      if(ok) bySection[q.section].correct++;
    });
    const total = selected.length;
    const pct = Math.round((correct/total)*100);

    const sectionScores = Object.entries(bySection).map(([k,v])=>({
      section:k, pct: Math.round((v.correct/v.total)*100), ...v
    })).sort((a,b)=>a.pct-b.pct);

    const weak = sectionScores.slice(0,2).map(x=>x.section);

    let level = "مبتدئ";
    if(pct >= 80) level = "متقدم";
    else if(pct >= 60) level = "متوسط";
    else if(pct >= 40) level = "مبتدئ-متوسط";

    return { total, correct, pct, bySection, weak, level, sectionScores };
  }

  function finish(){
    const score = computeScore();
    const result = {
      id: now(),
      createdAt: new Date().toISOString(),
      seed: state.seed,
      profile,
      questionIds: state.questionIds,
      answers: state.answers,
      score,
      note: "هذه نتيجة تدريبية (مؤشر مستوى) وليست درجة رسمية."
    };

    const hist = storage.get("results_history", []);
    hist.unshift(result);
    storage.set("results_history", hist.slice(0, 25));
    storage.set("last_result", result);

    storage.set("last_full_test_at", now());

    clearState();
    toast("تم حفظ نتيجتك ✅");
    window.setTimeout(()=> window.location.href = "./results.html", 250);
  }

  function startNewTest(){
    const rem = cooldownRemaining();
    if(rem>0){
      toast("الاختبار الكامل محاولة واحدة كل 24 ساعة. سوّي كويزات لين يفتح لك 👌");
      return;
    }

    profile = readForm();
    saveProfile(profile);

    const seed = now();
    loadBank().then(all=>{
      selected = chooseQuestions(all, CFG.test.sectionQuotas, seed);
      state = {
        seed,
        questionIds: selected.map(q=>q.id),
        answers: Array(selected.length).fill(null),
        idx: 0,
        settings: {
          instantCheck: toggleInstantWizard ? toggleInstantWizard.checked : true,
          showExplain: toggleExplainWizard ? toggleExplainWizard.checked : true
        }
      };
      persistState();
      beginTestUI();
    }).catch(()=>{
      toast("تعذر تحميل بنك الأسئلة. تأكد من رفع الملفات صح.");
    });
  }

  function resumeExisting(existing){
    profile = storage.get("profile", readForm());
    state = existing;

    loadBank().then(all=>{
      const map = new Map(all.map(q=>[q.id,q]));
      selected = existing.questionIds.map(id=>map.get(id)).filter(Boolean);
      if(!selected.length){
        toast("ملفات الأسئلة تغيرت — بنبدأ اختبار جديد.");
        clearState();
        return;
      }
      while(state.answers.length < selected.length) state.answers.push(null);

      // Ensure toggles sync
      beginTestUI(true);
    });
  }

  function beginTestUI(isResume=false){
    if(wizard) wizard.style.display = "none";
    if(testShell) testShell.style.display = "grid";
    if(isResume) toast("تم استكمال محاولتك السابقة ✅");
    renderNav();
    renderQuestion();
  }

  // ----- Events -----
  function init(){
    initStepper();
    let stepIdx = 0;
    showStep(stepIdx);

    nextBtn && nextBtn.addEventListener("click", () => {
      profile = readForm();
      saveProfile(profile);
      stepIdx = clamp(stepIdx+1, 0, steps.length-1);
      showStep(stepIdx);
    });
    prevBtn && prevBtn.addEventListener("click", () => {
      stepIdx = clamp(stepIdx-1, 0, steps.length-1);
      showStep(stepIdx);
    });

    const edu = $$('input[name="educationStage"]');
    edu.forEach(r => r.addEventListener("change", () => {
      const show = document.querySelector('input[name="educationStage"]:checked')?.value === "university";
      const box = $("#uniBox");
      if(box) box.style.display = show ? "block" : "none";
    }));

    const tried = $$('input[name="triedBefore"]');
    tried.forEach(r => r.addEventListener("change", () => {
      const v = document.querySelector('input[name="triedBefore"]:checked')?.value;
      const box = $("#scoresBox");
      if(box) box.style.display = (v==="yes") ? "grid" : "none";
    }));

    startBtn && startBtn.addEventListener("click", startNewTest);

    // Test toggles
    toggleInstantTest && toggleInstantTest.addEventListener("change", () => {
      if(state){
        state.settings.instantCheck = toggleInstantTest.checked;
        persistState();
        renderQuestion();
      }
    });
    toggleExplainTest && toggleExplainTest.addEventListener("change", () => {
      if(state){
        state.settings.showExplain = toggleExplainTest.checked;
        persistState();
        renderQuestion();
      }
    });

    nextQBtn && nextQBtn.addEventListener("click", next);
    prevQBtn && prevQBtn.addEventListener("click", prev);
    finishBtn && finishBtn.addEventListener("click", finish);

    const saved = loadProfile();
    if(saved?.name) $("#name").value = saved.name;

    const existing = loadState();
    if(existing && existing.questionIds && existing.answers){
      const resumeBox = $("#resumeBox");
      if(resumeBox) resumeBox.style.display = "block";
      $("#resumeYes")?.addEventListener("click", () => resumeExisting(existing));
      $("#resumeNo")?.addEventListener("click", () => { clearState(); toast("تم بدء إعداد جديد"); });
    }

    updateCooldownUI();
    window.setInterval(updateCooldownUI, 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
