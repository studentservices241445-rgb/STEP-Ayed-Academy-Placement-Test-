(() => {
  const Core = window.AYED?.Core;
  if(!Core) return;
  const { $, $$ } = Core;

  function initIntro(){
    const openBtn = $("#introOpen");
    const modal = $("#introModal");
    const backdrop = $("#introBackdrop");
    const closeBtn = $("#introClose");
    const prev = $("#introPrev");
    const next = $("#introNext");
    const dotsWrap = $("#introDots");
    if(!openBtn || !modal || !backdrop) return;

    const slides = $$(".slide", modal);
    let idx = 0;

    const render = () => {
      slides.forEach((s,i)=> s.classList.toggle("active", i===idx));
      if(dotsWrap){
        dotsWrap.innerHTML = slides.map((_,i)=>`<span class="dot2 ${i===idx?'active':''}"></span>`).join("");
      }
      if(prev) prev.disabled = idx===0;
      if(next) next.textContent = (idx===slides.length-1) ? "تم" : "التالي";
    };

    const open = () => { modal.classList.add("open"); backdrop.classList.add("open"); idx=0; render(); };
    const close = () => { modal.classList.remove("open"); backdrop.classList.remove("open"); };

    openBtn.addEventListener("click", open);
    backdrop.addEventListener("click", close);
    closeBtn && closeBtn.addEventListener("click", close);

    prev && prev.addEventListener("click", ()=>{ if(idx>0){ idx--; render(); }});
    next && next.addEventListener("click", ()=>{
      if(idx < slides.length-1){ idx++; render(); }
      else close();
    });

    // keyboard
    document.addEventListener("keydown", (e)=>{
      if(!modal.classList.contains("open")) return;
      if(e.key==="Escape") close();
      if(e.key==="ArrowLeft") { if(idx<slides.length-1){ idx++; render(); } }
      if(e.key==="ArrowRight"){ if(idx>0){ idx--; render(); } }
    });
  }

  document.addEventListener("DOMContentLoaded", initIntro);
})();
