(function(){
  const SESSION_KEY="rdg_auth_session_v2", ACCOUNTS_KEY="rdg_player_accounts_v1";
  const cfg=()=>GAME_CONFIG.auth||{};
  const norm=s=>String(s||"").trim().toLowerCase();
  function accounts(){ try{return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"{}");}catch{return {};} }
  function saveAccounts(a){ localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(a)); }
  function current(){ try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null");}catch{return null;} }
  function playerId(username){ return `player:${norm(username).replace(/[^a-z0-9_.-]/g,"_")}`; }
  function login(username,password){
    username=String(username||"").trim(); password=String(password||"");
    const admin=cfg().admin;
    if(admin&&norm(username)===norm(admin.username)&&password===String(admin.password)){
      const s={username:admin.username,role:"admin",playerId:"admin",loginAt:Date.now()}; sessionStorage.setItem(SESSION_KEY,JSON.stringify(s)); return s;
    }
    const a=accounts(), key=norm(username);
    // Compatibilidade: versões antigas podem ter salvo a conta com uma chave diferente
    // da normalização atual. Procura também pelo username armazenado e migra a chave.
    let u=a[key] || Object.values(a).find(acc=>norm(acc?.username)===key);
    if(u && !a[key]) { a[key]=u; saveAccounts(a); }
    // compatibilidade com o jogador de teste configurado
    const legacy=cfg().player;
    if(!u&&legacy&&key===norm(legacy.username)&&password===String(legacy.password)){
      a[key]={username:legacy.username, password:String(legacy.password), createdAt:Date.now(), playerId:playerId(legacy.username)}; saveAccounts(a);
      u=a[key];
    }
    const found=a[key] || u;
    if(found&&password===String(found.password)){
      const s={username:found.username,role:"player",playerId:found.playerId||playerId(found.username),loginAt:Date.now()}; sessionStorage.setItem(SESSION_KEY,JSON.stringify(s)); return s;
    }
    return null;
  }
  function register(username,password){
    username=String(username||"").trim(); password=String(password||""); const key=norm(username);
    if(username.length<3) return {ok:false,error:"O usuário precisa ter pelo menos 3 caracteres."};
    if(password.length<4) return {ok:false,error:"A senha precisa ter pelo menos 4 caracteres."};
    if(cfg().admin&&key===norm(cfg().admin.username)) return {ok:false,error:"Esse usuário é reservado."};
    const a=accounts(); if(a[key]) return {ok:false,error:"Esse usuário já existe."};
    a[key]={username,password,createdAt:Date.now(),playerId:playerId(username)}; saveAccounts(a);
    return {ok:true,account:a[key]};
  }
  function logout(){ sessionStorage.removeItem(SESSION_KEY); location.reload(); }
  function isAdmin(){ return current()?.role==="admin"; }
  window.RDGAuth={current,login,register,logout,isAdmin,accounts,playerId};
})();
