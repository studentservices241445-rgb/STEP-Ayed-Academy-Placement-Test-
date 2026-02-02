(() => {
  const Core = window.AYED?.Core;
  if(!Core) return;
  const { $, storage, toast } = Core;

  function formatDate(iso){
    try{
      const d = new Date(iso);
      return d.toLocaleString("ar-SA", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
    }catch(e){ return iso; }
  }

  function render(){
    const list = $("#history");
    const hist = storage.get("results_history", []);
    if(!hist.length){
      $("#empty").style.display="block";
      $("#wrap").style.display="none";
      return;
    }
    $("#empty").style.display="none";
    $("#wrap").style.display="block";

    list.innerHTML = "";
    hist.forEach((r, idx)=>{
      const card = document.createElement("div");
      card.className = "card pad";
      const name = r.profile?.name || "—";
      const pct = r.score?.pct ?? 0;
      const level = r.score?.level || "—";
      card.innerHTML = `
        <div class="section-title">
          <h2>${name} — ${pct}%</h2>
          <span class="badge"><span class="dot"></span>${level}</span>
        </div>
        <div class="muted">تاريخ: ${formatDate(r.createdAt)}</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px">
          <button class="btn small" data-open="${idx}">فتح النتيجة</button>
          <button class="btn small secondary" data-make-last="${idx}">تعيين كآخر نتيجة</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll("[data-open]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const i = Number(btn.getAttribute("data-open"));
        const hist = storage.get("results_history", []);
        const r = hist[i];
        if(r){
          storage.set("last_result", r);
          window.location.href = "./results.html";
        }
      });
    });

    list.querySelectorAll("[data-make-last]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const i = Number(btn.getAttribute("data-make-last"));
        const hist = storage.get("results_history", []);
        const r = hist[i];
        if(r){
          storage.set("last_result", r);
          toast("تم ✅");
        }
      });
    });

    $("#clearAll").addEventListener("click", ()=>{
      if(!confirm("متأكد؟ سيتم مسح النتائج والبيانات من هذا الجهاز فقط.")) return;
      try{
        // remove all keys under prefix
        const prefix = storage.prefix;
        const keys = [];
        for(let i=0;i<localStorage.length;i++){
          const k = localStorage.key(i);
          if(k && k.startsWith(prefix)) keys.push(k);
        }
        keys.forEach(k=>localStorage.removeItem(k));
        toast("تم مسح البيانات ✅");
        window.setTimeout(()=>location.reload(), 400);
      }catch(e){
        toast("صار خطأ أثناء المسح.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", render);
})();
