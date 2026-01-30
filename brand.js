(function(){
  const PRIMARY = "#8C14FF";

  // Resolve logo path relative to the current page, so it works both at root and in subfolders.
  const LOGO_PATHS = [
    "assets/img/logo.png",
    "assets/img/LOGO.png",
    "assets/img/Logo.png",
    "./assets/img/logo.png",
    "./assets/img/LOGO.png",
    "./assets/img/Logo.png",
    "/assets/img/logo.png",
    "/assets/img/LOGO.png",
    "/assets/img/Logo.png"
  ];

  document.documentElement.style.setProperty("--brand", PRIMARY);
  document.documentElement.style.setProperty("--brand2", PRIMARY);

  function resolve(p){
    try { return new URL(p, document.baseURI).href; } catch(e){ return p; }
  }

  function setLogo(img){
    if(!img) return;
    let idx = 0;
    const tryNext = ()=>{
      const url = resolve(LOGO_PATHS[idx] || LOGO_PATHS[0]);
      img.src = url;
      img.loading = "eager";
      img.decoding = "async";
      img.style.objectFit = "contain";
      img.style.background = "transparent";
      img.style.display = "block";
    };

    img.onerror = ()=>{
      idx += 1;
      if(idx < LOGO_PATHS.length) tryNext();
    };

    tryNext();
  }

  document.querySelectorAll("img.brandLogo").forEach(setLogo);
})();