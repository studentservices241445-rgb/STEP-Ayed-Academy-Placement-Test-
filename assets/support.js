(() => {
  const Core = window.AYED?.Core;
  if(!Core) return;
  const { $, storage, toast, copyToClipboard } = Core;

  function submit(){
    const name = ($("#sName").value || "").trim();
    const contact = ($("#sContact").value || "").trim();
    const msg = ($("#sMsg").value || "").trim();
    if(!msg){
      toast("اكتب رسالتك أول 🙏");
      return;
    }

    const ticket = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      name: name || "—",
      contact: contact || "—",
      message: msg
    };

    const list = storage.get("support_tickets", []);
    list.unshift(ticket);
    storage.set("support_tickets", list.slice(0, 20));

    $("#formBox").style.display="none";
    $("#doneBox").style.display="block";
    $("#doneText").textContent = "تم تسجيل رسالتك على هذا الجهاز ✅";
    $("#ticketText").textContent = `الاسم: ${ticket.name}\nالتواصل: ${ticket.contact}\n\nالرسالة:\n${ticket.message}`;

    toast("تم ✅");
  }

  function init(){
    $("#sendBtn").addEventListener("click", submit);
    $("#copyTicket").addEventListener("click", async ()=>{
      await copyToClipboard($("#ticketText").textContent);
    });

    // show last tickets
    const hist = storage.get("support_tickets", []);
    const box = $("#ticketHistory");
    if(hist.length){
      box.innerHTML = hist.slice(0,5).map(t=>`
        <div class="card pad" style="margin-top:10px">
          <div class="muted">${new Date(t.createdAt).toLocaleString("ar-SA")}</div>
          <div style="margin-top:6px; white-space:pre-wrap">${t.message}</div>
        </div>
      `).join("");
      $("#histTitle").style.display="block";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
