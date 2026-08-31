(function(){
  const SESSION_KEY="rdg_auth_session_v2";
  const ACCOUNTS_KEY="rdg_local_accounts_v1";
  const cfg=()=>GAME_CONFIG.auth||{};
  const clean=s=>String(s||"").trim();
  function accounts(){ try{return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"{}");}catch{return {};} }
  function saveAccounts(a){ localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(a)); }
  function current(){ try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null");}catch{return null;} }
  function login(username,password){
    username=clean(username); password=String(password||"");
    const admin=cfg().admin;
    if(admin&&username===admin.username&&password===admin.password){ const s={username,role:"admin",loginAt:Date.now()}; sessionStorage.setItem(SESSION_KEY,JSON.stringify(s)); return s; }
    const a=accounts()[username.toLowerCase()];
    if(a&&a.username===username&&a.password===password){ const s={username:a.username,role:"player",loginAt:Date.now()}; sessionStorage.setItem(SESSION_KEY,JSON.stringify(s)); return s; }
    return null;
  }
  function register(username,password){
    username=clean(username); password=String(password||"");
    if(username.length<3) throw new Error("O usuário precisa ter pelo menos 3 caracteres.");
    if(password.length<4) throw new Error("A senha precisa ter pelo menos 4 caracteres.");
    if(cfg().admin&&username.toLowerCase()===String(cfg().admin.username).toLowerCase()) throw new Error("Este nome de usuário é reservado.");
    const all=accounts(), key=username.toLowerCase();
    if(all[key]) throw new Error("Este usuário já existe.");
    all[key]={username,password,createdAt:Date.now()}; saveAccounts(all);
    const s={username,role:"player",loginAt:Date.now()}; sessionStorage.setItem(SESSION_KEY,JSON.stringify(s)); return s;
  }
  function logout(){ sessionStorage.removeItem(SESSION_KEY); location.reload(); }
  function isAdmin(){ return current()?.role==="admin"; }
  function saveSuffix(){ const s=current(); return s?.role==="player" ? `account_${s.username.toLowerCase().replace(/[^a-z0-9_-]/gi,"_")}` : "admin"; }
  window.RDGAuth={current,login,register,logout,isAdmin,saveSuffix};
})();
