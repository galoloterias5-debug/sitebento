const MIN_ORDER = 14.90;

function toast(msg){
  try{
    let el = document.getElementById("toast");
    if(!el){
      el = document.createElement("div");
      el.id = "toast";
      el.style.position = "fixed";
      el.style.left = "12px";
      el.style.right = "12px";
      el.style.bottom = "18px";
      el.style.zIndex = "9999";
      el.style.padding = "12px 14px";
      el.style.borderRadius = "14px";
      el.style.background = "rgba(20,20,24,.92)";
      el.style.color = "#fff";
      el.style.fontSize = "14px";
      el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      el.style.transition = "opacity .18s ease, transform .18s ease";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(()=>{ el.style.opacity="1"; el.style.transform="translateY(0)"; });
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(10px)"; }, 2200);
  }catch(e){ alert(msg); }
}

window.__forceHideCartBar = true;
window.__showCartBar = false;
window.__initCartBarHidden = true;
document.addEventListener('DOMContentLoaded', ()=>{ const b=document.querySelector('#cartBar'); if(b) b.style.display='none'; });
const CART_KEY = "bento_cart_v1";

function qs(sel, root=document){ return root.querySelector(sel); }

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
  // Se cruza meia-noite (ex: 10:00 -> 01:00)
  if(openEnd < openStart){
    return (minutes >= openStart) || (minutes < openEnd);
  }
  // Não cruza meia-noite
  return (minutes >= openStart) && (minutes < openEnd);
}

// Disponível para outras páginas (checkout)
window.isStoreOpen = isStoreOpen;
window.getHoursConfig = getHoursConfig;

function initStoreHoursUI(){
  const modal = document.getElementById("closedModal");
  const closeBtn = document.getElementById("closeClosedModal");
  const openPill = document.getElementById("openUntil");
  const hc = getHoursConfig();

  const open = isStoreOpen(new Date());
  if(openPill){
    openPill.textContent = open ? `Aberto até ${hc.openEnd}` : "Fechado agora";
    openPill.style.background = open ? "rgba(0,200,120,.18)" : "rgba(255,70,70,.16)";
    openPill.style.borderColor = open ? "rgba(0,200,120,.35)" : "rgba(255,70,70,.30)";
  }

  // Atualiza textos do modal
  if(modal){
    const sub = modal.querySelector(".closedSub");
    if(sub) sub.innerHTML = `Funcionamento: ${hc.days}, das <b>${hc.openStart}</b> até <b>${hc.openEnd}</b>.`;
  }

  if(modal && !open){
    modal.classList.add("show");
    modal.setAttribute("aria-hidden","false");
  }
  if(closeBtn && modal){
    closeBtn.addEventListener("click", ()=>{
      // Pode ver o cardápio, mas não pode finalizar pedidos enquanto fechado
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden","true");
      toast("Loja fechada no momento. Pedidos somente no horário de funcionamento.");
    });
  }
}



function parseHM(t){const [h,m]=t.split(":").map(Number);return h*60+m;}

function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function brl(v){ return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

function cartTotal(cart){
  return (cart||[]).reduce((sum,it)=>{
    const qty = Number(it.qty||1);
    const unit = Number(it.unitPrice||0);
    const add = (it.addOns||[]).reduce((s,a)=> s + Number(a.price||0), 0);
    return sum + (unit + add) * qty;
  }, 0);
}

function escapeHtml(s){
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function loadCart(){
  // Works both on https:// and file:// (when storage is blocked)
  try{
    const raw = localStorage.getItem("bento_cart_v1");
    if(!raw) return window.__cartMem || [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (window.__cartMem || []);
  }catch(e){
    return window.__cartMem || [];
  }
}

function saveCart(cart){
  window.__cartMem = Array.isArray(cart) ? cart : [];
  try{
    localStorage.setItem("bento_cart_v1", JSON.stringify(window.__cartMem));
  }catch(e){
    // storage may be blocked on file:// - keep memory only
  }
}

function cartCount(cart){ return cart.reduce((s,l)=>s + (l.qty||1), 0); }

async function loadMenu(){
  // Prefer fetch when hosted; fallback to embedded menu_data.js for file://
  try{
    const r = await fetch("./menu.json", { cache:"no-store" });
    if(r.ok) return await r.json();
  }catch(e){}
  if(window.MENU_FALLBACK) return window.MENU_FALLBACK;
  throw new Error("Não foi possível carregar o cardápio.");
}

function initLazyImages(root=document){
  const imgs = Array.from(root.querySelectorAll('img[data-src]'));
  if(!imgs.length) return;

  const load = (img)=>{
    const src = img.getAttribute("data-src");
    if(!src) return;
    img.src = src;
    img.decoding = "async";
    img.loading = "lazy";
    img.onload = ()=>{
      img.classList.add("isLoaded");
      const ph = img.parentElement?.querySelector(".imgPh");
      if(ph) ph.remove();
    };
    img.onerror = ()=>{ // remove placeholder even on error
      const ph = img.parentElement?.querySelector(".imgPh");
      if(ph) ph.remove();
    };
  };

  if("IntersectionObserver" in window){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          load(e.target);
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: "250px 0px" });
    imgs.forEach(img=> io.observe(img));
  }else{
    imgs.forEach(load);
  }
}

function calcLineTotal(item, selectedOptions){
  const add = (selectedOptions||[]).reduce((s,o)=>s + (o.price||0), 0);
  return (item.price||0) + add;
}

function ensureModal(){
  if(qs("#modal")) return;
  const m = document.createElement("div");
  m.id = "modal";
  m.className = "modal";
  m.innerHTML = `
    <div class="modalCard">
      <div class="modalTop">
        <div style="min-width:0">
          <div id="modalTitle" class="h2"></div>
          <div id="modalPrice" class="price"></div>
        </div>
        <button id="modalClose" class="btn">✕</button>
      </div>
      <div id="modalBody" class="modalBody"></div>
      <div class="modalBottom">
        <button id="modalAddBtn" class="btn btnPrimary" style="width:100%; justify-content:center" disabled>Adicionar ao carrinho</button>
        <div id="modalHint" class="muted" style="margin-top:10px; text-align:center"></div>
      </div>
    </div>
  `;
  document.body.appendChild(m);
}

function openModal({item, optionGroups, onAdd}){
  const modal = qs("#modal");
  const modalBody = qs("#modalBody");
  const modalTitle = qs("#modalTitle");
  const modalPrice = qs("#modalPrice");
  const modalAddBtn = qs("#modalAddBtn");
  const modalClose = qs("#modalClose");
  const modalHint = qs("#modalHint");

  let selected = {}; // groupId -> Set(optionId)
  let optionsById = {};
  (optionGroups||[]).forEach(g=>{
    selected[g.id] = new Set();
    (g.options||[]).forEach(o=> optionsById[o.id] = {...o, groupId: g.id});
  });

  function selectedFlat(){
    const out=[];
    for(const gid of Object.keys(selected)){
      for(const oid of selected[gid]) out.push(optionsById[oid]);
    }
    return out;
  }

  function validate(){
    for(const g of (optionGroups||[])){
      const c = (selected[g.id]||new Set()).size;
      if(g.required && c < g.min) return {ok:false, msg:`Escolha ${g.min} em "${g.title}"`};
      if(c > g.max) return {ok:false, msg:`Máximo ${g.max} em "${g.title}"`};
    }
    return {ok:true, msg:""};
  }

  function updatePrice(){
    const total = calcLineTotal(item, selectedFlat());
    modalPrice.textContent = brl(total);
    const v = validate();
    modalAddBtn.disabled = !v.ok;
    modalAddBtn.style.opacity = v.ok ? "1" : "0.55";
    modalHint.textContent = v.ok ? "Pronto! Adicione ao carrinho." : v.msg;
  }

  modalTitle.textContent = item.name || "Item";
  modalBody.innerHTML = `
    <div class="muted" style="margin-top:-6px">${escapeHtml(item.description || "")}</div>
    ${item.image ? `<div class="imgWrap" style="border-radius:16px; margin-top:12px">
      <div class="imgPh"></div>
      <img data-src="${escapeHtml(item.image)}" alt="" style="width:100%; max-height:220px; object-fit:contain; border-radius:16px; background: rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06)"/>
    </div>` : ""}
    <div style="margin-top:14px"></div>
  `;

  (optionGroups||[]).forEach(g=>{
    const section = document.createElement("div");
    section.style.marginTop = "14px";
    section.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px">
        <div style="font-weight:900">${escapeHtml(g.title)}</div>
        <div class="badge">${g.required ? `Obrigatório • ${g.min}` : "Opcional"}</div>
      </div>
      <div class="muted" style="margin-top:4px">${escapeHtml(g.subtitle || "")}</div>
      <div class="optGrid" data-group="${g.id}" style="margin-top:10px"></div>
    `;
    modalBody.appendChild(section);

    const grid = section.querySelector(".optGrid");
    (g.options||[]).forEach(o=>{
      const btn = document.createElement("button");
      btn.className = "optBtn";
      btn.type = "button";
      btn.dataset.oid = o.id;
      btn.innerHTML = `
        ${o.image ? `<div class="imgWrap" style="width:100%"><div class="imgPh"></div><img data-src="${escapeHtml(o.image)}" alt="" class="optImg" /></div>` : `<span class="optDot"></span>`}
        <span class="optName">${escapeHtml(o.name)}</span>
        <span class="optPrice">${(o.price||0)>0 ? "+"+brl(o.price) : "Grátis"}</span>
      `;
      btn.onclick = ()=>{
        const set = selected[g.id];
        const isOn = set.has(o.id);

        if(isOn){
          set.delete(o.id);
        }else{
          if(set.size >= g.max){
            if(g.max === g.min){
              const first = set.values().next().value;
              set.delete(first);
              set.add(o.id);
            }
          }else{
            set.add(o.id);
          }
        }
        qsa(".optBtn", grid).forEach(b=>{
          if(set.has(b.dataset.oid)) b.classList.add("optBtnOn");
          else b.classList.remove("optBtnOn");
        });
        updatePrice();
      };
      grid.appendChild(btn);
    });
  });

  function close(){ modal.classList.remove("modalOn"); }
  modalClose.onclick = close;
  modal.onclick = (e)=>{ if(e.target === modal) close(); };

  modalAddBtn.onclick = ()=>{
    const v = validate();
    if(!v.ok) return;
    onAdd(selectedFlat());
    close();
  };

  initLazyImages(modalBody);
  updatePrice();
  modal.classList.add("modalOn");
}

function updateCartBadge(){
  const cart = loadCart();
  const badge = qs("#cartBadge");
  if(badge) badge.textContent = `${cartCount(cart)} itens`;
}

// keep bottom bar in sync
function renderTopSellers(menu){
  const host = qs("#topSellers");
  if(!host) return;
  const items = (menu.items||[]).filter(i=>i.featured === true);
  if(!items.length){
    host.style.display = "none";
    return;
  }
  host.style.display = "block";
  host.innerHTML = `
    <div class="sectionHead">
      <div class="sectionTitleLg">⭐ Mais vendidos</div>
      <div class="muted" style="margin-top:2px">Os queridinhos da Bento</div>
    </div>
    <div class="hs" id="hsList"></div>
  `;
  const hsList = qs("#hsList", host);

  items.forEach(item=>{
    const old = item.oldPrice ? `<div class="hsOld">${brl(item.oldPrice)}</div>` : "";
    const el = document.createElement("div");
    el.className="hsCard";
    el.innerHTML = `
      <div class="hsImgWrap">
        <div class="imgPh"></div>
        <img class="hsImg" data-src="${escapeHtml(item.image||"")}" alt="">
      </div>
      <div class="hsName">${escapeHtml(item.name)}</div>
      <div class="hsPriceRow">
        ${old}
        <div class="hsNew">${brl(item.price)}</div>
      </div>
      <button class="btn btnPrimary hsBtn">Adicionar</button>
    `;
    el.querySelector(".hsBtn").onclick = ()=>{
      const og=(menu.optionGroups||[]).filter(g=>(item.optionGroupIds||[]).includes(g.id));
      openModal({
        item,
        optionGroups: og,
        onAdd: (opts)=>{
          const c=loadCart();
          c.push({
            id: item.id+"_"+Date.now(),
            productId: item.id,
            name: item.name,
            unitPrice: item.price,
            qty: 1,
            addOns: (opts||[]).map(o=>({id:o.id,name:o.name,price:o.price}))
          });
          saveCart(c); updateCartBadge(); showAddPrompt(()=>{ window.location.href = "./checkout.html"; }); updateBottomCartBar(); updateBottomCartBar(); showAddPrompt(()=>{ window.location.href = "./checkout.html"; }); }
      });
    };
    hsList.appendChild(el);
  });

  initLazyImages(host);
}


function renderStacked(menu){
  const list = qs("#list");
  list.innerHTML = "";
  (menu.categories||[]).forEach(cat=>{
    const catName = cat.name || cat;
    if(String(catName).toLowerCase().trim() === "mais vendidos") return;

    const items = (menu.items||[]).filter(i=>i.category===catName);
    if(!items.length) return;

    const h = document.createElement("h3");
    h.className="catTitle";
    h.textContent = catName;
    list.appendChild(h);

    items.forEach(item=>{
      const card=document.createElement("div");
      card.className="itemCard";
      const old = item.oldPrice ? `<span class="oldPrice">${brl(item.oldPrice)}</span>` : "";
      card.innerHTML=`
        <div class="itemLeft">
          <div class="itemTitle">${escapeHtml(item.name)}</div>
          <div class="itemDesc">${escapeHtml(item.description||"")}</div>
          <div class="itemPrice">${old} <span class="newPrice">${brl(item.price)}</span></div>
        </div>
        <div class="itemRight">
          <div class="imgWrap"><img class="itemImg" src="${escapeHtml(item.image||"")}" alt=""></div>
          <button class="btn btnPrimary addBtn">Adicionar</button>
        </div>`;
      card.querySelector(".addBtn").onclick=()=>{
        const og=(menu.optionGroups||[]).filter(g=>(item.optionGroupIds||[]).includes(g.id));
        openModal({
          item,
          optionGroups: og,
          onAdd:(opts)=>{
            const c=loadCart();
            c.push({
              id: item.id+"_"+Date.now(),
              productId: item.id,
              name: item.name,
              unitPrice: item.price,
              qty: 1,
              addOns: (opts||[]).map(o=>({id:o.id,name:o.name,price:o.price}))
            });
            saveCart(c); updateCartBadge(); showAddPrompt(()=>{ window.location.href = "./checkout.html"; }); updateBottomCartBar(); updateBottomCartBar(); showAddPrompt(()=>{ window.location.href = "./checkout.html"; }); }
        });
      };
      list.appendChild(card);
    });
  });
}

function showAddPrompt(onGoCart){
  const overlay = qs("#addPrompt");
  if(!overlay) return;
  overlay.style.display = "block";
  overlay.setAttribute("aria-hidden","false");
  const goBtn = qs("#goCartBtn");
  const keepBtn = qs("#keepBuyingBtn");

  const close = ()=>{
    overlay.style.display="none";
    overlay.setAttribute("aria-hidden","true");
  };

  goBtn.onclick = ()=>{ close(); window.location.href = "./checkout.html"; };
  keepBtn.onclick = ()=>{ window.__showCartBar = true; close(); updateBottomCartBar(); setTimeout(updateBottomCartBar, 50); };

  overlay.onclick = (e)=>{
    if(e.target === overlay) close();
  };
}

function updateBottomCartBar(){
  const bar = document.querySelector("#cartBar");
  const totalEl = document.querySelector("#cartBarTotal");
  if(!bar || !totalEl) return;

  // Hard rule: only show after clicking "Continuar comprando"
  if(!window.__showCartBar){
    bar.style.display = "none";
    return;
  }

  const cart = loadCart();
  const total = (()=>{ try{ return cartTotal(cart); }catch(e){ return 0; } })();

  if(!cart || !cart.length){
    bar.style.display = "none";
    return;
  }

  totalEl.textContent = brl(total);
  bar.style.display = "flex";
}


function wireCartBar(){
  const bar = qs("#cartBar");
  if(!bar) return;
  bar.addEventListener("click", ()=>{
    window.location.href = "./checkout.html";
  });
}

async function init(){
  ensureModal();

  const list = qs("#list");
  try{
    const menu = await loadMenu();

    const n = qs("#storeName");
    if(n && menu.store?.name) n.textContent = menu.store.name;
    const t = qs("#storeTagline");
    if(t && menu.store?.tagline) t.textContent = menu.store.tagline;

    renderTopSellers(menu);
  wireCartBar();
  renderStacked(menu);
    updateCartBadge();

    const goCheckout = qs("#goCheckout");
    if(goCheckout){
      goCheckout.onclick = ()=>{
        const cart = loadCart();
        const total = cartTotal(cart);
        if(total + 1e-6 < MIN_ORDER){
          toast(`Pedido mínimo: ${brl(MIN_ORDER)}. Adicione mais itens para finalizar.`);
          return;
        }
        window.location.href = "./checkout.html";
      };
    }
  }catch(err){
    console.error(err);
    if(list){
      list.innerHTML = `<div class="muted">Erro ao carregar o cardápio. Abra os arquivos na mesma pasta (bento_site_static) ou hospede em um servidor.</div>`;
    }
  }
  initStoreHoursUI();
}

window.addEventListener("DOMContentLoaded", init);
document.addEventListener("DOMContentLoaded", ()=>{
  window.__showCartBar = false;
  const bar = document.querySelector("#cartBar");
  if(bar) bar.style.display = "none";
});

function blockIfClosed(){
  if(!isStoreOpen(new Date())){
    toast(`Loja fechada. Funcionamos das ${CONFIG.store_hours.open} às ${CONFIG.store_hours.close}.`);
    window.scrollTo({top:0,behavior:"smooth"});
    return true;
  }
  return false;
}
