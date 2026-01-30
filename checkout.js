const MIN_ORDER = 14.90;
const CART_KEY = "bento_cart_v1";
const ORDER_KEY = "bento_last_order_v1";
const ADDRESS_KEY = "bento_address_v1";

function qs(sel){ return document.querySelector(sel); }

function parseHM(str){
  const m = String(str||"").match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  const hh = Math.min(23, Math.max(0, parseInt(m[1],10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2],10)));
  return hh*60 + mm;
}
function getHoursConfig(){
  const cfg = (window.CONFIG && window.CONFIG.HOURS) ? window.CONFIG.HOURS : null;
  return {
    openStart: (cfg && cfg.openStart) ? cfg.openStart : "10:00",
    openEnd:   (cfg && cfg.openEnd) ? cfg.openEnd : "01:00",
    days:      (cfg && cfg.days) ? cfg.days : "Segunda a segunda"
  };
}
function isStoreOpen(now=new Date()){
  const hc = getHoursConfig();
  const minutes = now.getHours()*60 + now.getMinutes();
  const openStart = parseHM(hc.openStart);
  const openEnd = parseHM(hc.openEnd);
  if(openStart==null || openEnd==null) return true;
  if(openEnd < openStart) return (minutes >= openStart) || (minutes < openEnd);
  return (minutes >= openStart) && (minutes < openEnd);
}


function validateRequiredFields(){
  const required = ["name","phone","cep","street","number","neighborhood","city","uf"];
  let firstBad = null;
  required.forEach(id=>{
    const el = qs("#"+id);
    if(!el) return;
    let empty = !(String(el.value||"").trim());
    if(id==="phone"){
      const digits = String(el.value||"").replace(/[^0-9]/g,"");
      empty = digits.length < 8;
    }
    el.classList.toggle("invalid", empty);
    if(empty && !firstBad) firstBad = el;
  });
  return firstBad;
}

function wirePhoneNumeric(){
  const phoneEl = qs("#phone");
  if(phoneEl && !phoneEl.__wiredNumeric){
    phoneEl.__wiredNumeric = true;
    phoneEl.addEventListener("input", ()=>{
      phoneEl.value = (phoneEl.value||"").replace(/\D+/g,"");
      phoneEl.classList.remove("invalid");
    });
  }
}

function wireInvalidClear(){
  ["name","cep","street","number","neighborhood","city","uf"].forEach(id=>{
    const el = qs("#"+id);
    if(el && !el.__wiredClear){
      el.__wiredClear = true;
      el.addEventListener("input", ()=> el.classList.remove("invalid"));
    }
  });
}

function handlePayClick(e){
  if(!isStoreOpen(new Date())){
    toast("Loja fechada no momento. Pedidos somente no horário de funcionamento.");
    window.scrollTo({top:0,behavior:"smooth"});
    e && e.preventDefault && e.preventDefault();
    return false;
  }
  wirePhoneNumeric();
  wireInvalidClear();

  const cartNow = loadCart();
  const totalsNow = calcTotals(cartNow);
  if((totalsNow.total||0) + 1e-6 < MIN_ORDER){
    toast(`Pedido mínimo: ${brl(MIN_ORDER)}. Adicione mais itens para finalizar.`);
    window.scrollTo({top:0,behavior:"smooth"});
    e && e.preventDefault && e.preventDefault();
    return false;
  }

  const firstBad = validateRequiredFields();
  if(firstBad){
    toast("Preencha os dados para prosseguir");
    window.scrollTo({top:0,behavior:"smooth"});
    try{ firstBad.focus(); }catch(_){}
    e && e.preventDefault && e.preventDefault();
    return false;
  }
  return true;
}

function brl(v){ return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

function toast(msg){
  let el = document.querySelector("#toast");
  if(!el){
    el = document.createElement("div");
    el.id="toast";
    el.style.position="fixed";
    el.style.left="50%";
    el.style.bottom="90px";
    el.style.transform="translateX(-50%)";
    el.style.padding="12px 14px";
    el.style.borderRadius="16px";
    el.style.zIndex="200";
    el.style.background="rgba(8,10,18,.92)";
    el.style.border="1px solid rgba(255,255,255,.12)";
    el.style.backdropFilter="blur(8px)";
    el.style.webkitBackdropFilter="blur(8px)";
    el.style.fontWeight="900";
    el.style.fontSize="13px";
    el.style.color="#fff";
    el.style.display="none";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display="block";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=>{ el.style.display="none"; }, 1700);
}

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function cleanCep(v){ return (v||"").replace(/\D/g,"").slice(0,8); }

function loadCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }catch(e){ return []; } }
function saveCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

function calcTotals(cart){
  const subtotal = cart.reduce((s,l)=>s + l.unitPrice*l.qty, 0);
  const addOns = cart.reduce((s,l)=>s + (l.addOns||[]).reduce((x,a)=>x+a.price,0)*l.qty, 0);
  return { subtotal, addOns, total: subtotal + addOns };
}

// JSONP ViaCEP – funciona em file:// e http(s)
function consultarCep(cep){
  return new Promise((resolve, reject)=>{
    const c = cleanCep(cep);
    if(c.length !== 8) return reject("CEP inválido. Use 8 dígitos.");

    const cb = "viacep_cb_" + Math.random().toString(36).substring(2);
    window[cb] = function(data){
      try{
        delete window[cb];
        script.remove();
        if(data.erro) return reject("CEP não encontrado.");
        resolve(data);
      }catch(e){
        reject("Erro ao processar CEP.");
      }
    };

    const script = document.createElement("script");
    script.src = `https://viacep.com.br/ws/${c}/json/?callback=${cb}`;
    script.onerror = ()=>{
      try{ delete window[cb]; }catch(e){}
      reject("Erro ao consultar CEP. Verifique sua conexão.");
    };
    document.body.appendChild(script);
  });
}

function getAddressFields(){
  return {
    cep: (qs("#cep")?.value || "").trim(),
    street: (qs("#street")?.value || "").trim(),
    number: (qs("#number")?.value || "").trim(),
    complement: (qs("#complement")?.value || "").trim(),
    neighborhood: (qs("#neighborhood")?.value || "").trim(),
    city: (qs("#city")?.value || "").trim(),
    uf: (qs("#uf")?.value || "").trim(),
    reference: (qs("#reference")?.value || "").trim(),
  };
}

function setAddressFields(a){
  if(!a) return;
  if(qs("#cep")) qs("#cep").value = cleanCep(a.cep || "");
  if(qs("#street")) qs("#street").value = a.street || "";
  if(qs("#number")) qs("#number").value = a.number || "";
  if(qs("#complement")) qs("#complement").value = a.complement || "";
  if(qs("#neighborhood")) qs("#neighborhood").value = a.neighborhood || "";
  if(qs("#city")) qs("#city").value = a.city || "";
  if(qs("#uf")) qs("#uf").value = (a.uf || "").toUpperCase();
  if(qs("#reference")) qs("#reference").value = a.reference || "";
}

function saveAddress(){
  const a = getAddressFields();
  localStorage.setItem(ADDRESS_KEY, JSON.stringify(a));
}

function loadAddress(){
  try{ return JSON.parse(localStorage.getItem(ADDRESS_KEY) || "null"); }catch(e){ return null; }
}

function addressIsOk(){
  const a = getAddressFields();
  // Obrigatórios para delivery
  return cleanCep(a.cep).length === 8 &&
    a.street.length >= 3 &&
    a.number.length >= 1 &&
    a.neighborhood.length >= 2 &&
    a.city.length >= 2 &&
    a.uf.length >= 2;
}

function customerIsOk(){
  const name = (qs("#name")?.value || "").trim();
  const phone = (qs("#phone")?.value || "").trim().replace(/\s/g,"");
  return name.length >= 2 && phone.length >= 8;
}

function setPayEnabled(enabled){
  const btn = qs("#payBtn");
  const help = qs("#payHelp");
  if(!btn) return;
  btn.disabled = false;
  btn.style.opacity = "1";
  if(help) help.style.display = "none";
}

function updatePayState(){
  const cart = loadCart();
  const totals = calcTotals(cart);
  const okMin = (totals.total||0) + 1e-6 >= MIN_ORDER;
  setPayEnabled(customerIsOk() && addressIsOk() && okMin);
  const help = qs("#payHelp");
  if(help){
    if(!okMin) help.textContent = `Pedido mínimo: ${brl(MIN_ORDER)}. Adicione mais itens para finalizar.`;
    else help.textContent = "Para liberar o pagamento, preencha seus dados e consulte um CEP válido.";
  }
}

function createOrderAndRedirect(payload){
  const orderId = `PED-${Date.now().toString(36).toUpperCase()}`;
  const now = Date.now();
  const order = {
    id: orderId,
    createdAt: now,
    status: "produção",
    timeline: [
      { key: "produção", at: now },
      { key: "saiu_para_entrega", at: now + 25*60*1000 },
      { key: "cancelado", at: now + 35*60*1000 }
    ],
    payload
  };
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  window.location.href = "./success.html";
}

function ativarCep(){
  const cepInput = qs("#cep");
  const btn = qs("#cepBtn");
  const msg = qs("#freeShipMsg");
  const loading = qs("#cepLoading");

  if(!cepInput || !btn) return;

  cepInput.addEventListener("input", ()=>{
    cepInput.value = cleanCep(cepInput.value);
    // reset messaging when cep changes
    if(msg) msg.style.display = "none";
    updatePayState();
    saveAddress();
  });

  // Save address on manual typing too
  ["#street","#number","#complement","#neighborhood","#city","#uf","#reference","#name","#phone"].forEach(sel=>{
    const el = qs(sel);
    if(!el) return;
    el.addEventListener("input", ()=>{
      saveAddress();
      // Frete grátis após consultar CEP
      const fr = qs("#freteRow");
      if(fr) fr.style.display = "flex";
      const frv = qs("#frete");
      if(frv) frv.textContent = brl(0);
      updatePayState();
    });
  });

  btn.onclick = async (e)=>{
    e.preventDefault();
    if(msg) msg.style.display = "none";
    if(loading) loading.style.display = "block";

    try{
      const data = await consultarCep(cepInput.value);

      if(qs("#street")) qs("#street").value = data.logradouro || "";
      if(qs("#neighborhood")) qs("#neighborhood").value = data.bairro || "";
      if(qs("#city")) qs("#city").value = data.localidade || "";
      if(qs("#uf")) qs("#uf").value = (data.uf || "").toUpperCase();

      if(loading) loading.style.display = "none";
      if(msg) msg.style.display = "block";
      if(qs("#number")) qs("#number").focus();

      saveAddress();
      // Frete grátis após consultar CEP
      const fr = qs("#freteRow");
      if(fr) fr.style.display = "flex";
      const frv = qs("#frete");
      if(frv) frv.textContent = brl(0);
      updatePayState();
    }catch(err){
      if(loading) loading.style.display = "none";
      alert(err);
      updatePayState();
    }
  };
}

function render(){
  const cart = loadCart();
  const totals = calcTotals(cart);

  qs("#cartCount").textContent = `${cart.length} itens`;

  const items = qs("#items");
  items.innerHTML = "";
  if(cart.length === 0){
    items.innerHTML = `<div class="muted">Carrinho vazio. <a class="smallLink" href="./index.html">Voltar ao cardápio</a></div>`;
  }else{
    for(const l of cart){
      const addOnNames = (l.addOns||[]).map(a=>a.name).join(", ");
      const lineTotal = (l.unitPrice + (l.addOns||[]).reduce((s,a)=>s+a.price,0)) * l.qty;
      const el = document.createElement("div");
      el.className = "cartItem";
      el.innerHTML = `
        <div style="min-width:0">
          <div style="font-weight:900; font-size:13px">${escapeHtml(l.name)} <span class="muted">x${l.qty}</span></div>
          ${addOnNames ? `<div class="muted">+ ${escapeHtml(addOnNames)}</div>` : ""}
          ${l.note ? `<div class="muted">Obs: ${escapeHtml(l.note)}</div>` : ""}
        </div>
        <div style="font-weight:900">${brl(lineTotal)}</div>
      `;
      items.appendChild(el);
    }
  }

  qs("#sub").textContent = brl(totals.subtotal);
  qs("#add").textContent = brl(totals.addOns);
  qs("#tot").textContent = brl(totals.total);
  qs("#payBtn").textContent = `Pagar ${brl(totals.total)}`;

  qs("#clear").onclick = ()=>{
    saveCart([]);
    render();
    toast("Carrinho vazio");
  };

  qs("#payBtn").onclick = async (ev)=>{
    if(!handlePayClick(ev)) return;

    if(!(customerIsOk() && addressIsOk())){
      updatePayState();
      return;
    }

    const name = (qs("#name").value || "").trim();
    const phone = (qs("#phone").value || "").trim();
    const a = getAddressFields();

    const addrParts = [];
    if(a.street) addrParts.push(a.street);
    if(a.number) addrParts.push("nº " + a.number);
    if(a.complement) addrParts.push(a.complement);
    if(a.neighborhood) addrParts.push(a.neighborhood);
    const cityUf = [a.city, a.uf].filter(Boolean).join(" - ");
    if(cityUf) addrParts.push(cityUf);
    if(a.cep) addrParts.push("CEP " + a.cep);
    if(a.reference) addrParts.push("Ref: " + a.reference);
    const address = addrParts.join(", ");

    const payload = {
      customer: { name, phone },
      fulfillment: { type: "delivery", address },
      cart,
      totals
    };

    console.log("CHECKOUT PAYLOAD (stub):", payload);

    // Simulação de retorno positivo (troque pela sua condição real da gateway)
    createOrderAndRedirect(payload);
  };

  // Restore saved address + name/phone if you want (we'll only restore address)
  const saved = loadAddress();
  if(saved) setAddressFields(saved);

  ativarCep();
  updatePayState();
}

window.addEventListener("DOMContentLoaded", render);// Back to menu
try{
  qs("#backMenu").onclick = ()=>{ window.location.href = "./index.html"; };
}catch(e){}

function markInvalid(){
  document.querySelectorAll('[required]').forEach(el=>{
    if(!el.value){
      el.style.border='2px solid #e74c3c';
    }
  });
}
