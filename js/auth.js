(function(){
  const SESSION_KEY="rdg_auth_session_v2", ACCOUNTS_KEY="rdg_player_accounts_v1";
  const cfg=()=>GAME_CONFIG.auth||{};
  const norm=s=>String(s||"").trim().toLowerCase();
  function accounts(){ try{return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"{}");}catch{return {};} }
  function saveAccounts(a){ localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(a)); }
  let sessionBackend, currentSession;
  function sessionStore(){
    if(sessionBackend)return sessionBackend;
    try { const k="__rdg_test__"; sessionStorage.setItem(k,"1"); sessionStorage.removeItem(k); sessionBackend=sessionStorage; }
    catch(e){ sessionBackend=localStorage; }
    return sessionBackend;
  }
  function current(){
    if(currentSession!==undefined)return currentSession;
    try{currentSession=JSON.parse(sessionStore().getItem(SESSION_KEY)||"null");}catch{currentSession=null;}
    return currentSession;
  }
  function playerId(username){ return `player:${encodeURIComponent(norm(username))}`; }
  function login(username,password){
    username=String(username||"").trim(); password=String(password||"");
    const admin=cfg().admin;
    if(admin&&norm(username)===norm(admin.username)&&password===String(admin.password)){
      const s={username:admin.username,role:"admin",playerId:"admin",loginAt:Date.now()}; sessionStore().setItem(SESSION_KEY,JSON.stringify(s)); currentSession=s; return s;
    }
    const a=accounts(), key=norm(username);
    // Compatibilidade: versões antigas podem ter salvo a conta com uma chave diferente
    // da normalização atual. Procura também pelo username armazenado e migra a chave.
    let u=(Object.hasOwn(a,key)?a[key]:null) || Object.values(a).find(acc=>norm(acc?.username)===key);
    if(u && !a[key]) { a[key]=u; saveAccounts(a); }
    // compatibilidade com o jogador de teste configurado
    const legacy=cfg().player;
    if(!u&&legacy&&key===norm(legacy.username)&&password===String(legacy.password)){
      a[key]={username:legacy.username, password:String(legacy.password), createdAt:Date.now(), playerId:playerId(legacy.username)}; saveAccounts(a);
      u=a[key];
    }
    const found=u;
    if(found&&password===String(found.password)){
      const s={username:found.username,role:"player",playerId:found.playerId||playerId(found.username),loginAt:Date.now()}; sessionStore().setItem(SESSION_KEY,JSON.stringify(s)); currentSession=s; return s;
    }
    return null;
  }
  function register(username,password){
    username=String(username||"").trim(); password=String(password||""); const key=norm(username);
    if(/[<>"&]/.test(username)||["__proto__","constructor","prototype"].includes(key))return {ok:false,error:"Use letras, números, espaços ou pontuação simples no usuário."};
    if(username.length>40)return {ok:false,error:"O usuário deve ter até 40 caracteres."};
    if(username.length<3) return {ok:false,error:"O usuário precisa ter pelo menos 3 caracteres."};
    if(password.length<4) return {ok:false,error:"A senha precisa ter pelo menos 4 caracteres."};
    if(cfg().admin&&key===norm(cfg().admin.username)) return {ok:false,error:"Esse usuário é reservado."};
    const a=accounts(); if(a[key]) return {ok:false,error:"Esse usuário já existe."};
    a[key]={username,password,createdAt:Date.now(),playerId:playerId(username)}; saveAccounts(a);
    return {ok:true,account:a[key]};
  }
  function logout(){ currentSession=null; try{sessionStorage.removeItem(SESSION_KEY);}catch{} try{localStorage.removeItem(SESSION_KEY);}catch{} location.reload(); }
  function isAdmin(){ return current()?.role==="admin"; }
  window.RDGAuth={current,login,register,logout,isAdmin,accounts,playerId};
})();
