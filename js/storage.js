(function () {
  const cfg = window.GAME_CONFIG;
  let lastError = false;
  const status = (ok) => window.dispatchEvent(new CustomEvent('game-save', {detail:{ok,time:Date.now()}}));
  function validate(data) {
    const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
    const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    if (!object(data) || !Number.isFinite(Number(data.version)) || !object(data.villages) || !Object.keys(data.villages).length) throw new Error('Arquivo de jogo inválido.');
    if (data.speed !== undefined && (!finite(data.speed) || data.speed === 0)) throw new Error('Velocidade inválida no arquivo.');
    const checkKeys = v => {if(v && typeof v==='object')for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('Chave inválida no arquivo.');checkKeys(x);}};
    checkKeys(data);
    for (const [id,v] of Object.entries(data.villages)) {
      if (!object(v) || v.id!==id || !Number.isInteger(v.x) || !Number.isInteger(v.y) || !object(v.resources) || !object(v.buildings) || !object(v.units)) throw new Error('Aldeia inválida no arquivo.');
      for(const r of ['wood','clay','iron']) if(!finite(v.resources[r])) throw new Error('Recursos inválidos no arquivo.');
      for(const n of [...Object.values(v.buildings),...Object.values(v.units)]) if(!finite(n)||!Number.isInteger(n)) throw new Error('Níveis ou tropas inválidos no arquivo.');
      for(const key of ['buildQueue','trainQueue']) {
        if(v[key]!==undefined&&!Array.isArray(v[key]))throw new Error('Fila inválida no arquivo.');
        for(const q of v[key]||[])if(!object(q)||!finite(q.end)||(key==='trainQueue'&&(!finite(q.amount)||!Number.isInteger(q.amount))))throw new Error('Fila inválida no arquivo.');
      }
    }
    for(const key of ['movements','reports','terrain','recurringAttacks'])if(data[key]!==undefined&&!Array.isArray(data[key]))throw new Error('Estrutura inválida no arquivo.');
    for(const m of data.movements||[])if(!object(m)||!object(m.units)||!finite(m.end)||Object.values(m.units).some(n=>!finite(n)||!Number.isInteger(n)))throw new Error('Movimento inválido no arquivo.');
    return data;
  }
  window.GameStorage = {
    save(state) {
      try { localStorage.setItem(cfg.saveKey, JSON.stringify(state)); lastError=false; status(true); return true; }
      catch (error) {
        status(false);
        if(!lastError)window.dispatchEvent(new CustomEvent('game-notify',{detail:{msg:'Não foi possível salvar no navegador. Exporte um backup em Ajustes para preservar seu progresso.',type:'danger'}}));
        lastError=true; return false;
      }
    },
    load() { try { return JSON.parse(localStorage.getItem(cfg.saveKey)); } catch (_) { return null; } },
    clear() { localStorage.removeItem(cfg.saveKey); },
    export(state) {
      const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='reinos-de-guerra-save.json';
      document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    },
    async import(file) {
      if(!file)throw new Error('Selecione um arquivo de jogo.');
      if(file.size>25*1024*1024)throw new Error('O arquivo excede o limite de 25 MB.');
      return validate(JSON.parse(await file.text()));
    },
    validate,
  };
})();
