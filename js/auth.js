(function(){
  const KEY="rdg_auth_session_v1";
  const cfg=()=>GAME_CONFIG.auth||{};
  function current(){ try{return JSON.parse(sessionStorage.getItem(KEY)||"null");}catch{return null;} }
  function login(username,password){
    username=String(username||"").trim(); password=String(password||"");
    for(const role of ["admin","player"]){ const u=cfg()[role]; if(u&&username===u.username&&password===u.password){ const session={username,role,loginAt:Date.now()}; sessionStorage.setItem(KEY,JSON.stringify(session)); return session; } }
    return null;
  }
  function logout(){ sessionStorage.removeItem(KEY); location.reload(); }
  function isAdmin(){ return current()?.role==="admin"; }
  window.RDGAuth={current,login,logout,isAdmin};
})();
