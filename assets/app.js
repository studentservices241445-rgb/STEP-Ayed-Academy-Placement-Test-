/* Core UI + helpers */
(() => {
  const CFG = (window.AYED && window.AYED.CONFIG) ? window.AYED.CONFIG : null;
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const storage = {
    prefix: "ayed_step_free_",
    get(key, fallback=null){
      try{
        const v = localStorage.getItem(this.prefix + key);
        return v ? JSON.parse(v) : fallback;
      }catch(e){ return fallback; }
    },
    set(key, value){
      try{ localStorage.setItem(this.prefix + key, JSON.stringify(value)); }catch(e){}
    },
    del(key){
      try{ localStorage.removeItem(this.prefix + key); }catch(e){}
    }
  };

  function baseUrl(){
    // Base folder URL (works on GitHub Pages project sites too)
    return new URL("./", window.location.href).href;
  }

  function fillTemplate(tpl, vars){
    return tpl.replace(/\{\{(\w+)\}\}/g, (_,k) => (vars[k] ?? ""));
  }

  function toast(message){
    const wrap = $("#toastWrap");
    if(!wrap) return;
    const box = $("#toastBox");
    const txt = $("#toastText");
    if(!box || !txt) return;
    txt.textContent = message;
    box.classList.add("show");
    // auto hide
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => box.classList.remove("show"), 5200);
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      toast("تم النسخ ✅");
      return true;
    }catch(e){
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position="fixed";
      ta.style.left="-9999px";
      document.body.appendChild(ta);
      ta.select();
      try{
        document.execCommand("copy");
        toast("تم النسخ ✅");
        return true;
      }catch(err){
        toast("ما قدرنا ننسخ — انسخ يدويًا 🙏");
        return false;
      }finally{
        document.body.removeChild(ta);
      }
    }
  }

  async function shareText(text){
    if(navigator.share){
      try{
        await navigator.share({ text });
        return true;
      }catch(e){
        // user cancelled
        return false;
      }
    }
    return copyToClipboard(text);
  }

  function formatMs(ms){
    ms = Math.max(0, ms);
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const ss = s%60;
    if(h>0) return `${h}س ${m}د`;
    if(m>0) return `${m}د ${ss}ث`;
    return `${ss}ث`;
  }

  function setActiveNav(){
    const path = window.location.pathname.split("/").pop() || "index.html";
    $$("[data-nav]").forEach(a => {
      if(a.getAttribute("href") && a.getAttribute("href").includes(path)){
        a.style.background = "rgba(246,195,67,.18)";
        a.style.borderColor = "rgba(246,195,67,.55)";
      }
    });
  }

  // Drawer
  function setupDrawer(){
    const menuBtn = $("#menuBtn");
    const drawer = $("#drawer");
    const backdrop = $("#drawerBackdrop");
    const closeBtn = $("#drawerClose");
    if(!menuBtn || !drawer || !backdrop) return;

    const open = () => { drawer.classList.add("open"); backdrop.classList.add("open"); };
    const close = () => { drawer.classList.remove("open"); backdrop.classList.remove("open"); };

    menuBtn.addEventListener("click", open);
    backdrop.addEventListener("click", close);
    closeBtn && closeBtn.addEventListener("click", close);
    $$("#drawer a").forEach(a => a.addEventListener("click", close));
  }

  // FAQ accordion
  function setupAccordion(){
    $$(".accordion .item button").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".item");
        if(!item) return;
        item.classList.toggle("open");
      });
    });
  }

  // Toast rotation (tips)
  function setupToasts(){
    if(!CFG) return;
    const page = document.body.getAttribute("data-page") || "";
    if(CFG.test?.disableToastsOnTest && page === "test") return;

    const msgs = (CFG.toasts && CFG.toasts.messages) ? CFG.toasts.messages.slice() : [];
    if(!msgs.length) return;

    let idx = Math.floor(Math.random()*msgs.length);
    const next = () => {
      idx = (idx + 1) % msgs.length;
      toast(msgs[idx]);
    };

    // first toast after small delay
    window.setTimeout(() => toast(msgs[idx]), 1500);
    window.setInterval(next, CFG.toasts.intervalMs || 45000);

    const closeToastBtn = $("#toastClose");
    const toastBox = $("#toastBox");
    closeToastBtn && closeToastBtn.addEventListener("click", () => toastBox.classList.remove("show"));
  }

  // PWA install
  function setupInstall(){
    const installBanner = $("#installBanner");
    const installBtn = $("#installBtn");
    const headerInstallBtn = $("#headerInstallBtn");
    let deferredPrompt = null;

    function showInstallUI(){
      if(installBanner) installBanner.style.display = "block";
      if(headerInstallBtn) headerInstallBtn.style.display = "grid";
    }
    function hideInstallUI(){
      if(installBanner) installBanner.style.display = "none";
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallUI();
    });

    async function doInstall(){
      if(!deferredPrompt){
        // iOS fallback help
        toast("على iPhone: اضغط مشاركة ثم Add to Home Screen ✨");
        return;
      }
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideInstallUI();
      if(choice && choice.outcome === "accepted") toast("تم التثبيت ✅");
    }

    installBtn && installBtn.addEventListener("click", doInstall);
    headerInstallBtn && headerInstallBtn.addEventListener("click", doInstall);

    // hide banner after a while if not used
    const installClose = $("#installClose");
    installClose && installClose.addEventListener("click", hideInstallUI);
  }

  // Service worker
  function setupSW(){
    if(!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  // Assistant chat
  function setupAssistant(){
    if(!CFG || !CFG.assistant) return;
    const openBtn = $("#assistBtn");
    const chat = $("#chat");
    const closeBtn = $("#chatClose");
    const body = $("#chatBody");
    const input = $("#chatInput");
    const send = $("#chatSend");
    const subtitle = $("#chatSubtitle");

    if(!openBtn || !chat || !body || !input || !send) return;

    const addMsg = (text, me=false) => {
      const div = document.createElement("div");
      div.className = "msg" + (me ? " me" : "");
      div.textContent = text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    };

    const addQuick = (buttons) => {
      const wrap = document.createElement("div");
      wrap.className = "quick";
      buttons.forEach(b => {
        const btn = document.createElement("button");
        btn.type="button";
        btn.textContent = b.label;
        btn.addEventListener("click", () => handleAction(b.action));
        wrap.appendChild(btn);
      });
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    };

    const setTyping = (on) => {
      if(!subtitle) return;
      subtitle.textContent = on ? CFG.assistant.subtitleTyping : CFG.assistant.subtitleOnline;
    };

    const open = () => {
      chat.classList.add("open");
      if(body.dataset.inited === "1") return;
      body.dataset.inited = "1";
      addMsg(CFG.assistant.welcome);
      addQuick(CFG.assistant.quickActions || []);
    };

    const close = () => chat.classList.remove("open");

    openBtn.addEventListener("click", open);
    closeBtn && closeBtn.addEventListener("click", close);

    function handleAction(action){
      if(!action) return;
      if(action.startsWith("go:")){
        const key = action.split(":")[1];
        const href = CFG.links[key] || "./index.html";
        window.location.href = href;
      }
    }

    function matchRule(text){
      const rules = CFG.assistant.rules || [];
      const t = (text || "").toLowerCase();
      for(const r of rules){
        for(const k of (r.keys || [])){
          if(t.includes(k.toLowerCase())) return r.reply;
        }
      }
      return null;
    }

    function reply(text){
      const r = matchRule(text) || CFG.assistant.fallback;
      setTyping(true);
      window.setTimeout(() => {
        addMsg(r);
        setTyping(false);
      }, 650);
    }

    function sendNow(){
      const text = input.value.trim();
      if(!text) return;
      input.value="";
      addMsg(text, true);
      reply(text);
    }

    send.addEventListener("click", sendNow);
    input.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){ e.preventDefault(); sendNow(); }
    });
  }

  // Share buttons
  function setupShareButtons(){
    const shareProgramBtn = $("#shareProgramBtn");
    if(shareProgramBtn && CFG?.share?.programTemplate){
      shareProgramBtn.addEventListener("click", async () => {
        const txt = fillTemplate(CFG.share.programTemplate, { url: baseUrl() });
        await shareText(txt);
      });
    }
  }

  // Smooth fade on navigation (tiny app feel)
  function setupPageTransition(){
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if(!a) return;
      const href = a.getAttribute("href");
      if(!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) return;
      // internal
      e.preventDefault();
      document.body.style.opacity = "0";
      window.setTimeout(() => { window.location.href = href; }, 120);
    }, { capture: true });
    // on load
    document.body.style.opacity = "1";
  }

  // Footer year
  function setYear(){
    const y = $("#year");
    if(y) y.textContent = new Date().getFullYear();
  }

  window.AYED = window.AYED || {};
  window.AYED.Core = { $, $$, storage, toast, copyToClipboard, shareText, baseUrl, fillTemplate, formatMs };

  // init
  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav();
    setupDrawer();
    setupAccordion();
    setupToasts();
    setupInstall();
    setupSW();
    setupAssistant();
    setupShareButtons();
    setupPageTransition();
    setYear();
  });
})();
