(function () {
  const C = GAME_CONFIG,
    G = Game,
    $ = (s) => document.querySelector(s),
    fmt = (n) => Math.floor(Number(n) || 0).toLocaleString("pt-BR");
  const trainingGroups = {
    barracks: ["spear", "sword", "axe", "archer"],
    stable: ["scout", "light", "mounted", "heavy"],
    workshop: ["ram", "catapult"],
    academy: ["noble"],
    statue: ["paladin"],
  };
  let view = "village",
    attackTarget = null,
    adminVillageId = null,
    mapZoom = 0.72,
    mapLeft = null,
    mapTop = null,
    showAllBuildings =
      localStorage.getItem("reinosDeGuerra_showAllBuildings") === "1",
    hideMaxBuildings = localStorage.getItem("reinosDeGuerra_hideMaxBuildings") === "1",
    showBuildingNames = localStorage.getItem("rdg_show_building_names") !== "0";
  const isAdmin = () => !!window.RDGAuth?.isAdmin();
  const visibleReports = () => isAdmin() ? G.state.reports : G.state.reports.filter(r => !r.recipients || r.recipients.includes(G.currentPlayerId()) || r.playerId === G.currentPlayerId() || r.attackerPlayerId === G.currentPlayerId() || r.defenderPlayerId === G.currentPlayerId());
  const requireAdmin = () => {
    if (isAdmin()) return true;
    view = "village";
    window.dispatchEvent(new CustomEvent("game-notify", {detail:{msg:"Acesso restrito ao administrador.",type:"warning"}}));
    return false;
  };
  const notifyUI=(msg,type="warning")=>window.dispatchEvent(new CustomEvent("game-notify",{detail:{msg,type}}));
  const modalConfirm=(text)=>new Promise(resolve=>{const el=$("#confirmModal"),ok=$("#confirmModalOk");$("#confirmModalText").textContent=text;let done=false;const finish=v=>{if(done)return;done=true;resolve(v)};ok.onclick=()=>{finish(true);bootstrap.Modal.getOrCreateInstance(el).hide()};el.addEventListener("hidden.bs.modal",()=>finish(false),{once:true});bootstrap.Modal.getOrCreateInstance(el).show();});
  function showInfo(title,body){$("#infoModalTitle").textContent=title;$("#infoModalBody").innerHTML=body;bootstrap.Modal.getOrCreateInstance($("#infoModal")).show();}
  function openPlayerProfile(pid){
    let accounts={};try{accounts=window.RDGAuth?.accounts?.()||{}}catch{} const villages=Object.values(G.state.villages).filter(v=>v.owner==="enemy"?(v.aiId||`ai-${v.id}`)===pid:v.owner==="player"&&v.ownerId===pid); if(!villages.length)return;
    const sample=villages[0], name=sample.owner==="enemy"?(sample.aiName||sample.name||"Inimigo IA"):(Object.values(accounts).find(a=>a.playerId===pid)?.username||(pid==="admin"?"Administrador":pid)); const total=villages.reduce((n,v)=>n+G.points(v),0),cs=G.state.combatStats?.[pid]||{};
    $("#playerProfileTitle").textContent=name; $("#playerProfileBody").innerHTML=`<div class="profile-metrics"><span>★ <strong>${fmt(total)}</strong> pontos</span><span>♜ <strong>${villages.length}</strong> aldeias</span><span>⚔ <strong>${fmt(cs.attackerPoints||0)}</strong> ataque</span><span>🛡 <strong>${fmt(cs.defenderPoints||0)}</strong> defesa</span><span>♛ <strong>${fmt(cs.conquests||0)}</strong> conquistas</span></div><div class="profile-villages mt-3">${villages.sort((a,b)=>G.points(b)-G.points(a)).map(v=>`<button class="profile-village-link" data-village-id="${v.id}"><strong>${v.name}</strong><small>${v.x}|${v.y} · ${fmt(G.points(v))} pts</small></button>`).join("")}</div>`; document.querySelectorAll(".profile-village-link").forEach(b=>b.onclick=()=>{bootstrap.Modal.getOrCreateInstance($("#playerProfileModal")).hide();localStorage.setItem("rdg_map_focus",b.dataset.villageId);view="map";mapLeft=null;mapTop=null;render(true)}); bootstrap.Modal.getOrCreateInstance($("#playerProfileModal")).show();
  }
  let villageMode =
    localStorage.getItem("reinosDeGuerra_villageMode") === "list"
      ? "list"
      : "image";
  // O minimapa começa oculto em instalações/saves que ainda não definiram preferência.
  if (localStorage.getItem("reinosDeGuerra_hideMiniMap") === null)
    localStorage.setItem("reinosDeGuerra_hideMiniMap", "1");
  const remaining = (t) =>
    Math.max(0, Math.ceil((t - Date.now()) / 1000)) + "s";
  const timeText = (s) => {
    s = Math.ceil(Number(s) || 0);
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = s % 60;
    return h ? `${h}h ${m}min ${sec}s` : m ? `${m}min ${sec}s` : `${sec}s`;
  };
  function costs(c) {
    return `<div class="costs"><span>🪵 ${fmt(c.wood)}</span><span>🧱 ${fmt(c.clay)}</span><span>⛓ ${fmt(c.iron)}</span></div>`;
  }
  function requirement(req = {}, v = G.active()) {
    const e = Object.entries(req);
    return e.length && !G.meets(v, req)
      ? `<div class="requirement">Requer: ${e.map(([k, n]) => `${C.buildings[k].name} ${n}`).join(" · ")}</div>`
      : "";
  }
  function bonusLabel(v) {
    const type = v.bonusType || "none",
      b = C.bonusTypes[type];
    if (!type || type === "none") return "";
    const pct = Number(G.state.settings.bonus[type] || 0);
    return `<span class="village-bonus">${b.icon} Bônus: ${b.name} +${pct}%</span>`;
  }
  function bonusText(v) {
    const type = v?.bonusType || "none",
      b = C.bonusTypes[type];
    if (!v || type === "none") return "Sem bônus";
    const pct = Number(G.state.settings.bonus[type] || 0);
    const suffix =
      type === "farm"
        ? " de população máxima"
        : type === "barracks"
          ? " no treinamento do Quartel"
          : type === "stable"
            ? " no treinamento do Estábulo"
            : type === "resources"
              ? " na produção de todos os recursos"
              : type === "storage"
                ? " de capacidade do Armazém"
                : ` na produção de ${b.name.toLowerCase()}`;
    return `${b.icon} ${b.name}: +${pct}%${suffix}`;
  }
  function header() {
    const v = G.active();
    if (!v) {
      $("#villageName").textContent = isAdmin() ? "Administrador sem aldeias" : "Reino derrotado";
      $("#villageSelect").innerHTML = `<option>${isAdmin()?"Nenhuma aldeia do Admin":"Sem aldeias"}</option>`;
      $("#sidebarRenameVillage").innerHTML = "";
      $("#resourceBar").innerHTML = `<span class="resource-pill">★ <strong>0</strong></span><span class="resource-pill">♜ <strong>0 aldeias</strong></span>`;
      $("#villageMeta").textContent = isAdmin() ? "Admin: 0 pontos / 0 aldeias" : "0 pontos / 0 aldeias";
      if ($("#speedDisplay")) $("#speedDisplay").textContent = G.state.speed + "×";
      return;
    }
    updateLive();
    $("#villageName").textContent = v.name;
    $("#villageSelect").innerHTML = G.owned()
      .map(
        (x) =>
          `<option value="${x.id}" ${x.id === v.id ? "selected" : ""}>${x.name} (${x.x}|${x.y})</option>`,
      )
      .join("");
    $("#sidebarRenameVillage").innerHTML = `<form id="renameVillageForm" class="rename-form input-group input-group-sm"><input name="name" class="form-control" maxlength="40" value="${v.name}" aria-label="Novo nome da aldeia"><button class="btn btn-outline-warning">Renomear</button></form>`;
    $("#speedDisplay").textContent = G.state.speed + "×";
    $("#pauseBtn").textContent = G.state.paused ? "Continuar" : "Pausar";
  }
  function updateLive() {
    const v = G.active();
    if (!v) return;
    const cap = G.cap(v);
    $("#resourceBar").innerHTML =
      `<button class="resource-pill resource-info" data-resource="wood">🪵 <strong>${fmt(v.resources.wood)}/${fmt(cap)}</strong></button><button class="resource-pill resource-info" data-resource="clay">🧱 <strong>${fmt(v.resources.clay)}/${fmt(cap)}</strong></button><button class="resource-pill resource-info" data-resource="iron">⛓ <strong>${fmt(v.resources.iron)}/${fmt(cap)}</strong></button><span class="resource-pill">👥 <strong>${G.population(v)}/${G.popCap(v)}</strong></span><span class="resource-pill">★ <strong>${fmt(G.points(v))}</strong></span>`;
    const mine = G.owned(), totalPoints = mine.reduce((n,x)=>n+G.points(x),0);
    $("#villageMeta").textContent =
      `${v.x}|${v.y} · ${G.points(v)} pontos · Lealdade ${v.loyalty} · Reino: ${fmt(totalPoints)} pts / ${mine.length} aldeia${mine.length===1?"":"s"}`;
    if ($("#speedDisplay")) $("#speedDisplay").textContent = G.state.speed + "×";
    if ($("#pauseBtn")) $("#pauseBtn").textContent = G.state.paused ? "Continuar" : "Pausar";
    document
      .querySelectorAll("[data-countdown]")
      .forEach(
        (el) => (el.textContent = remaining(Number(el.dataset.countdown))),
      );
  }
  function growthAsset(v) {
    const p = G.points(v);
    return p < 80
      ? "outpost"
      : p < 180
        ? "hamlet"
        : p < 350
          ? "small"
          : p < 700
            ? "medium"
            : p < 1400
              ? "town"
              : "large";
  }
  const growthNames = {
    outpost: "Posto",
    hamlet: "Povoado",
    small: "Aldeia",
    medium: "Vila",
    town: "Cidade",
    large: "Fortaleza",
  };
  function progressInfo(v) {
    const p = G.points(v),
      steps = [80, 180, 350, 700, 1400, 2800],
      next = steps.find((n) => p < n) || steps.at(-1);
    return {
      percent: Math.min(100, Math.round((p / next) * 100)),
      label:
        p >= steps.at(-1)
          ? "Metrópole fortificada"
          : `${p}/${next} pts para o próximo visual`,
    };
  }
  function buildingAction(k) {
    return k === "keep"
      ? "data-open-buildings"
      : k === "rally"
        ? "data-open-rally"
        : k === "market"
          ? "data-open-market"
        : trainingGroups[k]
          ? `data-open-training="${k}"`
          : `data-quick-build="${k}"`;
  }
  function buildingRows(v, modal = false) {
    return Object.entries(C.buildings)
      .filter(
        ([k, b]) =>
          (!hideMaxBuildings || (v.buildings[k] || 0) < b.maxLevel) && (showAllBuildings ||
          (v.buildings[k] || 0) > 0 ||
          G.meets(v, b.requires)),
      )
      .map(([k, b]) => {
        const lv = v.buildings[k] || 0,
          max = lv >= b.maxLevel,
          c = G.buildingCost(k, v),
          locked = !G.meets(v, b.requires),
          disabled =
            max ||
            locked ||
            (v.buildQueue.length && !(G.state.settings.unlimitedBuildQueue === true || (v.buildings.keep || 0) >= 10)) ||
            !Object.entries(c).every(([r, n]) => v.resources[r] >= n),
          current = G.buildingPoints(k, lv),
          next = max ? current : G.buildingPoints(k, lv + 1);
        return `<tr><td><strong class="building-help" title="${b.description}">${b.icon} ${b.name}</strong>${requirement(b.requires, v)}</td><td>${lv} / ${b.maxLevel}</td><td>${current}${max ? "" : ` → ${next}`}</td><td>${max ? "—" : costs(c)}</td><td>${max ? "—" : G.buildingTime(k, v) + "s"}</td><td><button class="btn btn-sm btn-success ${modal ? "modal-build-btn" : "list-build-btn"}" data-building="${k}" ${disabled ? "disabled" : ""}>${max ? "Máximo" : locked ? "Bloqueado" : "Evoluir"}</button></td></tr>`;
      })
      .join("");
  }
  function village() {
    const v = G.active(),
      progress = progressInfo(v),
      positions = [
        [50, 22],
        [29, 29],
        [71, 29],
        [40, 37],
        [60, 37],
        [22, 46],
        [78, 46],
        [32, 55],
        [68, 55],
        [20, 65],
        [80, 65],
        [29, 75],
        [71, 75],
        [41, 83],
        [59, 83],
        [84, 82],
      ],
      pins = Object.entries(C.buildings)
        .map(([k, b], i) => {
          const lv = v.buildings[k] || 0;
          if (lv < 1) return "";
          return `<button class="level-marker" ${buildingAction(k)} style="left:${positions[i][0]}%;top:${positions[i][1]}%" title="${b.name}: nível ${lv}/${b.maxLevel}" aria-label="${b.name}, nível ${lv}">${showBuildingNames?`<small>${b.name}</small> `:""}<strong>${lv}</strong></button>`;
        })
        .join(""),
      q = v.buildQueue[0],
      construction =
        v.buildQueue
          .map(
            (x, i) =>
              `<div class="queue-item">${i === 0 ? "🏗" : "⌛"} ${C.buildings[x.building]?.name || x.building}<span class="countdown float-end" data-countdown="${x.end}">${remaining(x.end)}</span></div>`,
          )
          .join("") ||
        '<p class="text-secondary mb-0">Nenhuma construção em andamento.</p>',
      training =
        v.trainQueue
          .map(
            (x) =>
              `<div class="queue-item">${C.units[x.unit]?.icon || ""} ${x.amount} ${C.units[x.unit]?.name || x.unit}<span class="countdown float-end" data-countdown="${x.end}">${remaining(x.end)}</span></div>`,
          )
          .join("") ||
        '<p class="text-secondary mb-0">Nenhum treinamento em andamento.</p>',
      movements =
        G.state.movements
          .filter((m) => m.fromId === v.id || m.targetId === v.id)
          .map(
            (m) =>
              `<div class="queue-item">${m.outbound ? "⚔ Em marcha" : "↩ Retornando"} · ${G.state.villages[m.targetId]?.name || "destino"}<span class="countdown float-end" data-countdown="${m.end}">${remaining(m.end)}</span></div>`,
          )
          .join("") ||
        '<p class="text-secondary mb-0">Nenhum movimento ativo.</p>';
    const center =
      villageMode === "image"
        ? `<div class="village-board-wrap"><div class="village-stage compact-stage"><img class="village-art" src="assets/village-${growthAsset(v)}.png" alt="Vista ilustrada de ${v.name}">${pins}</div></div><div class="small text-secondary mt-2">Clique em um nível para abrir ou evoluir o edifício.</div>`
        : `<div class="building-mobile-list">${Object.entries(C.buildings).map(([k,b])=>{const lv=v.buildings[k]||0,locked=!G.meets(v,b.requires),max=lv>=b.maxLevel;if(!showAllBuildings&&locked&&lv===0)return"";if(hideMaxBuildings&&max)return"";const c=max?null:G.buildingCost(k,v);return `<article class="building-list-card" ${buildingAction(k)}><div class="building-list-main"><strong>${b.icon} ${b.name}</strong><span>Nv. ${lv}/${b.maxLevel}</span></div><div class="building-list-meta">${max?"Nível máximo":locked?"Bloqueado":`${costs(c)} · ${G.buildingTime(k,v)}s`}</div><button type="button" class="btn btn-sm btn-success list-build-btn" data-building="${k}" ${max||locked?"disabled":""}>${max?"Máximo":locked?"Bloqueado":"Evoluir"}</button></article>`}).join("")}</div>`;
    $("#view-village").innerHTML =
      `<div class="section-title"><div><div class="eyebrow">Vista do assentamento</div><h2>${v.name} <small class="text-secondary">${G.points(v)} pts</small></h2>${bonusLabel(v)}</div><div class="village-title-actions"><div class="btn-group btn-group-sm"><button class="btn btn-outline-light village-mode ${villageMode === "image" ? "active" : ""}" data-mode="image">Ilustração</button><button class="btn btn-outline-light village-mode ${villageMode === "list" ? "active" : ""}" data-mode="list">Lista</button></div><button id="toggleAllBuildings" class="btn btn-sm btn-outline-secondary" type="button">${showAllBuildings ? "Ocultar bloqueados" : "Mostrar edifícios"}</button><button id="toggleMaxBuildings" class="btn btn-sm btn-outline-info" type="button">${hideMaxBuildings ? "Mostrar finalizados" : "Ocultar finalizados"}</button><button id="toggleBuildingNames" class="btn btn-sm btn-outline-light" type="button">${showBuildingNames?"Ocultar nomes":"Mostrar nomes"}</button></div></div>${q ? `<div class="queue-item mb-3"><strong>Em construção:</strong> ${C.buildings[q.building].name}<span class="countdown float-end" data-countdown="${q.end}">${remaining(q.end)}</span></div>` : ""}<div class="village-progress mb-2"><div><span>Estágio: ${growthNames[growthAsset(v)]}</span><span>${progress.label}</span></div><div class="progress"><div class="progress-bar" style="width:${progress.percent}%"></div></div></div><div class="row g-3 align-items-stretch village-main-layout"><div class="col-lg-8 village-main-area">${center}</div><div class="col-lg-4 village-side-queues"><section class="panel p-3 village-queue-panel"><h3 class="h6">Tropas na aldeia</h3><div class="queue-scroll">${
        Object.entries(C.units)
          .filter(([k]) => (v.units[k] || 0) > 0)
          .map(
            ([k, u]) =>
              `<div class="queue-item">${u.icon} ${u.name}<strong class="float-end">${fmt(v.units[k] || 0)}</strong></div>`,
          )
          .join("") ||
        '<p class="text-secondary mb-0">Nenhuma tropa na aldeia.</p>'
      }</div></section><section class="panel p-3 village-queue-panel"><h3 class="h6">Construções</h3><div class="queue-scroll">${construction}</div></section><section class="panel p-3 village-queue-panel"><h3 class="h6">Fila de treinamento</h3><div class="queue-scroll">${training}</div></section><section class="panel p-3 village-queue-panel"><h3 class="h6">Movimentos</h3><div class="queue-scroll">${movements}</div></section></div></div>`;
  }
  function buildingsModal() {
    const v = G.active();
    const cards = Object.entries(C.buildings).map(([k,b])=>{
      const lv=v.buildings[k]||0, locked=!G.meets(v,b.requires), max=lv>=b.maxLevel;
      if(!showAllBuildings&&locked&&lv===0)return "";
      if(hideMaxBuildings&&max)return "";
      const c=max?null:G.buildingCost(k,v);
      return `<article class="building-list-card modal-building-card" data-building-card="${k}"><div class="building-list-main"><strong>${b.icon} ${b.name}</strong><span>Nv. ${lv}/${b.maxLevel}</span></div><div class="building-list-meta">${max?"Nível máximo":locked?`Bloqueado ${requirement(b.requires,v)}`:`${costs(c)} · ${G.buildingTime(k,v)}s`}</div><button type="button" class="btn btn-sm btn-success modal-build-btn" data-building="${k}" ${max||locked?"disabled":""}>${max?"Máximo":locked?"Bloqueado":"Evoluir"}</button></article>`;
    }).join("");
    $("#buildingsModalBody").innerHTML = `<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><div class="small text-secondary">Edifícios ocultos aparecem quando seus requisitos são alcançados.</div><button id="modalToggleAllBuildings" class="btn btn-sm btn-outline-secondary" type="button">${showAllBuildings ? "Ocultar bloqueados" : "Mostrar edifícios"}</button></div><div class="building-mobile-list">${cards}</div>`;
    $("#modalToggleAllBuildings").onclick = () => { showAllBuildings=!showAllBuildings; localStorage.setItem("reinosDeGuerra_showAllBuildings",showAllBuildings?"1":"0"); buildingsModal(); bindDynamic(); };
    document.querySelectorAll(".modal-build-btn").forEach(b=>b.onclick=e=>{e.stopPropagation();G.build(b.dataset.building);buildingsModal();bindDynamic();});
  }
  function simulator(seed=null){
    const v=G.active(),def=seed?.units||{},title=seed?.label||"Preenchimento manual";
    const fields=(prefix,data)=>Object.entries(C.units).map(([k,u])=>`<label class="sim-unit"><span>${u.icon} ${u.name}</span><input class="form-control form-control-sm" type="number" min="0" name="${prefix}-${k}" value="${data[k]||0}"></label>`).join("");
    $("#view-simulator").innerHTML=`<div class="section-title"><div><div class="eyebrow">Laboratório militar</div><h2>Simulador de Combate</h2></div></div><div class="alert alert-secondary py-2">Defensor: ${title}. Simulações nunca alteram o mundo.</div><form id="simulatorForm"><div class="row g-3"><div class="col-lg-6"><section class="panel p-3"><h3 class="h6">Atacante</h3><div class="d-flex gap-2 mb-2"><button type="button" class="btn btn-sm btn-outline-danger sim-preset" data-preset="attackTroops">Ataque</button><button type="button" class="btn btn-sm btn-outline-secondary sim-clear">Limpar</button></div><div class="sim-grid">${fields("a",{})}</div></section></div><div class="col-lg-6"><section class="panel p-3"><h3 class="h6">Defensor</h3><div class="d-flex gap-2 mb-2"><button type="button" class="btn btn-sm btn-outline-info sim-preset-defense">Defesa</button></div><div class="sim-grid">${fields("d",def)}</div><label class="form-label mt-2">Muralha<input name="wall" type="number" min="0" max="20" class="form-control" value="${seed?.wall||0}"></label></section></div></div><button class="btn btn-warning mt-3">Simular</button><div id="simResult" class="panel p-3 mt-3 d-none"></div></form>`;
  }
  function unitsTable(data) {
    return `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Unidade</th><th>Enviadas/presentes</th><th>Mortas</th><th>Restantes</th></tr></thead><tbody>${
      Object.keys(C.units)
        .filter((k) => data.before[k] || data.losses[k] || data.survivors[k])
        .map(
          (k) =>
            `<tr><td>${C.units[k].icon} ${C.units[k].name}</td><td>${fmt(data.before[k])}</td><td class="unit-dead">${fmt(data.losses[k])}</td><td class="unit-alive">${fmt(data.survivors[k])}</td></tr>`,
        )
        .join("") || '<tr><td colspan="4">Nenhuma unidade.</td></tr>'
    }</tbody></table></div>`;
  }
  function reportModal(r) {
    $("#reportModalTitle").textContent = r.victory ? "Vitória" : "Derrota";
    const intel = r.intel
      ? `<section class="report-section"><h3 class="h5">Espionagem</h3><p class="${r.intel.success ? "text-success" : "text-warning"}">${r.intel.reason}</p>${
          r.intel.success
            ? `<h4 class="h6">Recursos observados</h4>${costs(r.intel.resources)}<h4 class="h6 mt-3">Edifícios</h4><div class="intel-grid">${Object.entries(
                r.intel.buildings,
              )
                .filter(([, n]) => n)
                .map(([k, n]) => `<span>${C.buildings[k].name} ${n}</span>`)
                .join(
                  "",
                )}</div><h4 class="h6 mt-3">Tropas restantes</h4><div class="intel-grid">${
                Object.entries(r.intel.units)
                  .filter(([, n]) => n)
                  .map(
                    ([k, n]) =>
                      `<span>${C.units[k].icon} ${C.units[k].name}: ${fmt(n)}</span>`,
                  )
                  .join("") || "Nenhuma"
              }</div>`
            : ""
        }</section>`
      : "";
    const noble = r.loyaltyDamage
      ? `<section class="report-section mt-3"><h3 class="h5">Nobre e lealdade</h3><div class="text-warning">A aldeia perdeu <strong>${r.loyaltyDamage}%</strong> de lealdade: <strong>${r.loyaltyBefore ?? "?"}% → ${r.loyaltyAfter ?? Math.max(0, (r.loyaltyBefore ?? 100) - r.loyaltyDamage)}%</strong>.</div>${r.conquered ? '<div class="text-success mt-1">Conquistada; a lealdade da nova posse foi restaurada para 100%.</div>' : ""}</section>`
      : "";
    const reportBonus =
      r.defenderBonus?.type && r.defenderBonus.type !== "none"
        ? `<section class="report-section mt-3"><h3 class="h5">Bônus da aldeia atacada</h3><div>${C.bonusTypes[r.defenderBonus.type]?.icon || ""} <strong>${C.bonusTypes[r.defenderBonus.type]?.name || r.defenderBonus.type}</strong>: +${r.defenderBonus.value}%</div></section>`
        : `<section class="report-section mt-3"><h3 class="h5">Bônus da aldeia atacada</h3><div class="text-secondary">Sem bônus</div></section>`;
    const siegeRows = [];
    if (r.siege?.ram)
      siegeRows.push(
        `<div>▰ Aríetes: Muralha nível ${r.siege.ram.before} → ${r.siege.ram.after} <strong class="text-danger">(-${r.siege.ram.levelsDestroyed} níveis)</strong> · ${r.siege.ram.sent} enviados</div>`,
      );
    if (r.siege?.catapult) {
      const x = r.siege.catapult;
      siegeRows.push(
        `<div>◒ Catapultas: ${C.buildings[x.building]?.name || x.building} nível ${x.before} → ${x.after} <strong class="text-danger">(-${x.levelsDestroyed} níveis)</strong> · ${x.sent} enviadas</div>`,
      );
    }
    const siege = siegeRows.length
      ? `<section class="report-section mt-3"><h3 class="h5">Destruição</h3>${siegeRows.join("")}</section>`
      : "";
    const reports = visibleReports();
    const reportIndexes = reports.map((x, i) => x?.attacker ? i : -1).filter(i => i >= 0);
    const currentIndex = reports.indexOf(r);
    const navPos = reportIndexes.indexOf(currentIndex);
    const prevIndex = navPos > 0 ? reportIndexes[navPos - 1] : null;
    const nextIndex = navPos >= 0 && navPos < reportIndexes.length - 1 ? reportIndexes[navPos + 1] : null;
    const nav = `<div class="d-flex justify-content-between align-items-center gap-2 mb-3 report-modal-nav"><button type="button" id="reportPrev" class="btn btn-sm btn-outline-light" ${prevIndex === null ? "disabled" : ""}>← Relatório anterior</button><span class="small text-secondary">${navPos >= 0 ? navPos + 1 : 1} de ${reportIndexes.length}</span><button type="button" id="reportNext" class="btn btn-sm btn-outline-light" ${nextIndex === null ? "disabled" : ""}>Próximo relatório →</button></div>`;
    $("#reportModalBody").innerHTML =
      `${nav}<div class="battle-route"><strong>${r.attacker.name}</strong> (${r.attacker.x}|${r.attacker.y}) <span>→</span> <strong>${r.defender.name}</strong> (${r.defender.x}|${r.defender.y})</div><div class="row g-3 mt-1"><div class="col-lg-6"><section class="report-section"><h3 class="h5">Tropas atacantes</h3>${unitsTable(r.attacking)}</section></div><div class="col-lg-6"><section class="report-section"><h3 class="h5">Tropas defensoras</h3>${unitsTable(r.defending)}</section></div></div><section class="report-section mt-3"><h3 class="h5">Recursos saqueados</h3>${costs(r.loot)}${r.conquered ? '<div class="text-success mt-2">A aldeia foi conquistada.</div>' : ""}</section>${noble}${reportBonus}${siege}${intel}<div class="d-flex gap-2 flex-wrap mt-3">${r.intel?.units?`<button class="btn btn-sm btn-warning report-sim-spy" data-report-id="${r.id}">Usar tropas espionadas no Simulador</button>`:""}${r.defending?.survivors?`<button class="btn btn-sm btn-outline-warning report-sim-survivors" data-report-id="${r.id}">Simular com sobreviventes</button>`:""}</div>`;
    if ($("#reportPrev") && prevIndex !== null) $("#reportPrev").onclick = () => reportModal(reports[prevIndex]);
    if ($("#reportNext") && nextIndex !== null) $("#reportNext").onclick = () => reportModal(reports[nextIndex]);
    bootstrap.Modal.getOrCreateInstance($("#reportModal")).show();
  }

  function reports() {
    const all=visibleReports(), filter=localStorage.getItem("rdg_report_filter")||"all", stateFilter=localStorage.getItem("rdg_report_state")||"all";
    const classify=r=>r.conquered?"conquest":r.intel?.spied?"spy":r.attacker?"battle":"info";
    const reports=all.filter(r=>(filter==="all"||classify(r)===filter)&&(stateFilter==="all"||(stateFilter==="unread"?!r.read:stateFilter==="favorite"?r.favorite:r.read)));
    const items=reports.map((r,i)=>r.attacker?`<div class="report-row ${r.read?"":"report-unread"}"><input class="form-check-input report-check" type="checkbox" value="${r.id}"><button class="btn btn-sm report-favorite" data-report-id="${r.id}" title="Favorito">${r.favorite?"★":"☆"}</button><button class="log-entry report-summary ${r.type}" data-report-id="${r.id}"><span class="result-badge">${r.victory?"Vitória":"Derrota"}</span><span><strong>${r.attacker.name}</strong> (${r.attacker.x}|${r.attacker.y}) → <strong>${r.defender.name}</strong> (${r.defender.x}|${r.defender.y})</span><small>${new Date(r.time).toLocaleString("pt-BR")}</small></button><button class="btn btn-sm btn-outline-danger report-delete" data-report-id="${r.id}">Excluir</button></div>`:`<div class="report-row"><button class="log-entry report-summary" data-report-id="${r.id}"><strong>${r.title||"Informação"}</strong><small>${r.text||""}</small></button></div>`).join("");
    $("#view-reports").innerHTML=`<div class="section-title"><div><div class="eyebrow">Crônicas militares</div><h2>Relatórios 2.0</h2></div></div><section class="panel p-2 mb-3 d-flex flex-wrap gap-2"><select id="reportTypeFilter" class="form-select form-select-sm" style="width:auto"><option value="all">Todos os tipos</option><option value="battle">Ataques/defesas</option><option value="spy">Espionagem</option><option value="conquest">Conquistas</option><option value="info">Informações</option></select><select id="reportStateFilter" class="form-select form-select-sm" style="width:auto"><option value="all">Todos</option><option value="unread">Não lidos</option><option value="read">Lidos</option><option value="favorite">Favoritos</option></select><button id="reportDeleteSelected" class="btn btn-sm btn-outline-danger">Excluir selecionados</button>${all.length?'<button id="deleteAllReports" class="btn btn-outline-danger btn-sm">Excluir todos</button>':""}</section>${items||'<p class="text-secondary">Nenhum relatório neste filtro.</p>'}`;
    $("#reportTypeFilter").value=filter; $("#reportStateFilter").value=stateFilter;
  }
  function rewardText(r={}){const parts=[];if(r.storagePercent)parts.push(`+${r.storagePercent}% de recursos/capacidade conforme a recompensa`);if(r.noble)parts.push(`+${r.noble} Nobre${r.noble>1?"s":""}`);if(r.nobleActive)parts.push(`+${r.nobleActive} Nobre na aldeia ativa`);if(r.noblePerAcademy)parts.push(`+${r.noblePerAcademy} Nobres por aldeia com Academia`);const troops=r.troops||{};const ts=Object.entries(troops).filter(([,q])=>q).map(([k,q])=>`${fmt(q)} ${C.units[k]?.name||k}`);if(ts.length)parts.push(ts.join(" + "));if(r.roleTroops)parts.push("Pacote militar conforme o perfil da aldeia");return parts.join(" · ")||"Recompensa especial";}
  function achievements(){
    G.refreshAchievements(); const key=G.currentPlayerId(), st=G.state.achievements?.[key]||{}, villages=G.owned();
    const labels={village:"Aldeia",development:"Desenvolvimento",military:"Militar",conquest:"Conquista",points:"Pontos"};
    const cards=[];
    (C.achievements||[]).forEach(a=>{
      if(a.repeat==="firstVillage"){const v=(G.state.players?.[key]?.firstVillageId&&G.state.villages[G.state.players[key].firstVillageId])||villages[0],x=st[a.id]||{},p=G.achievementProgress(a,key),status=x.claimed?"Resgatada":x.unlocked?(x.pending?"Em espera":"Disponível"):"Bloqueada";cards.push(`<article class="panel p-3 achievement-card" data-category="${a.category||"village"}"><div class="d-flex justify-content-between gap-2"><div><div class="eyebrow">${labels[a.category]||"Aldeia"} · ${status}</div><h3 class="h6 mb-1">${a.name}</h3><small class="text-secondary">Primeira aldeia${v?` — ${v.name} (${v.x}|${v.y})`:""} · Progresso: ${fmt(Math.min(p,a.target))} / ${fmt(a.target)}</small><div class="achievement-reward mt-2"><strong>Recompensa:</strong> ${rewardText(a.reward)}</div></div>${x.unlocked&&!x.claimed?`<button class="btn btn-sm btn-warning claim-achievement" data-id="${a.id}">Resgatar</button>`:""}</div>${x.pending?'<div class="text-warning small mt-2">Em espera: libere espaço no Armazém/Fazenda e tente novamente.</div>':''}</article>`);}
      else if(a.repeat==="perVillage") villages.forEach(v=>{const x=st[a.id]?.villages?.[v.id]||{},p=G.achievementProgress(a,key,v.id),status=x.claimed?"Resgatada":x.unlocked?(x.pending?"Em espera":"Disponível"):"Bloqueada";cards.push(`<article class="panel p-3 achievement-card" data-category="${a.category||"village"}"><div class="d-flex justify-content-between gap-2"><div><div class="eyebrow">${labels[a.category]||"Aldeia"} · ${status}</div><h3 class="h6 mb-1">${a.name}</h3><small class="text-secondary">${v.name} (${v.x}|${v.y}) · Progresso: ${fmt(Math.min(p,a.target))} / ${fmt(a.target)}</small><div class="achievement-reward mt-2"><strong>Recompensa:</strong> ${rewardText(a.reward)}</div></div>${x.unlocked&&!x.claimed?`<button class="btn btn-sm btn-warning claim-achievement" data-id="${a.id}" data-village-id="${v.id}">Resgatar</button>`:""}</div>${x.pending?'<div class="text-warning small mt-2">Em espera: libere espaço no Armazém/Fazenda e tente novamente.</div>':''}</article>`)});
      else {const x=st[a.id]||{},p=G.achievementProgress(a,key),status=x.claimed?"Resgatada":x.unlocked?(x.pending?"Em espera":"Disponível"):"Bloqueada",tiers=a.tiers||[],tierNames=["Madeira","Bronze","Prata","Ouro"],tierText=tiers.length?` · ${tierNames[Math.max(0,tiers.filter(t=>p>=t).length-1)]||"Madeira"}`:"";cards.push(`<article class="panel p-3 achievement-card" data-category="${a.category||"player"}"><div class="d-flex justify-content-between gap-2"><div><div class="eyebrow">${labels[a.category]||"Reino"} · ${status}${tierText}</div><h3 class="h6 mb-1">${a.name}</h3><small class="text-secondary">Progresso: ${fmt(Math.min(p,a.target))} / ${fmt(a.target)}</small><div class="achievement-reward mt-2"><strong>Recompensa:</strong> ${rewardText(a.reward)}</div></div>${x.unlocked&&!x.claimed?`<button class="btn btn-sm btn-warning claim-achievement" data-id="${a.id}">Resgatar</button>`:""}</div>${x.pending?'<div class="text-warning small mt-2">Em espera: libere espaço no Armazém/Fazenda e tente novamente.</div>':''}</article>`);}
    });
    $("#view-achievements").innerHTML=`<div class="section-title"><div><div class="eyebrow">Progresso unificado</div><h2>Conquistas</h2></div></div><p class="view-subtitle">Os marcos iniciais valem somente para a primeira aldeia. Depois, a progressão passa a considerar o jogador e o reino como um todo.</p><div class="achievement-grid">${cards.join("")||'<p class="text-secondary">Nenhuma conquista disponível.</p>'}</div>`;
  }
  function settings() {
    const s = G.state.settings,
      b = s.bonus,
      help = (t) => `<div class="setting-help">${t}</div>`;
    $("#view-settings").innerHTML =
      `<div class="section-title"><div><div class="eyebrow">Controle do mundo</div><h2>Ajustes e salvamento</h2></div></div><div class="settings-tabs panel p-2 mb-3"><button type="button" class="btn btn-sm settings-tab-btn active" data-settings-tab="speed">Velocidade</button><button type="button" class="btn btn-sm settings-tab-btn" data-settings-tab="world">Mundo</button><button type="button" class="btn btn-sm settings-tab-btn" data-settings-tab="bonus">Bônus</button><button type="button" class="btn btn-sm settings-tab-btn" data-settings-tab="rules">Regras e objetivo</button><button type="button" class="btn btn-sm settings-tab-btn" data-settings-tab="gameplay">Jogabilidade</button></div><form id="settingsForm"><section class="panel p-4 settings-pane" data-settings-pane="speed"><h3 class="h5">Velocidade e multiplicadores</h3><div class="rule-card mb-3"><strong>Preset do mundo</strong><div class="d-flex flex-wrap gap-2">${Object.entries(C.worldPresets||{}).map(([k,p])=>`<button type="button" class="btn btn-sm btn-outline-warning world-preset" data-preset="${k}">${p.label}</button>`).join("")}</div><small class="text-secondary">Conquistadores: acelerado, sem limite de duração e focado em eliminar todos os inimigos.</small></div><div class="row g-3"><div class="col-md-4"><label class="form-label">Ritmo do jogo</label><select name="speed" class="form-select">${C.speedOptions.map((n) => `<option value="${n}" ${n === G.state.speed ? "selected" : ""}>${n}×</option>`).join("")}</select>${help("Acelera produção, obras, treino e deslocamentos.")}</div><div class="col-md-4"><label class="form-label">Madeira</label><input name="wood" type="number" min=".1" step=".1" class="form-control" value="${s.production.wood}">${help("1 é a produção normal; 2 produz o dobro.")}</div><div class="col-md-4"><label class="form-label">Argila</label><input name="clay" type="number" min=".1" step=".1" class="form-control" value="${s.production.clay}">${help("Multiplica a produção de argila em todas as aldeias.")}</div><div class="col-md-4"><label class="form-label">Ferro</label><input name="iron" type="number" min=".1" step=".1" class="form-control" value="${s.production.iron}">${help("Multiplica a produção de ferro em todas as aldeias.")}</div><div class="col-md-4"><label class="form-label">Custos de edifícios</label><input name="cost" type="number" min=".1" step=".1" class="form-control" value="${s.buildCostMultiplier}">${help("Abaixo de 1 barateia; acima de 1 encarece construções.")}</div><div class="col-md-4"><label class="form-label">Tempo de construção</label><input name="time" type="number" min=".1" step=".1" class="form-control" value="${s.buildTimeMultiplier}">${help("Abaixo de 1 acelera; acima de 1 deixa obras mais lentas.")}</div><div class="col-md-4"><label class="form-label">Viagem por campo (s)</label><input name="travel" type="number" min="1" class="form-control" value="${s.travelSecondsPerTile}">${help("Tempo-base para atravessar um campo antes da velocidade da tropa.")}</div></div><button type="button" class="btn btn-success mt-3 save-settings-tab" data-save-tab="speed">Salvar velocidade</button></section><section class="panel p-4 settings-pane" data-settings-pane="world"><h3 class="h5">Configuração do mundo</h3><div class="row g-3"><div class="col-md-4"><label class="form-label">Nome do mundo</label><input name="worldName" class="form-control" maxlength="50" value="${s.worldName || C.worldName}">${help("Pode ser alterado a qualquer momento.")}</div><div class="col-md-4"><label class="form-label">Referência de pontuação inicial</label><input name="startingPoints" type="number" min="0" class="form-control" value="${s.startingVillagePoints ?? C.startingVillagePoints}" readonly>${help("A pontuação real é calculada pelos níveis dos edifícios, descontando os níveis gratuitos configurados.")}</div></div><button type="button" class="btn btn-success mt-3 save-settings-tab" data-save-tab="world">Salvar mundo</button><hr><div class="d-flex flex-wrap gap-2 align-items-center mb-2"><h4 class="h6 mb-0 me-auto">Níveis iniciais dos edifícios</h4><button type="button" id="settingsHalfPreset" class="btn btn-sm btn-outline-info">Preencher 50%</button><button type="button" id="settingsLoadCustomPreset" class="btn btn-sm btn-outline-secondary">Usar personalizável</button><button type="button" id="settingsSaveCustomPreset" class="btn btn-sm btn-outline-secondary">Salvar personalizável</button></div><div class="row g-2">${Object.entries(
        C.buildings,
      )
        .map(
          ([k, x]) =>
            `<div class="col-md-3"><label class="form-label">${x.icon} ${x.name}</label><input name="initial-${k}" type="number" min="0" max="${x.maxLevel}" class="form-control" value="${s.initialBuildingLevels?.[k] ?? C.initialBuildingLevels[k] ?? 0}"></div>`,
        )
        .join(
          "",
        )}</div></section><section class="panel p-4 settings-pane" data-settings-pane="bonus"><h3 class="h5">Bônus das aldeias</h3><div class="row g-3"><div class="col-md-3"><label class="form-label">Chance de aldeia bônus (%)</label><input name="bonusChance" type="number" min="0" max="100" class="form-control" value="${b.chance}"></div>${[
        ["wood", "Madeira"],
        ["clay", "Argila"],
        ["iron", "Ferro"],
        ["farm", "Fazenda/população"],
        ["resources", "Todos os recursos"],
        ["barracks", "Quartel: custo e treino"],
        ["stable", "Estábulo: custo e treino"],
        ["storage", "Armazém/capacidade"],
      ]
        .map(
          ([k, n]) =>
            `<div class="col-md-3"><label class="form-label">${n} (%)</label><input name="bonus-${k}" type="number" min="0" max="90" class="form-control" value="${b[k]}"></div>`,
        )
        .join(
          "",
        )}</div><div class="setting-help mt-2">As porcentagens definem a força de cada bônus. A chance é usada ao gerar novas aldeias.</div><button type="button" class="btn btn-success mt-3 save-settings-tab" data-save-tab="bonus">Salvar bônus</button></section><section class="panel p-4 settings-pane" data-settings-pane="rules"><h3 class="h5">Regras, IA e objetivo</h3><div class="row g-3"><div class="col-md-6"><label class="form-label">Ritmo das aldeias livres</label><select id="newDifficulty" class="form-select">${Object.entries(
        C.difficulties,
      )
        .map(
          ([k, d]) =>
            `<option value="${k}" ${k === s.difficulty ? "selected" : ""}>${d.name}</option>`,
        )
        .join(
          "",
        )}</select><div class="setting-help mt-3">Recrutamento de bárbaras e aldeias bônus foi movido para Jogabilidade, com controles separados.</div></div><div class="col-md-6"><label class="form-label">Objetivo</label><select id="newObjective" class="form-select">${Object.entries(
        C.objectives,
      )
        .map(
          ([k, o]) =>
            `<option value="${k}" ${k === s.objective ? "selected" : ""}>${o.name}</option>`,
        )
        .join(
          "",
        )}</select></div></div><button type="button" class="btn btn-success mt-3 save-settings-tab" data-save-tab="rules">Salvar regras e objetivo</button><div class="d-flex flex-wrap gap-2 mt-3"><button id="newWorldBtn" type="button" class="btn btn-outline-danger">Criar novo mundo</button><button id="defaultsBtn" type="button" class="btn btn-outline-secondary">Restaurar balanceamento</button><button id="exportBtn" type="button" class="btn btn-outline-warning">Exportar save</button><button id="importBtn" type="button" class="btn btn-outline-light">Importar save</button></div></section><section class="panel p-4 settings-pane" data-settings-pane="gameplay"><div class="section-kicker">Regras de progressão</div><h3 class="h5">Jogabilidade e aldeias livres</h3><p class="view-subtitle mb-3">Regras globais que afetam todos os participantes. Ferramentas de edição continuam na Administração.</p><div class="row g-3"><div class="col-md-4"><label class="form-label">População mínima por ataque</label><input name="minimumAttackPopulation" type="number" min="1" class="form-control" value="${s.minimumAttackPopulation??C.minimumAttackPopulation??10}"><div class="setting-help">Apoios não usam este limite.</div></div><div class="col-md-4"><div class="rule-card"><strong>Bárbaras</strong><label class="form-check"><input class="form-check-input" name="barbarianBuild" type="checkbox" ${s.freeVillageRules?.barbariansBuild!==false?"checked":""}> Evoluem edifícios</label><label class="form-check"><input class="form-check-input" name="barbarianRecruit" type="checkbox" ${s.freeVillageRules?.barbariansRecruit===true?"checked":""}> Recrutam tropas</label></div></div><div class="col-md-4"><div class="rule-card"><strong>Aldeias bônus</strong><label class="form-check"><input class="form-check-input" name="bonusBuild" type="checkbox" ${s.freeVillageRules?.bonusBuild!==false?"checked":""}> Evoluem edifícios</label><label class="form-check"><input class="form-check-input" name="bonusRecruit" type="checkbox" ${s.freeVillageRules?.bonusRecruit===true?"checked":""}> Recrutam tropas</label></div></div><div class="col-md-6"><div class="rule-card"><strong>Proteção inicial</strong><label class="form-check"><input class="form-check-input" name="protectionEnabled" type="checkbox" ${s.beginnerProtection?.enabled!==false?"checked":""}> Ativada</label><label class="form-label">Duração (minutos)</label><input name="protectionMinutes" type="number" min="0" class="form-control" value="${s.beginnerProtection?.minutes??15}"></div></div><div class="col-md-6"><div class="rule-card"><strong>Mercado global</strong><label class="form-label">Capacidade por recurso</label><input name="marketCapacity" type="number" min="1" class="form-control" value="${s.marketServer?.capacityPerResource??600000}"><label class="form-label mt-2">Multiplicador de regeneração</label><input name="marketRegen" type="number" min="0" step=".1" class="form-control" value="${s.marketServer?.regenerationMultiplier??1}"></div></div><div class="col-12"><div class="rule-card"><strong>Bônus periódico global</strong><div class="row g-2 mt-1"><div class="col-md-2"><label class="form-check"><input class="form-check-input" name="periodicBonusEnabled" type="checkbox" ${s.periodicResourceBonus?.enabled!==false?"checked":""}> Ativado</label></div><div class="col-md-2"><label class="form-label">Intervalo (min)</label><input class="form-control" name="periodicBonusInterval" type="number" min="1" value="${s.periodicResourceBonus?.intervalMinutes??20}"></div><div class="col-md-2"><label class="form-label">Cada recurso</label><input class="form-control" name="periodicBonusAmount" type="number" min="0" value="${s.periodicResourceBonus?.amount??1000}"></div><div class="col-md-6 d-flex flex-wrap gap-3 align-items-end"><label class="form-check"><input class="form-check-input" name="periodicPlayers" type="checkbox" ${s.periodicResourceBonus?.players!==false?"checked":""}> Jogadores</label><label class="form-check"><input class="form-check-input" name="periodicEnemies" type="checkbox" ${s.periodicResourceBonus?.enemies!==false?"checked":""}> IAs</label><label class="form-check"><input class="form-check-input" name="periodicBarbs" type="checkbox" ${s.periodicResourceBonus?.barbarians!==false?"checked":""}> Bárbaras</label><label class="form-check"><input class="form-check-input" name="periodicBonusVillages" type="checkbox" ${s.periodicResourceBonus?.bonusVillages!==false?"checked":""}> Bônus</label></div></div></div></div><div class="col-12"><div class="rule-card"><strong>Conquistas unificadas</strong><div class="setting-help">Marcos iniciais são únicos e vinculados à primeira aldeia; conquistas posteriores acumulam o progresso global do jogador.</div></div></div><div class="col-lg-6"><label class="form-label">Marcos de pontos → recursos</label><textarea rows="7" class="form-control font-monospace" readonly>${JSON.stringify((C.achievements||[]).filter(a=>a.type==="villagePoints"),null,2)}</textarea><div class="setting-help">storagePercent é a porcentagem da capacidade do Armazém entregue em cada recurso.</div></div><div class="col-lg-6"><label class="form-label">Marcos de evolução → tropas</label><textarea rows="7" class="form-control font-monospace" readonly>${JSON.stringify((C.achievements||[]).filter(a=>a.type==="villageProgress"),null,2)}</textarea><div class="setting-help">percent usa a evolução total da aldeia. Cada marco é recebido uma única vez pelo jogador, usando apenas a primeira aldeia.</div></div></div><button type="button" class="btn btn-success mt-3 save-settings-tab" data-save-tab="gameplay">Salvar jogabilidade</button></section></form>`;
  }
  function unitCard(k) {
    const v = G.active(), u = C.units[k];
    if (!v || !u) return "";
    const unlocked = G.meets(v, u.requires || {});
    const c = G.unitCost(k, v);
    const queued = (v.trainQueue || []).filter(q => q.unit === k).reduce((n,q)=>n+Math.max(0,(q.amount||0)-(q.trained||0)),0);
    return `<article class="panel p-3 unit-card"><div class="d-flex justify-content-between gap-2"><strong>${u.icon||"⚔"} ${u.name}</strong><span>${fmt(v.units[k]||0)}${queued?` <small class="text-warning">(+${fmt(queued)})</small>`:""}</span></div><div class="small text-secondary mt-2">${unlocked?`${costs(c)} · ${Math.max(1,Math.round(G.unitTrainTime(k,v)))}s/un.`:"Requisitos ainda não atendidos"}</div><div class="input-group input-group-sm mt-2"><input class="form-control recruit-amount" data-unit="${k}" type="number" min="1" value="1" ${unlocked?"":"disabled"}><button class="btn btn-warning recruit-btn" data-unit="${k}" ${unlocked?"":"disabled"}>Treinar</button></div></article>`;
  }

  function trainingModal(facility) {
    const v=G.active(), keys=trainingGroups[facility]||[];
    if(!v || !keys.length) return;
    const b=C.buildings[facility];
    $("#trainingModalTitle").textContent=`${b?.icon||"⚔"} ${b?.name||"Treinar tropas"}`;
    const cards=keys.map(k=>unitCard(k)).join("");
    const queue=(v.trainQueue||[]).filter(q=>(q.facility||"")===facility || keys.includes(q.unit)).map(q=>`<div class="queue-item d-flex justify-content-between gap-2"><span>${C.units[q.unit]?.icon||""} ${C.units[q.unit]?.name||q.unit}</span><strong>${fmt(q.trained||0)}/${fmt(q.amount||0)}</strong></div>`).join("");
    $("#trainingModalBody").innerHTML=`<div class="row g-2">${keys.map(k=>`<div class="col-12 col-md-6">${unitCard(k)}</div>`).join("")}</div><hr><h3 class="h6">Fila deste edifício</h3>${queue||'<p class="small text-secondary mb-0">Nenhum treinamento na fila.</p>'}`;
    bootstrap.Modal.getOrCreateInstance($("#trainingModal")).show();
    $("#trainingModalBody").querySelectorAll(".recruit-btn").forEach(b=>b.onclick=()=>{const i=$("#trainingModalBody").querySelector(`.recruit-amount[data-unit="${b.dataset.unit}"]`);G.recruit(b.dataset.unit,Number(i?.value||1));});
  }

  function army() {
    const v=G.active();
    const preset = (name,obj) => `<button type="button" class="btn btn-sm btn-outline-warning army-preset" data-preset="${name}">${name}</button>`;
    $("#view-army").innerHTML = `<div class="section-title"><div><div class="eyebrow">Forças do domínio</div><h2>Exército</h2></div><span class="text-secondary">População livre: ${fmt(Math.max(0,G.popCap(v)-G.population(v)))}</span></div>
    <section class="panel p-3 mb-3"><div class="d-flex gap-2 flex-wrap align-items-center"><strong>Treino rápido:</strong>${preset("Defesa")}${preset("Ataque")}${preset("Personalizado")}<button id="saveArmyCustom" type="button" class="btn btn-sm btn-outline-secondary">Salvar atual como personalizado</button></div><div class="small text-secondary mt-2">O preset adiciona à fila uma composição proporcional aos recursos e população disponíveis.</div></section>
    <div class="row g-2 army-compact">${Object.keys(C.units).map(k=>`<div class="col-md-4 col-xl-3">${unitCard(k)}</div>`).join("")}</div>`;
  }

  function market(){
    G.updateMarket();const m=G.state.market||{resources:{}},v=G.active();
    $("#view-market").innerHTML=`<div class="section-title"><div><div class="eyebrow">Comércio do mundo</div><h2>Mercado</h2></div></div><div class="market-stock">${["wood","clay","iron"].map(r=>`<div class="panel p-3"><small>${r==="wood"?"Madeira":r==="clay"?"Argila":"Ferro"}</small><strong>${fmt(m.resources[r]||0)} / ${fmt(G.state.settings.marketServer?.capacityPerResource||600000)}</strong></div>`).join("")}</div><form id="marketExchangeForm" class="panel p-3 mt-3"><h3 class="h6">Trocar com o servidor</h3><div class="row g-2"><div class="col-md-3"><label class="form-label">Entregar</label><select name="give" class="form-select"><option value="wood">Madeira</option><option value="clay">Argila</option><option value="iron">Ferro</option></select></div><div class="col-md-3"><label class="form-label">Receber</label><select name="take" class="form-select"><option value="clay">Argila</option><option value="wood">Madeira</option><option value="iron">Ferro</option></select></div><div class="col-md-3"><label class="form-label">Quantidade</label><input name="amount" type="number" min="1" class="form-control" value="500"></div><div class="col-md-3 d-flex align-items-end"><button class="btn btn-warning w-100">Realizar troca 1:1</button></div></div><div class="form-text mt-2">Seu Armazém: ${fmt(G.cap(v))}. O estoque do Mercado regenera por segundo conforme a produção média do mundo.</div></form>`;
  }

  function map() {
    const a = G.active(),
      cells = G.state.terrain
        .map((cell) => {
          const v = G.villageAt(cell.x, cell.y);
          if (v) {
            const bonus =
              v.bonusType && v.bonusType !== "none"
                ? `<i class="map-bonus" title="Bônus: ${C.bonusTypes[v.bonusType].name}">${C.bonusTypes[v.bonusType].icon}</i>`
                : "";
            const incoming = G.state.movements.some(
                (m) => m.outbound && m.targetId === v.id,
              ),
              returning = G.state.movements.some(
                (m) => !m.outbound && m.fromId === v.id,
              );
            const protectionMark = v.protectionUntil && Date.now()<v.protectionUntil ? `<i class="map-movement protection-mark" title="Proteção de iniciante">🛡</i>` : "";
            const movementMarks = protectionMark + `${incoming ? '<i class="map-movement attack-mark" title="Ataque a caminho">⚔</i>' : ""}${returning ? '<i class="map-movement return-mark" title="Tropas retornando">↩</i>' : ""}`;
            return `<button class="world-cell village-tile ${G.isMine(v) ? "owned" : v.owner === "player" ? "other-player" : v.owner === "enemy" ? "enemy" : "barbarian"} bonus-${v.bonusType || "none"} ${v.id === a.id ? "active" : ""}" data-map-id="${v.id}" title="${v.owner === "enemy" ? "Inimigo — " : G.isMine(v) ? "Sua aldeia — " : v.owner === "player" ? "Outro jogador — " : "Bárbara — "}${v.name} — ${G.points(v)} pontos"><img src="assets/village-${growthAsset(v)}.png" alt="">${bonus}${movementMarks}<span>${v.x}|${v.y}</span><strong>${G.points(v)}</strong></button>`;
          }
          return `<button type="button" class="world-cell terrain-${cell.type} empty-map-cell" data-empty-x="${cell.x}" data-empty-y="${cell.y}" title="Espaço vazio ${cell.x}|${cell.y}">${cell.type !== "grass" ? `<img src="assets/terrain-${cell.type}.png" alt="">` : ""}</button>`;
        })
        .join(""),
      size = C.mapWidth * 70 * mapZoom + 20,
      frame = Number(G.state.settings.mapFrameSize || C.defaultMapFrameSize),
      miniMarkers = Object.values(G.state.villages || {})
        .map((v) => {
          const cls =
            G.isMine(v)
              ? "mine"
              : v.owner === "enemy"
                ? "enemy"
                : v.bonusType && v.bonusType !== "none"
                ? "bonus"
                : "barbarian";
          return `<button class="mini-map-dot ${cls} ${v.id === a.id ? "current" : ""}" data-mini-id="${v.id}" style="left:${((v.x + Math.floor(C.mapWidth/2) + 0.5) / C.mapWidth) * 100}%;top:${((v.y + Math.floor(C.mapHeight/2) + 0.5) / C.mapHeight) * 100}%" title="${v.name} (${v.x}|${v.y})"></button>`;
        })
        .join("");
    $("#view-map").innerHTML =
      `<div class="section-title"><div><div class="eyebrow">Território conhecido</div><h2>${G.state.settings.worldName || C.worldName} · Mapa ${C.mapWidth}×${C.mapHeight}</h2></div><div class="d-flex align-items-center gap-2 flex-wrap"><label class="small">Quadro</label><select id="mapFrameSelect" class="form-select form-select-sm" style="width:auto">${C.mapFrameSizes.map((n) => `<option value="${n}" ${frame === n ? "selected" : ""}>${n}×${n}</option>`).join("")}<option value="custom" ${!C.mapFrameSizes.includes(frame) ? "selected" : ""}>Personalizado</option></select><input id="mapFrameCustom" type="number" min="30" max="250" value="${frame}" class="form-control form-control-sm" style="width:85px;${C.mapFrameSizes.includes(frame) ? "display:none" : ""}"><button id="mapZoomOut" class="btn btn-sm btn-outline-light" type="button" aria-label="Diminuir zoom">−</button><button id="mapZoomIn" class="btn btn-sm btn-outline-light" type="button" aria-label="Aumentar zoom">+</button><button id="mapCenterBtn" class="btn btn-sm btn-outline-warning" type="button">Centralizar minha aldeia</button><div class="zoom-readout">${Math.round(mapZoom * 100)}%</div></div></div><div class="mini-map-panel ${localStorage.getItem("reinosDeGuerra_hideMiniMap") === "1" ? "collapsed" : ""}"><div class="mini-map-head"><strong>Mini mapa do mundo</strong><button id="toggleMiniMap" class="btn btn-sm btn-outline-secondary" type="button">${localStorage.getItem("reinosDeGuerra_hideMiniMap") === "1" ? "Mostrar" : "Ocultar"}</button><span><i class="mini-legend mine"></i> Suas aldeias <i class="mini-legend enemy"></i> Inimigos <i class="mini-legend bonus"></i> Bônus <i class="mini-legend barbarian"></i> Bárbaras</span></div><div id="miniMap" class="mini-map-world">${miniMarkers}</div></div>${localStorage.getItem("rdg_admin_pick_map") === "1" ? '<div class="alert alert-warning py-2 mb-2 admin-map-pick-hint"><strong>Modo de criação:</strong> clique em qualquer espaço vazio para selecionar as coordenadas. <button id="cancelAdminMapPick" type="button" class="btn btn-sm btn-outline-dark ms-2">Cancelar</button></div>' : ""}<div id="mapViewport" class="world-map-viewport" style="width:100%;height:${Math.max(300, frame * 6)}px"><div id="mapSizer" style="width:${size}px;height:${size}px"><div id="mapCanvas" class="world-map-grid" style="--map-columns:${C.mapWidth};transform:scale(${mapZoom})">${cells}</div></div></div><div class="small text-secondary mt-2">Tamanho do quadro: 50×50, 100×100, 150×150 ou personalizado. O valor altera a altura visível do quadro; use “Centralizar minha aldeia” para voltar à aldeia ativa.</div>`;
  }

  function villages() {
    const mine=G.owned(), totalPoints=mine.reduce((n,v)=>n+G.points(v),0);
    const cards=mine.map(v=>{const cap=G.cap(v),bq=v.buildQueue?.[0],tq=v.trainQueue?.[0], troops=Object.entries(v.units||{}).filter(([,q])=>q>0).slice(0,6).map(([k,q])=>`${C.units[k]?.icon||""}${fmt(q)}`).join(" ")||"—";return `<article class="panel p-3 village-manage-card" data-village-card="${v.id}"><div class="d-flex gap-2 align-items-start"><input class="form-check-input village-bulk-check mt-1" type="checkbox" value="${v.id}"><div class="flex-grow-1"><div class="d-flex justify-content-between gap-2 flex-wrap"><strong>${v.name}</strong><span>${G.points(v)} pts · ${v.x}|${v.y}</span></div><div class="small mt-2">🪵${fmt(v.resources.wood)}/${fmt(cap)} · 🧱${fmt(v.resources.clay)}/${fmt(cap)} · ⛓${fmt(v.resources.iron)}/${fmt(cap)} · 👥${G.population(v)}/${G.popCap(v)}</div><div class="small text-secondary mt-1">${troops}</div><div class="small mt-2">🏗 ${bq?`${C.buildings[bq.building]?.name} (${remaining(bq.end)})`:"Fila livre"} · ⚔ ${tq?`${C.units[tq.unit]?.name} ${tq.trained||0}/${tq.amount}`:"Fila livre"}</div><div class="d-flex gap-1 flex-wrap mt-2"><button class="btn btn-sm btn-warning village-open" data-id="${v.id}">Abrir</button><button class="btn btn-sm btn-outline-light village-map" data-id="${v.id}">Mapa</button></div></div></div></article>`}).join("");
    const buildOpts=Object.entries(C.buildings).map(([k,b])=>`<option value="${k}">${b.name}</option>`).join("");
    $("#view-villages").innerHTML=`<div class="section-title"><div><div class="eyebrow">Gestão do reino</div><h2>Minhas aldeias</h2></div><div class="d-flex gap-2 flex-wrap"><span class="badge text-bg-warning">★ ${fmt(totalPoints)} pontos</span><span class="badge text-bg-secondary">♜ ${mine.length} aldeias</span></div></div><section class="panel p-3 mb-3 village-bulk-toolbar"><div class="d-flex flex-wrap gap-2 align-items-end"><button id="villageSelectAll" class="btn btn-sm btn-outline-light">Selecionar todas</button><button id="villageClearAll" class="btn btn-sm btn-outline-secondary">Limpar</button><label class="flex-grow-1">Construir<select id="villageBulkBuilding" class="form-select form-select-sm"><option value="">Escolha…</option>${buildOpts}</select></label><button id="villageBulkBuild" class="btn btn-sm btn-warning">Construir selecionadas</button><button class="btn btn-sm btn-outline-warning village-bulk-preset" data-preset="defense">Treinar Defesa</button><button class="btn btn-sm btn-outline-danger village-bulk-preset" data-preset="attack">Treinar Ataque</button><button class="btn btn-sm btn-outline-info village-bulk-preset" data-preset="custom">Usar personalizado</button><button id="editVillageCustom" class="btn btn-sm btn-outline-light" type="button">Editar personalizado</button></div><div class="small text-secondary mt-2">As ações respeitam recursos, população, requisitos, níveis máximos e regras de fila de cada aldeia.</div></section><div class="village-management-grid">${cards||'<p class="text-secondary">Nenhuma aldeia.</p>'}</div>`;
  }
  function overview(){
    const mine=G.owned()||[], pts=mine.reduce((n,v)=>n+G.points(v),0), prod={wood:0,clay:0,iron:0}, troops={};
    let pop=0,cap=0,builds=0,trains=0,incoming=0;
    mine.forEach(v=>{
      ["wood","clay","iron"].forEach(r=>prod[r]+=(Number(G.prod(v,r))||0)*60);
      Object.entries(v.units||{}).forEach(([k,q])=>troops[k]=(troops[k]||0)+(Number(q)||0));
      pop+=Number(G.population(v))||0; cap+=Number(G.popCap(v))||0;
      builds+=(v.buildQueue||[]).length; trains+=(v.trainQueue||[]).length;
    });
    const ids=new Set(mine.map(v=>v.id));
    incoming=(G.state.movements||[]).filter(m=>m.outbound&&m.kind!=="support"&&ids.has(m.targetId)).length;
    const troopTotal=Object.values(troops).reduce((a,b)=>a+b,0);
    $("#view-overview").innerHTML=`<div class="section-title"><div><div class="eyebrow">Painel do reino</div><h2>Visão Geral</h2><p class="view-subtitle">Resumo compacto do seu domínio.</p></div></div><div class="overview-metrics"><div class="panel p-3"><small>Pontos</small><strong>★ ${fmt(pts)}</strong></div><div class="panel p-3"><small>Aldeias</small><strong>♜ ${mine.length}</strong></div><div class="panel p-3"><small>Tropas</small><strong>⚔ ${fmt(troopTotal)}</strong></div><div class="panel p-3"><small>População</small><strong>♟ ${fmt(pop)}/${fmt(cap)}</strong></div><div class="panel p-3"><small>Construções</small><strong>⌂ ${builds}</strong></div><div class="panel p-3"><small>Treinos</small><strong>⏱ ${trains}</strong></div><div class="panel p-3"><small>Ataques chegando</small><strong>⚠ ${incoming}</strong></div></div><section class="panel p-3 mt-3"><h3 class="h5">Produção total por hora</h3><div class="d-flex gap-4 flex-wrap"><span>🪵 ${fmt(prod.wood)}/h</span><span>🧱 ${fmt(prod.clay)}/h</span><span>⛏ ${fmt(prod.iron)}/h</span></div></section>`;
  }
  function commands(){
    const mineIds=new Set(G.owned().map(v=>v.id)), admin=isAdmin();
    const visible=admin?G.state.movements:G.state.movements.filter(m=>mineIds.has(m.fromId)||mineIds.has(m.targetId));
    const rows=visible.sort((a,b)=>a.end-b.end).map(m=>{const from=G.state.villages[m.fromId],to=G.state.villages[m.targetId],mineFrom=mineIds.has(m.fromId),mineTo=mineIds.has(m.targetId);const kind=m.scheduled?"Ataque agendado":m.kind==="support"?"Apoio enviado":m.kind==="supportReturn"?"Retorno de apoio":m.outbound?(mineFrom?"Ataque enviado":mineTo?"Ataque recebido":"Ataque mundial"):"Retorno";const reveal=admin||mineFrom||!m.outbound;const units=reveal?Object.entries(m.units||{}).filter(([,q])=>q).map(([k,q])=>`${C.units[k]?.icon||""}${q}`).join(" "):"Tropas ocultas";const owner=v=>v?.owner==="enemy"?`IA · ${v.aiProfile||"—"}`:v?.owner==="player"?"Jogador":"Livre";return `<tr><td><strong>${kind}</strong></td><td><button class="command-village-link" data-village-id="${from?.id||""}">${from?.name||"?"} (${from?.x}|${from?.y})</button><small>${admin?owner(from):""}</small></td><td><button class="command-village-link" data-village-id="${to?.id||""}">${to?.name||"?"} (${to?.x}|${to?.y})</button><small>${admin?owner(to):""}</small></td><td>${units}</td><td>${m.scheduled?`<small>Saída: ${new Date(m.departAt).toLocaleString("pt-BR")}</small><br>`:""}<span class="countdown" data-countdown="${m.end}">${remaining(m.end)}</span>${m.scheduled&&mineFrom?`<br><button class="btn btn-sm btn-outline-danger cancel-scheduled mt-1" data-movement="${m.id}">Cancelar</button>`:""}</td></tr>`}).join("");
    const stationed=Object.values(G.state.supportStationed||{}).filter(x=>admin||mineIds.has(x.fromId)||mineIds.has(x.targetId)).map(x=>{const a=G.state.villages[x.fromId],b=G.state.villages[x.targetId],can=admin||mineIds.has(x.fromId);return `<tr><td>${a?.name||"?"}</td><td>${b?.name||"?"}</td><td>${Object.entries(x.units||{}).filter(([,q])=>q).map(([k,q])=>`${C.units[k]?.icon||""}${q}`).join(" ")}</td><td>${can?`<button class="btn btn-sm btn-outline-warning support-withdraw" data-support="${x.id}">Retirar</button>`:"—"}</td></tr>`}).join("");
    $("#view-commands").innerHTML=`<div class="section-title"><div><div class="eyebrow">Movimentações militares</div><h2>${admin?"Central global de comandos":"Comandos"}</h2><p class="view-subtitle">${admin?"Visão administrativa de todos os movimentos ativos do mundo.":"Ataques enviados, recebidos e retornos das suas aldeias."}</p></div><span class="metric-chip">⚔ ${visible.length} ativos</span></div><section class="panel p-3"><div class="table-responsive"><table class="table table-dark align-middle commands-table"><thead><tr><th>Tipo</th><th>Origem</th><th>Destino</th><th>Tropas</th><th>Chegada</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="text-secondary">Nenhum comando ativo.</td></tr>'}</tbody></table></div></section>${!admin?`<section class="panel p-3 mt-3"><h3 class="h5">Sincronizar ataques de várias aldeias</h3><p class="small text-secondary">Selecione origens, destino, percentual das tropas disponíveis e um único horário de chegada. As tropas são reservadas imediatamente.</p><form id="syncAttackForm"><div class="row g-2"><div class="col-md-4"><label>Destino X</label><input name="x" type="number" min="${-Math.floor(C.mapWidth/2)}" max="${Math.ceil(C.mapWidth/2)-1}" class="form-control" required></div><div class="col-md-4"><label>Destino Y</label><input name="y" type="number" min="${-Math.floor(C.mapHeight/2)}" max="${Math.ceil(C.mapHeight/2)-1}" class="form-control" required></div><div class="col-md-4"><label>Chegada</label><input name="at" type="datetime-local" step="1" class="form-control" required></div><div class="col-md-4"><label>Percentual das tropas</label><select name="ratio" class="form-select"><option value=".25">25%</option><option value=".5">50%</option><option value=".75">75%</option><option value="1">100%</option></select></div></div><div class="sync-origin-list mt-3">${G.owned().map(v=>`<label class="form-check"><input class="form-check-input sync-origin" type="checkbox" value="${v.id}"> ${v.name} (${v.x}|${v.y})</label>`).join("")}</div><button class="btn btn-warning mt-3">Agendar selecionadas</button></form></section>`:""}<section class="panel p-3 mt-3 recurring-attacks-panel"><div class="eyebrow">Automação militar</div><h3 class="h4">⏱ Ataques recorrentes</h3><div class="alert alert-warning py-2">Exemplo: enviar a composição abaixo <strong>a cada 5 min durante 60 min</strong>. O sistema verifica as tropas restantes antes de cada envio.</div><p class="small text-secondary">Envie uma composição a cada intervalo por um tempo total. Cada disparo usa apenas tropas realmente disponíveis naquele momento; se faltarem tropas, o envio é ignorado.</p><form id="recurringAttackForm"><div class="mb-2"><label class="form-label">Alvos conhecidos</label><select id="recurringKnownTarget" class="form-select" multiple size="5">${(isAdmin()?Object.values(G.state.villages):[...new Map(visibleReports().filter(r=>r.targetId&&G.state.villages[r.targetId]).map(r=>[r.targetId,G.state.villages[r.targetId]])).values()]).map(v=>`<option value="${v.id}">${v.name} (${v.x}|${v.y})${isAdmin()?" · visão Admin":" · possui relatório"}</option>`).join("")}</select></div><div class="row g-2"><div class="col-md-3"><label>Destino X (manual)</label><input name="x" type="number" class="form-control"></div><div class="col-md-3"><label>Destino Y (manual)</label><input name="y" type="number" class="form-control"></div><div class="col-md-3"><label>A cada (min)</label><input name="interval" type="number" min="1" value="5" class="form-control"></div><div class="col-md-3"><label>Durante (min)</label><input name="duration" type="number" min="0" value="60" class="form-control"><small class="text-secondary">0 = sem limite</small></div></div><div class="mt-2"><strong>Origens</strong>${G.owned().map(v=>`<label class="form-check"><input class="form-check-input recurring-origin" type="checkbox" value="${v.id}"> ${v.name} (${v.x}|${v.y})</label>`).join("")}</div><div class="sim-grid mt-2">${Object.entries(C.units).map(([k,u])=>`<label class="sim-unit"><span>${u.icon} ${u.name}</span><input name="u-${k}" type="number" min="0" value="0" class="form-control form-control-sm"></label>`).join("")}</div><button class="btn btn-warning mt-2">Criar programação</button></form><div class="mt-3">${(G.state.recurringAttacks||[]).filter(x=>isAdmin()||x.ownerId===G.currentPlayerId()).map(x=>`<div class="queue-item"><strong>${x.status}</strong> · a cada ${Math.round(x.intervalMs/60000)} min · próximo: ${x.status==="active"?new Date(x.nextAt).toLocaleTimeString("pt-BR"):"—"} · tentativas ${x.attempts} · enviados ${x.sent} · falhas ${x.failed}<div class="mt-1"><button class="btn btn-sm btn-outline-warning recurring-action" data-id="${x.id}" data-action="${x.status==="paused"?"resume":"pause"}">${x.status==="paused"?"Continuar":"Pausar"}</button> <button class="btn btn-sm btn-outline-danger recurring-action" data-id="${x.id}" data-action="cancel">Cancelar</button></div></div>`).join("")||'<small class="text-secondary">Nenhuma programação ativa.</small>'}</div></section><section class="panel p-3 mt-3"><h3 class="h5">Apoios estacionados</h3><div class="table-responsive"><table class="table table-dark"><thead><tr><th>Origem</th><th>Destino</th><th>Tropas</th><th>Ação</th></tr></thead><tbody>${stationed||"<tr><td colspan=4>Nenhum apoio estacionado.</td></tr>"}</tbody></table></div></section>`;
  }
  function ranking(){
    let acc={};try{acc=window.RDGAuth?.accounts?.()||{}}catch(e){} const names={admin:"Administrador"};Object.values(acc).forEach(a=>names[a.playerId]=a.username);
    const stats={};Object.values(G.state.villages).forEach(v=>{let id=null,type="player",name="";if(v.owner==="player"&&v.ownerId){id=v.ownerId;name=names[id]||id;}else if(v.owner==="enemy"){id=v.aiId||`ai-${v.id}`;type="enemy";name=v.aiName||v.name||"Inimigo IA";}if(!id)return;const x=stats[id]||(stats[id]={id,points:0,villages:0,type,name});x.points+=G.points(v);x.villages++;});
    Object.values(stats).forEach(x=>{const c=G.state.combatStats?.[x.id]||{};x.attack=Number(c.attackerPoints)||0;x.defense=Number(c.defenderPoints)||0;x.conquests=Number(c.conquests)||0;});
    const base=Object.values(stats), byPoints=[...base].sort((a,b)=>b.points-a.points), byAttack=[...base].sort((a,b)=>b.attack-a.attack), byDefense=[...base].sort((a,b)=>b.defense-a.defense), byConquest=[...base].sort((a,b)=>b.conquests-a.conquests);
    const table=(list,metric,label)=>`<div class="table-responsive"><table class="table table-dark table-hover ranking-table"><thead><tr><th>#</th><th>Jogador</th><th>${label}</th><th>Aldeias</th></tr></thead><tbody>${list.map((x,i)=>`<tr class="ranking-player" data-player="${x.id}"><td>#${i+1}</td><td><button class="ranking-name" data-player="${x.id}"><strong>${x.type==="enemy"?"🤖 ":x.id==="admin"?"♜ ":""}${x.name}</strong></button></td><td>${fmt(x[metric])}</td><td>${x.villages}</td></tr>`).join("")}</tbody></table></div>`;
    $("#view-ranking").innerHTML=`<div class="section-title"><div><div class="eyebrow">Classificação do mundo</div><h2>Rankings</h2><p class="view-subtitle">Pontuação, desempenho militar e expansão territorial.</p></div></div><div class="ranking-tabs panel p-2 mb-3"><button class="btn btn-sm ranking-tab active" data-rank="points">Geral</button><button class="btn btn-sm ranking-tab" data-rank="attack">Atacantes</button><button class="btn btn-sm ranking-tab" data-rank="defense">Defensores</button><button class="btn btn-sm ranking-tab" data-rank="conquests">Conquistadores</button></div><section class="panel p-3 ranking-pane" data-rank-pane="points">${table(byPoints,"points","Pontos")}</section><section class="panel p-3 ranking-pane d-none" data-rank-pane="attack">${table(byAttack,"attack","Pontos de ataque")}</section><section class="panel p-3 ranking-pane d-none" data-rank-pane="defense">${table(byDefense,"defense","Pontos de defesa")}</section><section class="panel p-3 ranking-pane d-none" data-rank-pane="conquests">${table(byConquest,"conquests","Aldeias conquistadas")}</section>`;
  }

  function admin() {
    if (!requireAdmin()) return village();
    const allForAdmin=Object.values(G.state.villages);
    adminVillageId = adminVillageId && G.state.villages[adminVillageId] ? adminVillageId : (G.active()?.id || allForAdmin[0]?.id || null);
    if(!adminVillageId){ $("#view-admin").innerHTML=`<div class="section-title"><div><div class="eyebrow">Modo administrador</div><h2>Controle total do mundo</h2></div></div><section class="panel p-4 empty-state"><h3>Mundo sem aldeias</h3><p>Não há aldeias para editar. Crie a primeira aldeia para habilitar as ferramentas operacionais.</p></section>`; return; }
    const v = G.state.villages[adminVillageId],
      cap = G.cap(v),
      free = Math.max(0, G.popCap(v) - G.population(v)),
      options = Object.values(G.state.villages)
        .map(
          (x) =>
            `<option value="${x.id}" ${x.id === v.id ? "selected" : ""}>${x.name} (${x.x}|${x.y}) — ${G.points(x)} pts</option>`,
        )
        .join(""),
      resources = ["wood", "clay", "iron"]
        .map(
          (r) =>
            `<div class="col-md-4"><label class="form-label">${r === "wood" ? "Madeira" : r === "clay" ? "Argila" : "Ferro"} <small>máx. ${fmt(cap)}</small></label><input class="form-control" name="res-${r}" type="number" min="0" max="${cap}" value="${Math.floor(v.resources[r])}"></div>`,
        )
        .join(""),
      units = Object.entries(C.units)
        .map(([k, u]) => {
          const max =
            u.limit || Math.floor(free / u.population) + (v.units[k] || 0);
          return `<div class="col-md-6"><label class="form-label">${u.icon} ${u.name} <small>máx. ${fmt(max)}</small></label><input class="form-control" name="unit-${k}" type="number" min="0" max="${max}" value="${v.units[k] || 0}"></div>`;
        })
        .join(""),
      buildings = Object.entries(C.buildings)
        .map(
          ([k, b]) =>
            `<div class="col-md-6"><label class="form-label">${b.icon} ${b.name} <small>máx. ${b.maxLevel}</small></label><input class="form-control" name="building-${k}" type="number" min="0" max="${b.maxLevel}" value="${v.buildings[k] || 0}"></div>`,
        )
        .join(""),
      editableRules = (() => {
        const copy = JSON.parse(JSON.stringify(C));
        delete copy.saveKey;
        return copy;
      })(),
      worldRulesJson = JSON.stringify(editableRules, null, 2)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const allVillages=Object.values(G.state.villages), adminPid=G.currentPlayerId();
    const adminCounts={total:allVillages.length,player:allVillages.filter(x=>x.owner==="player"&&x.ownerId===adminPid).length,enemies:allVillages.filter(x=>x.owner==="enemy").length,barbarians:allVillages.filter(x=>!x.owner&&(!x.bonusType||x.bonusType==="none")).length,bonus:allVillages.filter(x=>!x.owner&&x.bonusType&&x.bonusType!=="none").length};
    $("#view-admin").innerHTML =
      `<div class="section-title"><div><div class="eyebrow">Modo administrador</div><h2>Controle total do mundo</h2></div><span class="badge text-bg-warning">Sem custos</span></div><div class="row g-2 mb-3 admin-world-counts"><div class="col-6 col-md"><div class="panel p-2 text-center"><strong>${adminCounts.total}</strong><div class="small text-secondary">Total</div></div></div><div class="col-6 col-md"><div class="panel p-2 text-center"><strong>${adminCounts.player}</strong><div class="small text-secondary">Do Admin</div></div></div><div class="col-6 col-md"><div class="panel p-2 text-center"><strong>${adminCounts.enemies}</strong><div class="small text-secondary">Inimigas</div></div></div><div class="col-6 col-md"><div class="panel p-2 text-center"><strong>${adminCounts.barbarians}</strong><div class="small text-secondary">Bárbaras</div></div></div><div class="col-6 col-md"><div class="panel p-2 text-center"><strong>${adminCounts.bonus}</strong><div class="small text-secondary">Bônus</div></div></div></div><div class="admin-tabs panel p-2 mb-3"><button type="button" class="btn btn-sm admin-tab-btn" data-admin-tab="world">Mundo</button><button type="button" class="btn btn-sm admin-tab-btn" data-admin-tab="rules">Regras do Mundo</button><button type="button" class="btn btn-sm admin-tab-btn" data-admin-tab="create">Criar aldeia</button><button type="button" class="btn btn-sm admin-tab-btn" data-admin-tab="village">Editar aldeias</button><button type="button" class="btn btn-sm admin-tab-btn" data-admin-tab="bulk">Edição em massa</button><button type="button" class="btn btn-sm admin-tab-btn" data-admin-tab="ai">Diagnóstico IA</button></div><div class="admin-tab-pane" data-admin-pane="world"><form id="adminWorldForm" class="panel p-3 mb-3"><h3 class="h5">Configuração do mundo</h3><div class="row g-2"><div class="col-md-4"><label class="form-label">Nome do mundo</label><input name="adminWorldName" class="form-control" maxlength="50" value="${G.state.settings.worldName || C.worldName}"></div><div class="col-md-2"><label class="form-label">Referência inicial</label><input name="adminStartingPoints" type="number" min="0" class="form-control" value="${G.state.settings.startingVillagePoints ?? C.startingVillagePoints}" readonly><div class="form-text">A pontuação real é calculada pelos edifícios e níveis gratuitos.</div></div><div class="col-md-2"><div class="form-check form-switch mt-4"><input class="form-check-input" type="checkbox" name="unlimitedBuildQueue" id="adminUnlimitedQueue" ${G.state.settings.unlimitedBuildQueue ? "checked" : ""}><label class="form-check-label" for="adminUnlimitedQueue">Fila múltipla</label></div></div><div class="col-md-2"><div class="form-check form-switch mt-4"><input class="form-check-input" type="checkbox" name="enemiesEnabled" id="adminEnemiesEnabled" ${G.state.settings.enemiesEnabled ? "checked" : ""}><label class="form-check-label" for="adminEnemiesEnabled">Inimigos</label></div></div><div class="col-md-2"><label class="form-label">Qtd. inimigos</label><input name="enemyCount" type="number" min="10" max="100" class="form-control" value="${Math.max(10, G.state.settings.enemyCount ?? C.enemyCount ?? 10)}"></div><div class="col-12"><div class="admin-section mt-2"><h4 class="h6">Comportamento dos inimigos</h4><div class="row g-2"><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemyAttackPlayers" type="checkbox" ${G.state.settings.enemyRules?.canAttackPlayers!==false?"checked":""}><label class="form-check-label">Atacar jogadores</label></div><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemyAttackBarbs" type="checkbox" ${G.state.settings.enemyRules?.canAttackBarbarians!==false?"checked":""}><label class="form-check-label">Atacar bárbaras/bônus</label></div><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemyAttackAI" type="checkbox" ${G.state.settings.enemyRules?.canAttackOtherEnemies===true?"checked":""}><label class="form-check-label">Atacar outras IAs</label></div><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemyConquerAI" type="checkbox" ${G.state.settings.enemyRules?.canConquerOtherEnemies===true?"checked":""}><label class="form-check-label">Conquistar outras IAs</label></div><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemyConquer" type="checkbox" ${G.state.settings.enemyRules?.canConquer!==false?"checked":""}><label class="form-check-label">Podem conquistar</label></div><div class="col-md-2"><label class="form-label small">Máx. aldeias/IA</label><input class="form-control form-control-sm" name="enemyMaxVillages" type="number" min="1" max="100" value="${G.state.settings.enemyRules?.maxVillagesPerEnemy||12}"></div><div class="col-md-2"><label class="form-label small">Raio de ataque</label><input class="form-control form-control-sm" name="enemyRadius" type="number" min="1" max="100" value="${G.state.settings.enemyRules?.attackRadius||25}"></div><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemyRecruit" type="checkbox" ${G.state.settings.enemyRules?.canRecruitTroops!==false?"checked":""}><label class="form-check-label">Recrutar tropas</label></div><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemyBuild" type="checkbox" ${G.state.settings.enemyRules?.canBuild!==false?"checked":""}><label class="form-check-label">Evoluir edifícios</label></div><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemyNobles" type="checkbox" ${G.state.settings.enemyRules?.canRecruitNobles!==false?"checked":""}><label class="form-check-label">Produzir Nobres</label></div><div class="col-md-3 form-check form-switch ms-2"><input class="form-check-input" name="enemySiege" type="checkbox" ${G.state.settings.enemyRules?.canUseSiege!==false?"checked":""}><label class="form-check-label">Usar cerco</label></div><div class="col-md-2"><label class="form-label small">Lote de recrutamento</label><input class="form-control form-control-sm" name="enemyBatch" type="number" min="1" max="500" value="${G.state.settings.enemyRules?.recruitmentBatch||20}"></div><div class="col-md-3"><label class="form-label small">Intervalo de ação da IA (segundos)</label><input class="form-control form-control-sm" name="aiActionInterval" type="number" min="1" max="3600" value="${G.state.settings.ai?.actionIntervalSeconds ?? C.ai.actionIntervalSeconds}"><div class="form-text">Frequência em que a IA avalia construção, recrutamento e ataques. Não garante uma ação em todo ciclo.</div></div></div><div class="d-flex gap-2 mt-3"><button id="saveEnemyBehavior" type="button" class="btn btn-outline-warning btn-sm">Salvar comportamento</button><button id="saveEnemyRoster" type="button" class="btn btn-outline-danger btn-sm">Salvar inimigos e quantidade</button></div></div></div><div class="col-12"><hr><h4 class="h6">Proteção e fim de mundo</h4></div><div class="col-md-3"><label class="form-label">Proteção inicial (minutos)</label><input name="newPlayerProtectionMinutes" type="number" min="0" max="10080" class="form-control" value="${G.state.settings.beginnerProtection?.minutes??15}"></div><div class="col-md-3"><label class="form-label">Condição de vitória</label><select name="victoryType" class="form-select"><option value="none" ${G.state.settings.victoryRules?.enabled===false?"selected":""}>Sem condição</option><option value="villages" ${G.state.settings.victoryRules?.type==="villages"?"selected":""}>Número de aldeias</option><option value="percentage" ${G.state.settings.victoryRules?.type==="percentage"?"selected":""}>% das aldeias</option><option value="points" ${G.state.settings.victoryRules?.type==="points"?"selected":""}>Pontos</option><option value="conquests" ${G.state.settings.victoryRules?.type==="conquests"?"selected":""}>Conquistas</option><option value="last" ${G.state.settings.victoryRules?.type==="last"?"selected":""}>Último jogador/IA</option></select></div><div class="col-md-2"><label class="form-label">Meta</label><input name="victoryTarget" type="number" min="1" class="form-control" value="${G.state.settings.victoryRules?.target||10}"></div><div class="col-md-2 d-flex align-items-end"><button class="btn btn-warning">Aplicar ao mundo</button></div><div class="col-12"><hr><h4 class="h6">Nascimento controlado de aldeias bárbaras/bônus</h4></div><div class="col-md-2"><div class="form-check form-switch mt-4"><input class="form-check-input" type="checkbox" name="spawnEnabled" ${G.state.settings.barbarianSpawn?.enabled!==false?"checked":""}><label class="form-check-label">Ativado</label></div></div><div class="col-md-2"><label class="form-label">Intervalo (min)</label><input name="spawnInterval" type="number" min="1" class="form-control" value="${G.state.settings.barbarianSpawn?.intervalMinutes||30}"></div><div class="col-md-2"><label class="form-label">Máx. novas</label><input name="spawnMax" type="number" min="0" class="form-control" value="${G.state.settings.barbarianSpawn?.maxNewVillages||20}"></div><div class="col-md-2"><label class="form-label">Por ciclo</label><input name="spawnPerCycle" type="number" min="1" max="10" class="form-control" value="${G.state.settings.barbarianSpawn?.perCycle||1}"></div><div class="col-md-2"><label class="form-label">Chance bônus %</label><input name="spawnBonus" type="number" min="0" max="100" class="form-control" value="${G.state.settings.barbarianSpawn?.bonusChance||15}"></div><div class="col-md-2"><div class="form-check form-switch mt-4"><input class="form-check-input" name="spawnMaximized" type="checkbox" ${G.state.settings.barbarianSpawn?.maximized?"checked":""}><label class="form-check-label">Novas aldeias maximizadas</label></div></div><div class="col-md-2 d-flex align-items-end"><div class="d-grid gap-2"><button id="saveSpawnSettings" type="button" class="btn btn-success">Salvar nascimento</button><button id="testSpawnNow" type="button" class="btn btn-outline-warning">Gerar ciclo agora</button><button type="button" id="maxSpawnCycle" class="btn btn-sm btn-outline-danger">Ativar ciclo maximizado</button></div></div><div class="col-12"><div class="small text-secondary">Geradas até agora: <strong>${G.state.spawnedBarbarians||0}</strong> · Último ciclo: ${G.state.lastBarbarianSpawn?new Date(G.state.lastBarbarianSpawn).toLocaleString("pt-BR"):"ainda não ocorreu"}</div></div></div><div class="mt-3"><div class="small text-secondary mb-2">Níveis gratuitos para pontuação inicial</div><div class="row g-2">${Object.entries(
        C.buildings,
      )
        .map(
          ([k, b]) =>
            `<div class="col-md-3"><label class="form-label small">${b.name}</label><input name="free-${k}" type="number" min="0" max="${b.maxLevel}" class="form-control form-control-sm" value="${G.state.settings.freeStartingPointLevels?.[k] ?? C.freeStartingPointLevels[k] ?? 0}"></div>`,
        )
        .join(
          "",
        )}</div></div></form></div><div class="admin-tab-pane" data-admin-pane="rules"><div class="panel p-3 mb-3"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2"><div><h3 class="h5 mb-1">Regras do Mundo</h3><div class="text-secondary small">Editor completo dos parâmetros de config.js. Inclui economia, mapa, combate, lealdade, IA, bônus, edifícios, unidades, custos, tempos, requisitos, pontos, capacidades, objetivos e presets administrativos.</div></div><span class="badge text-bg-warning">Avançado</span></div><div class="d-flex flex-wrap gap-2 my-3"><button type="button" class="btn btn-sm btn-outline-light world-rule-preset" data-preset="classic">Clássico</button><button type="button" class="btn btn-sm btn-outline-info world-rule-preset" data-preset="fast">Rápido</button><button type="button" class="btn btn-sm btn-outline-danger world-rule-preset" data-preset="war">Guerra</button><button type="button" class="btn btn-sm btn-outline-success world-rule-preset" data-preset="casual">Casual</button><button type="button" id="worldRulesReset" class="btn btn-sm btn-outline-secondary">Recarregar atuais</button></div><div class="row g-2 mb-3 world-preset-help"><div class="col-md-6 col-xl-3"><div class="admin-section h-100"><strong>Clássico</strong><div class="small text-secondary">Economia e tempos equilibrados, progressão tradicional e combate em ritmo moderado.</div></div></div><div class="col-md-6 col-xl-3"><div class="admin-section h-100"><strong>Rápido</strong><div class="small text-secondary">Produção, construção, treino e deslocamentos acelerados para partidas mais curtas.</div></div></div><div class="col-md-6 col-xl-3"><div class="admin-section h-100"><strong>Guerra</strong><div class="small text-secondary">Foco militar: tropas e viagens mais rápidas, expansão agressiva e conflitos frequentes.</div></div></div><div class="col-md-6 col-xl-3"><div class="admin-section h-100"><strong>Casual</strong><div class="small text-secondary">Progressão mais tranquila, custos amigáveis e menor pressão para expansão imediata.</div></div></div></div><div class="alert alert-warning py-2 small">Alterações são aplicadas ao balanceamento do jogo após salvar. Parâmetros estruturais como tamanho/densidade do mapa têm efeito completo ao criar um novo mundo. O <code>saveKey</code> é protegido e não pode ser alterado aqui.</div><textarea id="worldRulesJson" class="form-control font-monospace" spellcheck="false" style="min-height:55vh;max-height:65vh;overflow:auto">${worldRulesJson}</textarea><div class="d-flex flex-wrap gap-2 mt-3"><button type="button" id="saveWorldRules" class="btn btn-warning">Salvar Regras do Mundo</button><button type="button" id="restoreConfigRules" class="btn btn-outline-danger">Remover personalização</button></div></div></div><div class="admin-tab-pane" data-admin-pane="create"><form id="adminCreateVillageForm" class="panel p-3 mb-3"><div class="d-flex justify-content-between align-items-center"><h3 class="h5">Criar nova aldeia</h3><button id="adminPickMap" type="button" class="btn btn-sm btn-outline-warning">Escolher espaço no mapa</button></div><div class="row g-2"><div class="col-md-2"><label class="form-label">X</label><input name="createX" class="form-control" type="number" min="${-Math.floor(C.mapWidth/2)}" max="${Math.ceil(C.mapWidth/2)-1}" value="${localStorage.getItem("rdg_create_x") || 0}"></div><div class="col-md-2"><label class="form-label">Y</label><input name="createY" class="form-control" type="number" min="${-Math.floor(C.mapHeight/2)}" max="${Math.ceil(C.mapHeight/2)-1}" value="${localStorage.getItem("rdg_create_y") || 0}"></div><div class="col-md-3"><label class="form-label">Nome</label><input name="createName" class="form-control" value="Nova aldeia"></div><div class="col-md-2"><label class="form-label">Dono</label><select name="createOwner" class="form-select"><option value="">Bárbara</option><option value="enemy">Inimigo</option><option value="player">Jogador</option></select></div><div class="col-md-3"><label class="form-label">Bônus</label><select name="createBonus" class="form-select">${Object.entries(C.bonusTypes).map(([k,b])=>`<option value="${k}">${b.icon} ${b.name}</option>`).join("")}</select></div></div><details class="mt-3"><summary>Recursos, tropas e níveis</summary><h4 class="h6 mt-3">Recursos</h4><div class="row g-2">${["wood","clay","iron"].map(r=>`<div class="col-md-2"><label>${r}</label><input name="create-res-${r}" type="number" min="0" value="500" class="form-control"></div>`).join("")}</div><h4 class="h6 mt-3">Edifícios</h4><div class="row g-2">${Object.entries(C.buildings).map(([k,b])=>`<div class="col-md-3"><label class="small">${b.name}</label><input name="create-building-${k}" type="number" min="0" max="${b.maxLevel}" value="${G.state.settings.initialBuildingLevels[k]||0}" class="form-control form-control-sm"></div>`).join("")}</div><h4 class="h6 mt-3">Tropas</h4><div class="row g-2">${Object.entries(C.units).map(([k,u])=>`<div class="col-md-3"><label class="small">${u.icon} ${u.name}</label><input name="create-unit-${k}" type="number" min="0" value="0" class="form-control form-control-sm"></div>`).join("")}</div></details><div class="d-flex flex-wrap gap-2 align-items-end mt-3"><button class="btn btn-warning">Criar aldeia</button><label class="small">Quantidade aleatória<input name="createRandomCount" type="number" min="1" max="500" value="10" class="form-control form-control-sm"></label><button id="adminCreateRandom" type="button" class="btn btn-outline-warning">Criar em espaços aleatórios</button></div></form></div><div class="admin-tab-pane" data-admin-pane="bulk"><section class="panel p-3 mb-3"><h3 class="h5">Gerenciamento em massa de aldeias</h3><p class="small text-secondary">Selecione as aldeias e prepare somente os campos que deseja alterar. Nada é aplicado antes da confirmação.</p><div class="d-flex flex-wrap gap-2 mb-2"><button id="bulkSelectAll" type="button" class="btn btn-sm btn-outline-light">Selecionar todas</button><button id="bulkSelectMine" type="button" class="btn btn-sm btn-outline-warning">Minhas aldeias</button><button id="bulkSelectBarbs" type="button" class="btn btn-sm btn-outline-secondary">Bárbaras</button><button id="bulkSelectBonus" type="button" class="btn btn-sm btn-outline-info">Bônus</button><button id="bulkSelectEnemies" type="button" class="btn btn-sm btn-outline-danger">Inimigas</button><button type="button" class="btn btn-sm btn-outline-light bulk-quadrant" data-q="NW">Q NO</button><button type="button" class="btn btn-sm btn-outline-light bulk-quadrant" data-q="NE">Q NE</button><button type="button" class="btn btn-sm btn-outline-light bulk-quadrant" data-q="SW">Q SO</button><button type="button" class="btn btn-sm btn-outline-light bulk-quadrant" data-q="SE">Q SE</button><select id="bulkSelectEnemyAI" class="form-select form-select-sm" style="width:auto"><option value="">Inimigo específico…</option>${[...new Map(Object.values(G.state.villages).filter(v=>v.owner==="enemy").map(v=>[v.aiId||`ai-${v.id}`,v])).entries()].map(([id,v])=>`<option value="${id}">${v.name} · ${v.aiProfile||"IA"}</option>`).join("")}</select><button id="bulkClear" type="button" class="btn btn-sm btn-outline-secondary">Limpar</button></div><div class="bulk-village-list queue-scroll mb-3" style="max-height:220px">${Object.values(G.state.villages).map(x=>`<label class="form-check"><input class="form-check-input bulk-village-check" type="checkbox" value="${x.id}"> <span>${x.name} (${x.x}|${x.y}) · ${G.points(x)} pts · ${G.isMine(x)?"Jogador":x.owner==="enemy"?"Inimigo":"Livre"}</span></label>`).join("")}</div><form id="adminBulkForm"><div class="row g-3"><div class="col-lg-4"><h4 class="h6">Recursos</h4><select name="bulkResources" class="form-select"><option value="">Não alterar</option><option value="50%">50% da capacidade</option><option value="100%">100% da capacidade</option><option value="0%">Zerar</option></select></div><div class="col-lg-4"><h4 class="h6">Bônus</h4><select name="bulkBonus" class="form-select"><option value="">Não alterar</option>${Object.entries(C.bonusTypes).map(([k,b])=>`<option value="${k}">${b.icon} ${b.name}</option>`).join("")}</select></div><div class="col-lg-4"><h4 class="h6">Preset edifícios</h4><select name="bulkBuildings" class="form-select"><option value="">Não alterar</option><option value="initial">Níveis iniciais</option><option value="half">50% evoluído</option><option value="custom">Personalizável</option><option value="max">Níveis máximos</option></select></div><div class="col-lg-6"><div class="d-flex justify-content-between align-items-center"><h4 class="h6">Preset tropas</h4><button type="button" id="bulkEditCustomTroops" class="btn btn-sm btn-outline-warning">Editar personalizado</button></div><select name="bulkTroops" class="form-select"><option value="">Não alterar</option><option value="defense">Defesa</option><option value="attack">Ataque</option><option value="attackNobles">Ataque + 4 Nobres</option><option value="custom">Personalizado salvo</option><option value="zero">Zerar tropas</option></select></div></div><div class="row g-3 mt-1"><div class="col-lg-4"><h4 class="h6">Finalizar filas</h4><select name="bulkFinish" class="form-select"><option value="">Não alterar</option><option value="build">Construções</option><option value="training">Treinamentos</option><option value="all">Todas</option></select></div><div class="col-lg-4"><h4 class="h6">Alterar proprietário</h4><select name="bulkOwner" class="form-select"><option value="">Não alterar</option><option value="barbarian">Bárbara/livre</option><option value="enemy">Nova/IA genérica</option>${[...new Map(Object.values(G.state.villages).filter(v=>v.owner==="enemy").map(v=>[v.aiId||`ai-${v.id}`,v])).entries()].map(([id,v])=>`<option value="ai:${id}">IA: ${v.name} (${v.aiProfile||"IA"})</option>`).join("")}<option value="admin">Administrador</option></select></div></div><button class="btn btn-danger mt-3">Revisar e aplicar às selecionadas</button></form></section></div><div class="admin-tab-pane" data-admin-pane="ai"><section class="panel p-3"><h3 class="h5">Auditoria / diagnóstico da IA</h3><p class="text-secondary small">Mostra o estado mais recente de cada jogador IA e ajuda a identificar travamentos de evolução.</p><div class="table-responsive"><table class="table table-dark"><thead><tr><th>IA</th><th>Perfil</th><th>Aldeias</th><th>Pontos</th><th>Nobres</th><th>Estado</th></tr></thead><tbody>${[...new Map(Object.values(G.state.villages).filter(x=>x.owner==="enemy").map(x=>[x.aiId||x.id,x])).entries()].map(([aid,av])=>{const vs=Object.values(G.state.villages).filter(x=>x.owner==="enemy"&&(x.aiId||x.id)===aid),d=G.state.aiDiagnostics?.[aid]||{};return `<tr><td>${av.aiName||av.name}</td><td>${av.aiProfile||"—"}</td><td>${vs.length}</td><td>${fmt(vs.reduce((n,x)=>n+G.points(x),0))}</td><td>${vs.reduce((n,x)=>n+(x.units.noble||0),0)}</td><td><strong>${d.status||"Aguardando ciclo"}</strong></td></tr>`}).join("")}</tbody></table></div></section></div><div class="admin-tab-pane" data-admin-pane="village"><div class="panel p-3 mb-3"><div class="d-flex flex-wrap justify-content-between gap-2"><label class="form-label mb-0">Aldeia editada</label><span class="small text-secondary">Pontuação desta aldeia: <strong>${G.points(v)}</strong> · máximo configurado: <strong>${G.maxVillagePoints()}</strong></span></div><input id="adminVillageSearch" class="form-control mt-2" placeholder="Pesquisar por nome, coordenada, dono ou IA…"><select id="adminVillageSelect" class="form-select mt-2">${options}</select></div><section class="panel p-3 mb-3"><h3 class="h6">Ferramentas da aldeia</h3><button type="button" class="btn btn-sm btn-outline-warning admin-sim-village" data-village-id="${v.id}">⚔ Simular combate com esta aldeia</button></section><div class="row g-3 mb-3"><div class="col-xl-7"><form id="adminIdentityForm" class="admin-section"><h3 class="h5">Nome, posse, lealdade e bônus</h3><div class="row g-2"><div class="col-md-4"><label class="form-label">Nome</label><input name="villageName" class="form-control" value="${v.name}" maxlength="40"></div><div class="col-md-2"><label class="form-label">Dono</label><select name="owner" class="form-select"><option value="" ${!v.owner ? "selected" : ""}>Livre</option><option value="player" ${v.owner === "player" ? "selected" : ""}>Jogador</option><option value="enemy" ${v.owner === "enemy" ? "selected" : ""}>Inimigo</option></select></div><div class="col-md-2"><label class="form-label">Lealdade</label><input name="loyalty" class="form-control" type="number" min="0" max="100" value="${v.loyalty}"></div><div class="col-md-3"><label class="form-label">Bônus</label><select name="bonusType" class="form-select">${Object.entries(
        C.bonusTypes,
      )
        .map(
          ([k, b]) =>
            `<option value="${k}" ${v.bonusType === k ? "selected" : ""}>${b.icon} ${b.name}</option>`,
        )
        .join(
          "",
        )}</select></div><div class="col-md-1 d-flex align-items-end"><button class="btn btn-warning w-100">OK</button></div></div></form></div><div class="col-xl-5"><form id="adminResourcesForm" class="admin-section admin-resources"><h3 class="h5">Recursos</h3><div class="row g-2">${resources}</div><div class="d-flex gap-2 mt-2"><button id="adminResourcesHalf" type="button" class="btn btn-outline-warning btn-sm">50%</button><button id="adminResourcesFull" type="button" class="btn btn-outline-light btn-sm">100%</button><button class="btn btn-warning btn-sm">Aplicar</button></div></form></div></div><div class="row g-3"><div class="col-xl-5"><form id="adminTroopsForm" class="admin-section"><h3 class="h5">Tropas</h3><div class="row g-2">${units}</div><div class="d-flex flex-wrap gap-2 mt-3 admin-action-buttons"><button id="adminDefenseTroops" type="button" class="btn btn-outline-light">Defesa</button><button id="adminAttackTroops" type="button" class="btn btn-outline-danger">Ataque</button><button id="adminCustomTroops" type="button" class="btn btn-outline-warning">Editar personalizado</button><button id="adminSaveCustomTroops" type="button" class="btn btn-outline-secondary">Salvar personalizável</button><button id="adminLoadCustomTroops" type="button" class="btn btn-outline-secondary">Usar personalizável</button><button class="btn btn-warning">Salvar tropas</button></div></form></div><div class="col-xl-7"><form id="adminBuildingsForm" class="admin-section"><h3 class="h5">Edifícios</h3><div class="row g-2">${buildings}</div><div class="d-flex flex-wrap gap-2 mt-3"><button id="adminMaxBuildings" type="button" class="btn btn-outline-warning">Níveis máximos</button><button id="adminHalfBuildings" type="button" class="btn btn-outline-info">50% evoluído</button><button id="adminInitialBuildings" type="button" class="btn btn-outline-light">Níveis iniciais</button><button id="adminSaveCustomBuildings" type="button" class="btn btn-outline-secondary">Salvar personalizável</button><button id="adminLoadCustomBuildings" type="button" class="btn btn-outline-secondary">Usar personalizável</button><button class="btn btn-warning">Salvar níveis dos edifícios</button></div></form></div></div><section class="admin-section mt-3"><h3 class="h5">Intervenções administrativas</h3><p class="small text-secondary">Use apenas para suporte/testes. Permite concluir filas sem alterar custos já pagos.</p><div class="d-flex gap-2 flex-wrap"><button id="adminFinishBuild" type="button" class="btn btn-outline-warning">Finalizar próxima construção</button><button id="adminFinishTraining" type="button" class="btn btn-outline-warning">Finalizar próximo treinamento</button><button id="adminFinishAll" type="button" class="btn btn-outline-danger">Finalizar todas as filas</button></div></section></div>`;
  }
  function showAttack(targetId = null) {
    attackTarget = targetId;
    const target = targetId ? G.state.villages[targetId] : null,
      v = G.active();
    $("#attackFormBody").innerHTML =
      `<div class="mb-3"><label class="form-label">Tipo de comando</label><select name="commandType" class="form-select"><option value="attack">⚔ Ataque</option><option value="support">🛡 Apoio</option></select></div><div class="row g-2 mb-3"><div class="col-md-4"><label class="form-label">Envio</label><select name="scheduleMode" id="scheduleMode" class="form-select"><option value="now">Agora</option><option value="arrival">Agendar chegada</option><option value="departure">Agendar saída</option></select></div><div class="col-md-8"><label class="form-label">Data e hora</label><input name="scheduleAt" id="scheduleAt" type="datetime-local" step="1" class="form-control"><div class="form-text">Ao agendar, as tropas são reservadas imediatamente.</div></div></div><div class="row g-2 mb-3"><div class="col-6"><label class="form-label">Coordenada X</label><input name="targetX" id="attackX" class="form-control" type="number" min="${-Math.floor(C.mapWidth/2)}" max="${Math.ceil(C.mapWidth/2)-1}" value="${target?.x ?? ""}" required></div><div class="col-6"><label class="form-label">Coordenada Y</label><input name="targetY" id="attackY" class="form-control" type="number" min="${-Math.floor(C.mapHeight/2)}" max="${Math.ceil(C.mapHeight/2)-1}" value="${target?.y ?? ""}" required></div></div><div class="d-flex gap-2 flex-wrap mb-3"><button id="attackHalf" type="button" class="btn btn-sm btn-outline-warning">50% das tropas</button><button id="attackAll" type="button" class="btn btn-sm btn-outline-danger">100% das tropas</button><label class="ms-auto d-flex align-items-center gap-2 small">Ataques iguais <input name="attackCount" id="attackCount" type="number" min="1" max="20" value="1" class="form-control form-control-sm" style="width:70px"></label></div>${Object.entries(
        C.units,
      )
        .map(
          ([k, u]) =>
            `<label class="form-label d-flex align-items-center gap-2">${u.icon}<span class="flex-grow-1">${u.name} <small class="text-secondary">(${v.units[k] || 0})</small></span><input name="${k}" class="form-control form-control-sm w-25 attack-unit" type="number" min="0" max="${v.units[k] || 0}" value="0"></label>`,
        )
        .join(
          "",
        )}<div class="mt-3"><label class="form-label">Alvo das catapultas</label><select name="catapultTarget" class="form-select"><option value="">Aleatório</option>${Object.entries(
        C.buildings,
      )
        .filter(([k]) => k !== "hide" && k !== "wall")
        .map(([k, b]) => `<option value="${k}">${b.name}</option>`)
        .join(
          "",
        )}</select><div class="form-text">Usado somente quando houver catapultas no ataque.</div></div><div id="combatPreview" class="combat-preview small">Informe as coordenadas e escolha as tropas.</div>`;
    const refresh = () => {
      const target = G.villageAt($("#attackX").value, $("#attackY").value),
        units = Object.fromEntries(
          [...document.querySelectorAll(".attack-unit")].map((x) => [
            x.name,
            Number(x.value),
          ]),
        );
      if (!target)
        return ($("#combatPreview").textContent =
          "Não existe aldeia nessas coordenadas.");
      attackTarget = target.id;
      const e = G.estimate(target.id, units);
      const ownIncoming = G.state.movements.filter(
        (m) =>
          m.outbound &&
          m.targetId === target.id &&
          G.isMine(G.state.villages[m.fromId]),
      );
      const sentInfo = ownIncoming.length
        ? `<div class="mt-2"><strong>Seus ataques a caminho:</strong>${ownIncoming
            .map(
              (m) =>
                `<div class="small mt-1">⚔ ${Object.entries(m.units)
                  .filter(([, q]) => q > 0)
                  .map(
                    ([k, q]) =>
                      `${C.units[k]?.icon || ""} ${C.units[k]?.name || k}: ${fmt(q)}`,
                  )
                  .join(
                    " · ",
                  )} <span class="text-secondary">(${remaining(m.end)})</span></div>`,
            )
            .join("")}</div>`
        : "";
      $("#combatPreview").innerHTML =
        `Alvo: <strong>${target.name}</strong> (${target.x}|${target.y}) · Distância ${e.distance.toFixed(1)} campos · Tempo <strong>${timeText(e.seconds)}</strong> · Força ${e.attack} · Defesa provável ${e.defense} · Chance ${e.chance}%<div class="mt-2"><strong>Lealdade atual:</strong> ${target.loyalty ?? C.baseLoyalty}%</div><div class="mt-2"><strong>Bônus da aldeia:</strong> ${bonusText(target)}</div>${sentInfo}`;
    };
    const fillAttack = (ratio) => {
      const count = Math.max(1, Number($("#attackCount")?.value) || 1);
      document
        .querySelectorAll(".attack-unit")
        .forEach(
          (i) => (i.value = Math.floor(((Number(i.max) || 0) * ratio) / count)),
        );
      refresh();
    };
    $("#attackHalf").onclick = () => fillAttack(0.5);
    $("#attackAll").onclick = () => fillAttack(1);
    document
      .querySelectorAll(".attack-unit,#attackX,#attackY")
      .forEach((i) => (i.oninput = refresh));
    refresh();
    bootstrap.Modal.getOrCreateInstance($("#attackModal")).show();
  }
  function observeVillage(id) {
    if (!isAdmin()) return showAttack(id);
    const v = G.state.villages[id];
    if (!v || G.isMine(v)) return;
    const type = v.owner === "enemy" ? "Inimigo" : (v.bonusType && v.bonusType !== "none" ? "Aldeia bônus" : "Aldeia bárbara");
    const res = ["wood","clay","iron"].map(r => `${r === "wood" ? "🪵" : r === "clay" ? "🧱" : "⛓"} ${fmt(Math.floor(v.resources[r] || 0))}`).join(" &nbsp; ");
    const buildings = Object.entries(C.buildings).filter(([k]) => (v.buildings[k] || 0) > 0).map(([k,b]) => `<div class="queue-item">${b.icon} ${b.name}<strong class="float-end">Nv. ${v.buildings[k]}</strong></div>`).join("") || '<p class="text-secondary">Nenhum edifício.</p>';
    const units = Object.entries(C.units).filter(([k]) => (v.units[k] || 0) > 0).map(([k,u]) => `<div class="queue-item">${u.icon} ${u.name}<strong class="float-end">${fmt(v.units[k])}</strong></div>`).join("") || '<p class="text-secondary">Nenhuma tropa.</p>';
    const queues = (v.buildQueue || []).map(q => `<div class="queue-item">🏗 ${C.buildings[q.building]?.name || q.building}<span class="countdown float-end" data-countdown="${q.end}">${remaining(q.end)}</span></div>`).join("") || '<p class="text-secondary">Sem construções.</p>';
    $("#observeVillageTitle").textContent = `${v.name} (${v.x}|${v.y})`;
    $("#observeVillageBody").innerHTML = `<div class="alert alert-secondary py-2">Modo somente leitura — nenhuma alteração pode ser feita nesta aldeia.</div><div class="row g-3"><div class="col-md-6"><section class="panel p-3 mb-3"><div class="eyebrow">${type}</div><h3 class="h5 mb-2">${G.points(v)} pontos</h3><div><strong>Recursos:</strong> ${res}</div><div><strong>Armazém:</strong> ${fmt(G.cap(v))}</div><div><strong>População:</strong> ${fmt(G.population(v))}/${fmt(G.popCap(v))}</div><div><strong>Lealdade:</strong> ${Math.round(v.loyalty ?? C.baseLoyalty)}%</div>${bonusLabel(v)}</section><section class="panel p-3"><h3 class="h6">Construções em andamento</h3><div class="queue-scroll">${queues}</div></section></div><div class="col-md-3"><section class="panel p-3"><h3 class="h6">Edifícios</h3><div class="queue-scroll" style="max-height:420px">${buildings}</div></section></div><div class="col-md-3"><section class="panel p-3"><h3 class="h6">Tropas atuais</h3><div class="queue-scroll" style="max-height:420px">${units}</div></section></div></div>`;
    $("#observeAttackBtn").onclick = () => { bootstrap.Modal.getOrCreateInstance($("#observeVillageModal")).hide(); showAttack(v.id); };
    bootstrap.Modal.getOrCreateInstance($("#observeVillageModal")).show();
  }
  function bindMap() {
    const viewport = $("#mapViewport"),
      canvas = $("#mapCanvas"),
      sizer = $("#mapSizer");
    if (!viewport) return;
    if (mapLeft === null) {
      mapLeft = Math.max(
        0,
        (G.active().x + Math.floor(C.mapWidth/2)) * 70 * mapZoom - viewport.clientWidth / 2,
      );
      mapTop = Math.max(
        0,
        (G.active().y + Math.floor(C.mapHeight/2)) * 70 * mapZoom - viewport.clientHeight / 2,
      );
    }
    const centerActiveVillage = () => {
      const cell = 70 * mapZoom;
      mapLeft = Math.max(
        0,
        (G.active().x + Math.floor(C.mapWidth/2)) * cell + cell / 2 - viewport.clientWidth / 2,
      );
      mapTop = Math.max(
        0,
        (G.active().y + Math.floor(C.mapHeight/2)) * cell + cell / 2 - viewport.clientHeight / 2,
      );
      viewport.scrollLeft = mapLeft;
      viewport.scrollTop = mapTop;
    };
    const focusId=localStorage.getItem("rdg_map_focus"), focus=focusId?G.state.villages[focusId]:null;
    if(focus){const cell=70*mapZoom;mapLeft=Math.max(0,(focus.x+Math.floor(C.mapWidth/2))*cell+cell/2-viewport.clientWidth/2);mapTop=Math.max(0,(focus.y+Math.floor(C.mapHeight/2))*cell+cell/2-viewport.clientHeight/2);localStorage.removeItem("rdg_map_focus");}
    viewport.scrollLeft = mapLeft;
    viewport.scrollTop = mapTop;
    if ($("#mapCenterBtn")) $("#mapCenterBtn").onclick = centerActiveVillage;
    if ($("#toggleMiniMap"))
      $("#toggleMiniMap").onclick = () => {
        const hidden =
          localStorage.getItem("reinosDeGuerra_hideMiniMap") === "1";
        localStorage.setItem("reinosDeGuerra_hideMiniMap", hidden ? "0" : "1");
        render(true);
      };
    document.querySelectorAll(".mini-map-dot").forEach(
      (dot) =>
        (dot.onclick = () => {
          const v = G.state.villages[dot.dataset.miniId];
          if (!v) return;
          const cell = 70 * mapZoom;
          mapLeft = Math.max(
            0,
            (v.x + Math.floor(C.mapWidth/2)) * cell + cell / 2 - viewport.clientWidth / 2,
          );
          mapTop = Math.max(
            0,
            (v.y + Math.floor(C.mapHeight/2)) * cell + cell / 2 - viewport.clientHeight / 2,
          );
          requestAnimationFrame(() => {
            viewport.scrollLeft = mapLeft;
            viewport.scrollTop = mapTop;
          });
        }),
    );
    const chooseEmptyMapCell = (cell) => {
      if (!cell || localStorage.getItem("rdg_admin_pick_map") !== "1") return false;
      localStorage.setItem("rdg_create_x", cell.dataset.emptyX);
      localStorage.setItem("rdg_create_y", cell.dataset.emptyY);
      localStorage.removeItem("rdg_admin_pick_map");
      localStorage.setItem("rdg_admin_tab", "create");
      view = "admin";
      render(true);
      return true;
    };
    document.querySelectorAll(".empty-map-cell").forEach((cell) => {
      cell.onclick = (e) => { e.preventDefault(); e.stopPropagation(); chooseEmptyMapCell(cell); };
    });
    if ($("#cancelAdminMapPick")) $("#cancelAdminMapPick").onclick = () => {
      localStorage.removeItem("rdg_admin_pick_map"); render(true);
    };
    if ($("#mapFrameSelect"))
      $("#mapFrameSelect").onchange = (e) => {
        const custom = $("#mapFrameCustom");
        if (e.target.value === "custom") {
          custom.style.display = "block";
          custom.focus();
          return;
        }
        mapLeft = mapTop = null;
        G.updateSettings({ mapFrameSize: Number(e.target.value) });
      };
    if ($("#mapFrameCustom"))
      $("#mapFrameCustom").onchange = (e) => {
        const n = Math.max(30, Math.min(250, Number(e.target.value) || 100));
        mapLeft = mapTop = null;
        G.updateSettings({ mapFrameSize: n });
      };
    viewport.onscroll = () => {
      mapLeft = viewport.scrollLeft;
      mapTop = viewport.scrollTop;
    };
    const setMapZoom = (next, clientX = viewport.clientWidth / 2, clientY = viewport.clientHeight / 2) => {
      const rect=viewport.getBoundingClientRect(), x=clientX+viewport.scrollLeft, y=clientY+viewport.scrollTop, old=mapZoom;
      mapZoom=Math.max(0.35,Math.min(1.5,next)); canvas.style.transform=`scale(${mapZoom})`;
      const size=C.mapWidth*70*mapZoom+20; sizer.style.width=size+"px"; sizer.style.height=size+"px";
      viewport.scrollLeft=(x/old)*mapZoom-clientX; viewport.scrollTop=(y/old)*mapZoom-clientY;
      $(".zoom-readout").textContent=Math.round(mapZoom*100)+"%";
    };
    if ($("#mapZoomIn")) $("#mapZoomIn").onclick=()=>setMapZoom(mapZoom+0.1);
    if ($("#mapZoomOut")) $("#mapZoomOut").onclick=()=>setMapZoom(mapZoom-0.1);
    viewport.onwheel = (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect(),
        x = e.clientX - rect.left + viewport.scrollLeft,
        y = e.clientY - rect.top + viewport.scrollTop,
        old = mapZoom;
      mapZoom = Math.max(
        0.35,
        Math.min(1.5, mapZoom + (e.deltaY < 0 ? 0.1 : -0.1)),
      );
      canvas.style.transform = `scale(${mapZoom})`;
      const size = C.mapWidth * 70 * mapZoom + 20,
        frame = Number(G.state.settings.mapFrameSize || C.defaultMapFrameSize);
      sizer.style.width = size + "px";
      sizer.style.height = size + "px";
      viewport.scrollLeft = (x / old) * mapZoom - (e.clientX - rect.left);
      viewport.scrollTop = (y / old) * mapZoom - (e.clientY - rect.top);
      $(".zoom-readout").textContent = Math.round(mapZoom * 100) + "%";
    };
    let pinchDistance = null, pinchStartZoom = mapZoom;
    viewport.ontouchstart = (e) => { if(e.touches.length===2){ pinchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); pinchStartZoom=mapZoom; } };
    viewport.ontouchmove = (e) => { if(e.touches.length===2 && pinchDistance){ e.preventDefault(); const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); setMapZoom(pinchStartZoom*(d/pinchDistance)); } };
    viewport.ontouchend = (e) => { if(e.touches.length<2) pinchDistance=null; };
    let dragging = false,
      startX = 0,
      startY = 0,
      left = 0,
      top = 0;
    viewport.onpointerdown = (e) => {
      if (e.target.closest(".village-tile")) return;
      if (localStorage.getItem("rdg_admin_pick_map") === "1" && e.target.closest(".empty-map-cell")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      left = viewport.scrollLeft;
      top = viewport.scrollTop;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add("dragging");
    };
    viewport.onpointermove = (e) => {
      if (dragging) {
        viewport.scrollLeft = left - (e.clientX - startX);
        viewport.scrollTop = top - (e.clientY - startY);
      }
    };
    viewport.onpointerup = () => {
      dragging = false;
      viewport.classList.remove("dragging");
    };
  }
  function openProduction(resource){ const v=G.active(); if(!v)return; const names={wood:["Madeira","🪵","lumber"],clay:["Argila","🧱","claypit"],iron:["Ferro","⛓","mine"]}, meta=names[resource]; if(!meta)return; const lv=v.buildings[meta[2]]||0, max=C.buildings[meta[2]].maxLevel, cur=G.prod(v,resource), next=lv<max?G.prodAtLevel(v,resource,lv+1):cur; $("#productionModalTitle").textContent=`${meta[1]} ${meta[0]}`; $("#productionModalBody").innerHTML=`<div class="production-detail"><div class="metric-card"><span>Nível atual</span><strong>${lv}/${max}</strong></div><div class="metric-card"><span>Por minuto</span><strong>${fmt(cur)}</strong></div><div class="metric-card"><span>Por hora</span><strong>${fmt(cur*60)}</strong></div><div class="metric-card"><span>${lv>=max?"Produção máxima":"Próximo nível"}</span><strong>${fmt(next*60)}/h</strong>${lv<max?`<small>+${fmt((next-cur)*60)}/h</small>`:"<small>Nível máximo alcançado</small>"}</div></div>`; bootstrap.Modal.getOrCreateInstance($("#productionModal")).show(); }
  function bindDynamic() {
    document.querySelectorAll(".resource-info").forEach(b=>b.onclick=()=>openProduction(b.dataset.resource));
    document.querySelectorAll("[data-open-market]").forEach(b=>b.onclick=e=>{if(e.target.closest(".list-build-btn"))return;view="market";render(true)});
    document
      .querySelectorAll("[data-quick-build],.list-build-btn")
      .forEach(
        (b) =>
          (b.onclick = (e) => {
            e.stopPropagation();
            G.build(b.dataset.quickBuild || b.dataset.building);
          }),
      );
    document.querySelectorAll("[data-open-buildings]").forEach(
      (b) =>
        (b.onclick = () => {
          buildingsModal();
          bootstrap.Modal.getOrCreateInstance($("#buildingsModal")).show();
        }),
    );
    document
      .querySelectorAll("[data-open-training]")
      .forEach(
        (b) => (b.onclick = () => trainingModal(b.dataset.openTraining)),
      );
    document
      .querySelectorAll("[data-open-rally]")
      .forEach((b) => (b.onclick = () => showAttack()));
    document
      .querySelectorAll(".recruit-btn")
      .forEach(
        (b) =>
          (b.onclick = () =>
            G.recruit(
              b.dataset.unit,
              Number(
                document.querySelector(
                  `.recruit-amount[data-unit="${b.dataset.unit}"]`,
                ).value,
              ),
            )),
      );
    document.querySelectorAll(".village-tile").forEach(
      (b) =>
        (b.onclick = () => {
          const target = G.state.villages[b.dataset.mapId];
          if (G.isMine(target)) {
            G.setActive(target.id);
            view = "village";
          } else observeVillage(target.id);
        }),
    );
    document.querySelectorAll(".village-mode").forEach(
      (b) =>
        (b.onclick = () => {
          villageMode = b.dataset.mode;
          localStorage.setItem("reinosDeGuerra_villageMode", villageMode);
          render(true);
        }),
    );
    if ($("#toggleAllBuildings"))
      $("#toggleAllBuildings").onclick = () => {
        showAllBuildings = !showAllBuildings;
        localStorage.setItem(
          "reinosDeGuerra_showAllBuildings",
          showAllBuildings ? "1" : "0",
        );
        render(true);
      };
    if ($("#toggleMaxBuildings")) $("#toggleMaxBuildings").onclick=()=>{hideMaxBuildings=!hideMaxBuildings;localStorage.setItem("reinosDeGuerra_hideMaxBuildings",hideMaxBuildings?"1":"0");render(true);};
    if ($("#toggleBuildingNames")) $("#toggleBuildingNames").onclick=()=>{showBuildingNames=!showBuildingNames;localStorage.setItem("rdg_show_building_names",showBuildingNames?"1":"0");render(true);};
    document
      .querySelectorAll(".report-summary")
      .forEach(
        (b) =>
          (b.onclick = () =>
            reportModal(visibleReports().find(r=>r.id===b.dataset.reportId))),
      );
    document.querySelectorAll(".report-delete").forEach(
      (b) =>
        (b.onclick = (e) => {
          e.stopPropagation();
          G.deleteReport(b.dataset.reportId);
        }),
    );
    if ($("#deleteAllReports"))
      $("#deleteAllReports").onclick = async () => { if(await modalConfirm("Excluir todos os relatórios?")) G.clearReports(); };
    $("#renameVillageForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      G.renameVillage(G.active().id, new FormData(e.target).get("name"));
    });
    if (view === "settings") {
      const settingsTabs = document.querySelectorAll(".settings-tab-btn");
      const settingsPanes = document.querySelectorAll(".settings-pane");
      const openSettingsTab = (key) => {
        settingsTabs.forEach((b) => b.classList.toggle("active", b.dataset.settingsTab === key));
        settingsPanes.forEach((p) => p.style.display = p.dataset.settingsPane === key ? "block" : "none");
      };
      settingsTabs.forEach((b) => b.onclick = () => { localStorage.setItem("rdg_settings_tab", b.dataset.settingsTab); openSettingsTab(b.dataset.settingsTab); });
      openSettingsTab(localStorage.getItem("rdg_settings_tab") || "speed");
      document.querySelectorAll(".world-preset").forEach(b=>b.onclick=()=>{const p=C.worldPresets?.[b.dataset.preset];if(!p||b.dataset.preset==="custom")return;const prod=Number(p.productionMultiplier)||1;G.updateSettings({worldPreset:b.dataset.preset,production:{wood:prod,clay:prod,iron:prod},buildTimeMultiplier:Number(p.buildTimeMultiplier)||1,travelSecondsPerTile:C.travelSecondsPerTile/(Number(p.unitSpeedMultiplier)||1),ai:{...(G.state.settings.ai||{}),actionIntervalSeconds:p.aiActionIntervalSeconds||25},marketServer:{...(G.state.settings.marketServer||{}),regenerationMultiplier:p.marketRegenerationMultiplier||1},beginnerProtection:{enabled:true,minutes:p.protectionMinutes??15},objective:p.objective||G.state.settings.objective});localStorage.setItem("rdg_settings_tab","speed");render(true);});
      $("#exportBtn").onclick = () => G.export();
      $("#importBtn").onclick = () => $("#importInput").click();
      const saveSettingsTab = (tab) => {
        const form = $("#settingsForm"), f = new FormData(form);
        if (tab === "speed") {
          G.setSpeed(Number(f.get("speed")));
          G.updateSettings({ production:{wood:Number(f.get("wood")),clay:Number(f.get("clay")),iron:Number(f.get("iron"))}, buildCostMultiplier:Number(f.get("cost")), buildTimeMultiplier:Number(f.get("time")), travelSecondsPerTile:Number(f.get("travel")) });
        } else if (tab === "world") {
          const initialBuildingLevels={}; Object.keys(C.buildings).forEach(k=>initialBuildingLevels[k]=Number(f.get("initial-"+k)));
          G.updateSettings({ worldName:String(f.get("worldName")||C.worldName).trim().slice(0,50), startingVillagePoints:Number(f.get("startingPoints"))||C.startingVillagePoints, initialBuildingLevels });
        } else if (tab === "bonus") {
          const bonus={chance:Number(f.get("bonusChance"))}; ["wood","clay","iron","farm","resources","barracks","stable","storage"].forEach(k=>bonus[k]=Number(f.get("bonus-"+k)));
          G.updateSettings({bonus});
        } else if (tab === "rules") {
          G.updateSettings({ difficulty:$("#newDifficulty").value, objective:$("#newObjective").value });
        } else if (tab === "gameplay") {
          try { G.updateSettings({minimumAttackPopulation:Math.max(1,Number(f.get("minimumAttackPopulation"))||10),freeVillageRules:{barbariansBuild:f.get("barbarianBuild")==="on",barbariansRecruit:f.get("barbarianRecruit")==="on",bonusBuild:f.get("bonusBuild")==="on",bonusRecruit:f.get("bonusRecruit")==="on"},periodicResourceBonus:{enabled:f.get("periodicBonusEnabled")==="on",intervalMinutes:Math.max(1,Number(f.get("periodicBonusInterval"))||20),amount:Math.max(0,Number(f.get("periodicBonusAmount"))||0),players:f.get("periodicPlayers")==="on",enemies:f.get("periodicEnemies")==="on",barbarians:f.get("periodicBarbs")==="on",bonusVillages:f.get("periodicBonusVillages")==="on"},beginnerProtection:{enabled:f.get("protectionEnabled")==="on",minutes:Math.max(0,Number(f.get("protectionMinutes"))||15)},marketServer:{...(G.state.settings.marketServer||{}),capacityPerResource:Math.max(1,Number(f.get("marketCapacity"))||600000),regenerationMultiplier:Math.max(0,Number(f.get("marketRegen"))||1)}}); } catch(err){ notifyUI("Não foi possível salvar a jogabilidade.","danger"); return; }
        }
        localStorage.setItem("rdg_settings_tab", tab);
      };
      const fillSettingsBuildings=(levels)=>{Object.entries(C.buildings).forEach(([k,b])=>{const el=document.querySelector(`[name="initial-${k}"]`);if(el)el.value=Math.max(0,Math.min(b.maxLevel,Math.floor(Number(levels?.[k])||0)));});};
      $("#settingsHalfPreset")?.addEventListener("click",()=>fillSettingsBuildings(Object.fromEntries(Object.entries(C.buildings).map(([k,b])=>[k,Math.floor(b.maxLevel*(G.state.settings.buildingPresets?.halfRatio||.5))]))));
      $("#settingsLoadCustomPreset")?.addEventListener("click",()=>fillSettingsBuildings(G.state.settings.buildingPresets?.custom||G.state.settings.initialBuildingLevels));
      $("#settingsSaveCustomPreset")?.addEventListener("click",()=>{const f=new FormData($("#settingsForm")),custom={};Object.keys(C.buildings).forEach(k=>custom[k]=Number(f.get("initial-"+k))||0);G.updateSettings({buildingPresets:{...(G.state.settings.buildingPresets||{}),custom}});});
      document.querySelectorAll(".save-settings-tab").forEach(b=>b.onclick=()=>saveSettingsTab(b.dataset.saveTab));
      $("#settingsForm").onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target),
          bonus = { chance: Number(f.get("bonusChance")) };
        [
          "wood",
          "clay",
          "iron",
          "farm",
          "resources",
          "barracks",
          "stable",
          "storage",
        ].forEach((k) => (bonus[k] = Number(f.get("bonus-" + k))));
        const initialBuildingLevels = {};
        Object.keys(C.buildings).forEach(
          (k) => (initialBuildingLevels[k] = Number(f.get("initial-" + k))),
        );
        G.setSpeed(Number(f.get("speed")));
        G.updateSettings({
          worldName: String(f.get("worldName") || C.worldName)
            .trim()
            .slice(0, 50),
          startingVillagePoints:
            Number(f.get("startingPoints")) || C.startingVillagePoints,
          initialBuildingLevels,
          production: {
            wood: Number(f.get("wood")),
            clay: Number(f.get("clay")),
            iron: Number(f.get("iron")),
          },
          buildCostMultiplier: Number(f.get("cost")),
          buildTimeMultiplier: Number(f.get("time")),
          travelSecondsPerTile: Number(f.get("travel")),
          difficulty: $("#newDifficulty").value,
          objective: $("#newObjective").value,
          bonus,
        });
      };
      $("#newWorldBtn").onclick = async () => {
        if (await modalConfirm(`Apagar o progresso e iniciar ${G.state.settings.worldName || "este mundo"} novamente?`)) G.reset({
          ...G.state.settings,
          difficulty: $("#newDifficulty").value,
          objective: $("#newObjective").value,
        });
      };
      $("#defaultsBtn").onclick = () =>
        G.updateSettings({
          production: { wood: 1, clay: 1, iron: 1 },
          buildCostMultiplier: 1,
          buildTimeMultiplier: 1,
          travelSecondsPerTile: 18,
          bonus: {
            chance: 12,
            wood: 30,
            clay: 30,
            iron: 30,
            farm: 10,
            resources: 15,
            barracks: 10,
            stable: 10,
            storage: 50,
          },
        });
    }
    if (view === "army") {
      const getCustom=()=>{ try{return JSON.parse(localStorage.getItem("rdg_army_custom")||"null")||C.adminPresets.customTroops;}catch{return C.adminPresets.customTroops;} };
      const trainPreset=(preset)=>{
        const v=G.active(), entries=Object.entries(preset).filter(([k,n])=>C.units[k]&&n>0);
        let popNeed=entries.reduce((a,[k,n])=>a+n*C.units[k].population,0), free=Math.max(0,G.popCap(v)-G.population(v));
        let ratio=popNeed?Math.min(1,free/popNeed):0;
        const totalCost={wood:0,clay:0,iron:0};
        for(const [k,n] of entries){ const cost=G.unitCost(k,v); for(const r of ["wood","clay","iron"]) totalCost[r]+=(cost[r]||0)*n; }
        for(const r of ["wood","clay","iron"]) if(totalCost[r]>0) ratio=Math.min(ratio,(v.resources[r]||0)/totalCost[r]);
        ratio=Math.max(0,Math.min(1,ratio));
        entries.forEach(([k,n])=>{ const q=Math.floor(n*ratio); if(q>0) G.recruit(k,q); });
      };
      document.querySelectorAll(".army-preset").forEach(b=>b.onclick=()=>trainPreset(b.dataset.preset==="Defesa"?C.adminPresets.defenseTroops:b.dataset.preset==="Ataque"?C.adminPresets.attackTroops:getCustom()));
      $("#saveArmyCustom").onclick=()=>{ const custom={}; document.querySelectorAll(".recruit-amount").forEach(i=>custom[i.dataset.unit]=Math.max(0,Number(i.value)||0)); localStorage.setItem("rdg_army_custom",JSON.stringify(custom)); notifyUI("Preset personalizado salvo.","success"); };
    }
    if (view === "villages") {
      const filterRows=()=>{ const q=($("#villageSearch")?.value||"").toLowerCase(), f=$("#villageFilter")?.value||"all"; document.querySelectorAll("[data-village-row]").forEach(tr=>{const v=G.state.villages[tr.dataset.villageRow], text=`${v.name} ${v.x}|${v.y}`.toLowerCase(); let ok=text.includes(q); if(f==="build-empty") ok=ok&&!v.buildQueue.length; if(f==="train-empty") ok=ok&&!v.trainQueue.length; if(f==="storage") ok=ok&&["wood","clay","iron"].some(r=>v.resources[r]>=G.cap(v)*.9); tr.classList.toggle("d-none",!ok);});};
      if($("#villageSearch")) $("#villageSearch").oninput=filterRows; if($("#villageFilter")) $("#villageFilter").onchange=filterRows;
      document.querySelectorAll(".village-open").forEach(b=>b.onclick=()=>{G.setActive(b.dataset.id);view="village";render(true);});
      document.querySelectorAll(".village-map").forEach(b=>b.onclick=()=>{G.setActive(b.dataset.id);view="map";mapLeft=mapTop=null;render(true);});
      document.querySelectorAll(".village-quick-build").forEach(sel=>sel.onchange=()=>{if(sel.value){G.buildAt(sel.dataset.id,sel.value);render(true);}});
      document.querySelectorAll(".village-quick-train").forEach(b=>b.onclick=()=>{const id=b.dataset.id, unit=document.querySelector(`.village-quick-unit[data-id="${id}"]`)?.value, amount=Number(document.querySelector(`.village-quick-amount[data-id="${id}"]`)?.value||0); if(unit&&amount>0){G.recruitAt(id,unit,amount);render(true);}});
    }
    if (view === "admin") {
      const setAdminTab = (name) => {
        const valid = ["world", "rules", "create", "village", "bulk", "ai"].includes(name) ? name : "world";
        localStorage.setItem("rdg_admin_tab", valid);
        document.querySelectorAll("[data-admin-pane]").forEach(p => p.classList.toggle("d-none", p.dataset.adminPane !== valid));
        document.querySelectorAll(".admin-tab-btn").forEach(b => {
          const active = b.dataset.adminTab === valid;
          b.classList.toggle("btn-warning", active); b.classList.toggle("btn-outline-secondary", !active);
        });
      };
      document.querySelectorAll(".admin-tab-btn").forEach(b => b.onclick = () => setAdminTab(b.dataset.adminTab));
      setAdminTab(localStorage.getItem("rdg_admin_tab") || "world");
      const bulkChecks=()=>[...document.querySelectorAll(".bulk-village-check")];
      if($("#bulkSelectAll")) $("#bulkSelectAll").onclick=()=>bulkChecks().forEach(x=>x.checked=true);
      const bulkPick=fn=>bulkChecks().forEach(x=>x.checked=!!fn(G.state.villages[x.value]));
      $("#bulkSelectBarbs")?.addEventListener("click",()=>bulkPick(v=>v&&!v.owner&&(!v.bonusType||v.bonusType==="none")));
      $("#bulkSelectBonus")?.addEventListener("click",()=>bulkPick(v=>v&&!v.owner&&!!v.bonusType&&v.bonusType!=="none"));
      $("#bulkSelectEnemies")?.addEventListener("click",()=>bulkPick(v=>v?.owner==="enemy"));
      document.querySelectorAll(".bulk-quadrant").forEach(b=>b.onclick=()=>{const q=b.dataset.q;bulkPick(v=>v&&(q==="NW"?v.x<0&&v.y<0:q==="NE"?v.x>=0&&v.y<0:q==="SW"?v.x<0&&v.y>=0:v.x>=0&&v.y>=0));});
      $("#bulkSelectEnemyAI")?.addEventListener("change",e=>{if(e.target.value)bulkPick(v=>v?.owner==="enemy"&&v.aiId===e.target.value);});
      if($("#bulkSelectMine")) $("#bulkSelectMine").onclick=()=>bulkChecks().forEach(x=>x.checked=G.isMine(G.state.villages[x.value]));
      if($("#bulkClear")) $("#bulkClear").onclick=()=>bulkChecks().forEach(x=>x.checked=false);
      $("#bulkEditCustomTroops")?.addEventListener("click",()=>{const cur=JSON.parse(localStorage.getItem("reinosDeGuerra_customTroops")||"null")||C.adminPresets.customTroops;$("#trainingModalTitle").textContent="Preset personalizado em massa";$("#trainingModalBody").innerHTML=`<p class="small text-secondary">A composição será usada nas aldeias selecionadas. População do preset: <strong id="bulkCustomPop">0</strong>.</p><div class="row g-2">${Object.entries(C.units).map(([k,x])=>`<div class="col-6 col-md-4"><label>${x.icon} ${x.name}</label><input class="form-control bulk-custom-unit" data-unit="${k}" type="number" min="0" value="${cur[k]||0}"></div>`).join("")}</div><button id="saveBulkCustom" class="btn btn-warning mt-3">Salvar personalizado</button>`;const calc=()=>{$("#bulkCustomPop").textContent=fmt([...document.querySelectorAll(".bulk-custom-unit")].reduce((n,i)=>n+(C.units[i.dataset.unit]?.population||0)*(Number(i.value)||0),0))};document.querySelectorAll(".bulk-custom-unit").forEach(i=>i.oninput=calc);calc();$("#saveBulkCustom").onclick=()=>{const out={};document.querySelectorAll(".bulk-custom-unit").forEach(i=>out[i.dataset.unit]=Math.max(0,Number(i.value)||0));localStorage.setItem("reinosDeGuerra_customTroops",JSON.stringify(out));notifyUI("Preset personalizado salvo.","success");bootstrap.Modal.getOrCreateInstance($("#trainingModal")).hide()};bootstrap.Modal.getOrCreateInstance($("#trainingModal")).show()});
      if($("#adminBulkForm")) $("#adminBulkForm").onsubmit=async e=>{e.preventDefault(); const ids=bulkChecks().filter(x=>x.checked).map(x=>x.value); if(!ids.length)return notifyUI("Selecione ao menos uma aldeia."); const f=new FormData(e.currentTarget), data={}; const res=f.get("bulkResources"); if(res)data.resources={wood:res,clay:res,iron:res}; const bonus=f.get("bulkBonus"); if(bonus)data.bonusType=bonus; const bp=f.get("bulkBuildings"); if(bp==="initial")data.buildings={...G.state.settings.initialBuildingLevels}; if(bp==="half")data.buildings=Object.fromEntries(Object.entries(C.buildings).map(([k,b])=>[k,Math.floor(b.maxLevel*(G.state.settings.buildingPresets?.halfRatio||.5))])); if(bp==="custom")data.buildings={...(G.state.settings.buildingPresets?.custom||G.state.settings.initialBuildingLevels)}; if(bp==="max")data.buildings=Object.fromEntries(Object.entries(C.buildings).map(([k,b])=>[k,b.maxLevel])); const tp=f.get("bulkTroops"); if(tp==="defense")data.units={...C.adminPresets.defenseTroops}; if(tp==="attack")data.units={...C.adminPresets.attackTroops}; if(tp==="attackNobles")data.units={...C.adminPresets.attackNoblesTroops}; if(tp==="custom")data.units={...(JSON.parse(localStorage.getItem("reinosDeGuerra_customTroops")||"null")||C.adminPresets.customTroops)}; if(tp==="zero")data.units=Object.fromEntries(Object.keys(C.units).map(k=>[k,0])); if(!Object.keys(data).length&&!f.get("bulkFinish")&&!f.get("bulkOwner"))return notifyUI("Escolha ao menos uma alteração."); if(await modalConfirm(`Aplicar as alterações a ${ids.length} aldeia(s)?`)){if(Object.keys(data).length)G.adminBulkUpdate(ids,data); const finish=f.get("bulkFinish"),owner=f.get("bulkOwner"); if(finish)G.adminBulkFinish(ids,finish); if(owner)G.adminBulkOwner(ids,owner); render(true);}};

      if ($("#adminFinishBuild")) $("#adminFinishBuild").onclick=()=>G.adminFinishBuild(adminVillageId,0);
      if ($("#adminFinishTraining")) $("#adminFinishTraining").onclick=()=>G.adminFinishTraining(adminVillageId,0);
      if ($("#adminFinishAll")) $("#adminFinishAll").onclick=async()=>{ if(await modalConfirm("Finalizar todas as construções e treinamentos desta aldeia?")) G.adminFinishAll(adminVillageId); };
      const rulesBox = $("#worldRulesJson");
      const parseRules = () => {
        try { return JSON.parse(rulesBox.value); }
        catch (err) {
          window.dispatchEvent(new CustomEvent("game-notify", { detail: { msg: "JSON inválido em Regras do Mundo: " + err.message, type: "danger" } }));
          return null;
        }
      };
      const deepMergeRules = (target, source) => {
        Object.entries(source || {}).forEach(([k,v]) => {
          if (v && typeof v === "object" && !Array.isArray(v)) {
            if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
            deepMergeRules(target[k], v);
          } else target[k] = v;
        });
        return target;
      };
      const baseRules = () => { const x = JSON.parse(JSON.stringify(C)); delete x.saveKey; return x; };
      const presetPatch = (name) => ({
        classic: { defaultSpeed:4, buildCostMultiplier:1, buildTimeMultiplier:1, travelSecondsPerTile:12, villageDensity:.09, baseVillageDefense:20, conquestLoyaltyDamage:[25,35], ai:{actionIntervalSeconds:25} },
        fast: { defaultSpeed:8, buildCostMultiplier:.85, buildTimeMultiplier:.55, travelSecondsPerTile:7, villageDensity:.11, baseVillageDefense:18, conquestLoyaltyDamage:[25,35], ai:{actionIntervalSeconds:18} },
        war: { defaultSpeed:6, buildCostMultiplier:.9, buildTimeMultiplier:.7, travelSecondsPerTile:6, villageDensity:.13, baseVillageDefense:25, conquestLoyaltyDamage:[25,35], ai:{actionIntervalSeconds:12} },
        casual: { defaultSpeed:4, buildCostMultiplier:.75, buildTimeMultiplier:.8, travelSecondsPerTile:10, villageDensity:.075, baseVillageDefense:12, conquestLoyaltyDamage:[28,35], ai:{actionIntervalSeconds:40} }
      }[name] || {});
      document.querySelectorAll(".world-rule-preset").forEach(btn => btn.onclick = () => {
        const data = parseRules(); if (!data) return;
        deepMergeRules(data, presetPatch(btn.dataset.preset));
        rulesBox.value = JSON.stringify(data, null, 2);
      });
      $("#worldRulesReset").onclick = () => { rulesBox.value = JSON.stringify(baseRules(), null, 2); };
      $("#saveWorldRules").onclick = () => {
        const data = parseRules(); if (!data) return;
        delete data.saveKey;
        localStorage.setItem("reinosDeGuerra_worldRules", JSON.stringify(data));
        window.dispatchEvent(new CustomEvent("game-notify", { detail: { msg: "Regras do Mundo salvas. Recarregando para aplicar todos os parâmetros…", type: "success" } }));
        setTimeout(() => location.reload(), 250);
      };
      $("#restoreConfigRules").onclick = () => {
        localStorage.removeItem("reinosDeGuerra_worldRules");
        window.dispatchEvent(new CustomEvent("game-notify", { detail: { msg: "Personalização removida. Recarregando config.js…", type: "success" } }));
        setTimeout(() => location.reload(), 250);
      };
      $("#adminWorldForm").onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target),
          freeStartingPointLevels = {};
        Object.keys(C.buildings).forEach(
          (k) => (freeStartingPointLevels[k] = Number(f.get("free-" + k)) || 0),
        );
        G.updateSettings({
          worldName: String(f.get("adminWorldName") || C.worldName)
            .trim()
            .slice(0, 50),
          startingVillagePoints:
            Number(f.get("adminStartingPoints")) || C.startingVillagePoints,
          freeStartingPointLevels,
          unlimitedBuildQueue: f.get("unlimitedBuildQueue") === "on",
          beginnerProtection:{enabled:true,minutes:Math.max(0,Number(f.get("newPlayerProtectionMinutes"))||15)},
          victoryRules: {enabled:f.get("victoryType")!=="none",type:f.get("victoryType")==="none"?"villages":f.get("victoryType"),target:Math.max(1,Number(f.get("victoryTarget"))||10)},
        });
      };
      $("#saveEnemyBehavior")?.addEventListener("click",()=>{const f=new FormData($("#adminWorldForm"));G.updateSettings({ai:{...(G.state.settings.ai||{}),actionIntervalSeconds:Math.max(1,Number(f.get("aiActionInterval"))||C.ai.actionIntervalSeconds)},enemyRules:{...(G.state.settings.enemyRules||{}),canAttackPlayers:f.get("enemyAttackPlayers")==="on",canAttackBarbarians:f.get("enemyAttackBarbs")==="on",canAttackOtherEnemies:f.get("enemyAttackAI")==="on",canConquerOtherEnemies:f.get("enemyConquerAI")==="on",canConquer:f.get("enemyConquer")==="on",maxVillagesPerEnemy:Number(f.get("enemyMaxVillages"))||12,attackRadius:Number(f.get("enemyRadius"))||25,canRecruitTroops:f.get("enemyRecruit")==="on",canBuild:f.get("enemyBuild")==="on",canRecruitNobles:f.get("enemyNobles")==="on",canUseSiege:f.get("enemySiege")==="on",recruitmentBatch:Number(f.get("enemyBatch"))||20}});});
      $("#saveEnemyRoster")?.addEventListener("click",()=>{const f=new FormData($("#adminWorldForm"));G.updateSettings({enemiesEnabled:true,enemyCount:Math.max(10,Number(f.get("enemyCount"))||10)});G.syncEnemies();});
      $("#saveSpawnSettings")?.addEventListener("click",()=>{ const f=new FormData($("#adminWorldForm")); G.updateSettings({barbarianSpawn:{enabled:f.get("spawnEnabled")==="on",intervalMinutes:Math.max(1,Number(f.get("spawnInterval"))||30),maxNewVillages:Math.max(0,Number(f.get("spawnMax"))||0),perCycle:Math.max(1,Number(f.get("spawnPerCycle"))||1),bonusChance:Math.max(0,Math.min(100,Number(f.get("spawnBonus"))||0)),maximized:f.get("spawnMaximized")==="on"}}); window.dispatchEvent(new CustomEvent("game-notify",{detail:{msg:"Configuração de nascimento de aldeias salva separadamente.",type:"success"}})); });
      $("#testSpawnNow")?.addEventListener("click",()=>{G.adminSpawnNow();render(true);});
      $("#maxSpawnCycle")?.addEventListener("click",()=>{G.adminMaximizeSpawnCycle();render(true);});
      $("#adminPickMap").onclick = () => { localStorage.setItem("rdg_admin_pick_map","1"); localStorage.setItem("rdg_admin_tab","create"); view="map"; render(true); };
      $("#adminCreateVillageForm").onsubmit = (e) => {
        e.preventDefault(); const f=new FormData(e.target), buildings={}, units={}, resources={};
        Object.keys(C.buildings).forEach(k=>buildings[k]=Number(f.get("create-building-"+k))||0);
        Object.keys(C.units).forEach(k=>units[k]=Number(f.get("create-unit-"+k))||0);
        ["wood","clay","iron"].forEach(r=>resources[r]=Number(f.get("create-res-"+r))||0);
        G.adminCreateVillage({x:f.get("createX"),y:f.get("createY"),name:f.get("createName"),owner:f.get("createOwner"),bonusType:f.get("createBonus"),buildings,units,resources});
        localStorage.removeItem("rdg_create_x"); localStorage.removeItem("rdg_create_y");
      };
      $("#adminCreateRandom")?.addEventListener("click",()=>{const form=$("#adminCreateVillageForm"),f=new FormData(form),buildings={},units={},resources={};Object.keys(C.buildings).forEach(k=>buildings[k]=Number(f.get("create-building-"+k))||0);Object.keys(C.units).forEach(k=>units[k]=Number(f.get("create-unit-"+k))||0);["wood","clay","iron"].forEach(r=>resources[r]=Number(f.get("create-res-"+r))||0);G.adminCreateRandomVillages({name:f.get("createName"),owner:f.get("createOwner"),bonusType:f.get("createBonus"),buildings,units,resources},Number(f.get("createRandomCount"))||1);render(true);});
      $("#adminVillageSearch")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase().trim();const sel=$("#adminVillageSelect");[...sel.options].forEach(o=>o.hidden=q&&!o.textContent.toLowerCase().includes(q));});
      $("#adminVillageSelect").onchange = (e) => {
        adminVillageId = e.target.value;
        render(true);
      };
      $("#adminIdentityForm").onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        G.adminIdentity(adminVillageId, {
          name: f.get("villageName"),
          owner: f.get("owner"),
          loyalty: Number(f.get("loyalty")),
          bonusType: f.get("bonusType"),
        });
      };
      $("#adminResourcesForm").onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target),
          resources = {};
        ["wood", "clay", "iron"].forEach(
          (r) => (resources[r] = Number(f.get("res-" + r))),
        );
        G.adminUpdate(adminVillageId, { resources });
      };
      const fillAdminResources = (ratio) => {
        const village = G.state.villages[adminVillageId];
        const max = G.cap(village);
        ["wood", "clay", "iron"].forEach((r) => {
          const input = document.querySelector(`#adminResourcesForm [name="res-${r}"]`);
          if (input) input.value = Math.floor(max * ratio);
        });
      };
      $("#adminResourcesHalf").onclick = () => fillAdminResources(0.5);
      $("#adminResourcesFull").onclick = () => fillAdminResources(1);
      $("#adminTroopsForm").onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target),
          units = {};
        Object.keys(C.units).forEach(
          (k) => (units[k] = Number(f.get("unit-" + k))),
        );
        G.adminUpdate(adminVillageId, { units });
      };
      $("#adminBuildingsForm").onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target),
          buildings = {};
        Object.keys(C.buildings).forEach(
          (k) => (buildings[k] = Number(f.get("building-" + k))),
        );
        G.adminUpdate(adminVillageId, { buildings });
      };
      const fillAdminBuildings = (levels) => {
        Object.entries(C.buildings).forEach(([k, b]) => {
          const input = document.querySelector(`#adminBuildingsForm [name="building-${k}"]`);
          if (input) input.value = Math.max(0, Math.min(b.maxLevel, Math.floor(Number(levels?.[k]) || 0)));
        });
      };
      $("#adminMaxBuildings").onclick = () => fillAdminBuildings(Object.fromEntries(Object.entries(C.buildings).map(([k, b]) => [k, b.maxLevel])));
      $("#adminHalfBuildings").onclick = () => fillAdminBuildings(Object.fromEntries(Object.entries(C.buildings).map(([k,b])=>[k,Math.floor(b.maxLevel*(G.state.settings.buildingPresets?.halfRatio||.5))])));
      $("#adminSaveCustomBuildings").onclick = () => {const f=new FormData($("#adminBuildingsForm")),custom={};Object.keys(C.buildings).forEach(k=>custom[k]=Number(f.get("building-"+k))||0);G.updateSettings({buildingPresets:{...(G.state.settings.buildingPresets||{}),custom}});};
      $("#adminLoadCustomBuildings").onclick = () => fillAdminBuildings(G.state.settings.buildingPresets?.custom||G.state.settings.initialBuildingLevels);
      const applyArmyPreset = (preset) => {
        const village = G.state.villages[adminVillageId], cap = G.popCap(village);
        const need = Object.entries(preset).reduce((n, [k, q]) => n + (C.units[k]?.population || 0) * q, 0);
        const ratio = need > cap ? cap / need : 1;
        Object.keys(C.units).forEach((k) => {
          const input = document.querySelector(`#adminTroopsForm [name="unit-${k}"]`);
          if (input) input.value = Math.floor((preset[k] || 0) * ratio);
        });
        if (ratio < 1) window.dispatchEvent(new CustomEvent("game-notify", { detail: { msg: "Preset ajustado proporcionalmente à população disponível. Clique em Salvar tropas para aplicar.", type: "warning" } }));
      };
      $("#adminDefenseTroops").onclick = () =>
        applyArmyPreset(C.adminPresets.defenseTroops);
      $("#adminAttackTroops").onclick = () =>
        applyArmyPreset(C.adminPresets.attackTroops);
      $("#adminCustomTroops").onclick = () => { const cur=JSON.parse(localStorage.getItem("reinosDeGuerra_customTroops")||"null")||C.adminPresets.customTroops; $("#trainingModalTitle").textContent="Preset militar personalizado"; $("#trainingModalBody").innerHTML=`<p class="small text-secondary">Edite a composição. População total: <strong id="customPresetPop">0</strong>.</p><div class="row g-2">${Object.entries(C.units).map(([k,u])=>`<div class="col-6 col-md-4"><label>${u.icon} ${u.name}</label><input class="form-control admin-custom-unit" data-unit="${k}" type="number" min="0" value="${cur[k]||0}"></div>`).join("")}</div><button id="saveAdminCustomModal" class="btn btn-warning mt-3">Salvar preset</button>`; const calc=()=>{$("#customPresetPop").textContent=fmt([...document.querySelectorAll(".admin-custom-unit")].reduce((n,i)=>n+(C.units[i.dataset.unit]?.population||0)*(Number(i.value)||0),0))}; document.querySelectorAll(".admin-custom-unit").forEach(i=>i.oninput=calc);calc(); $("#saveAdminCustomModal").onclick=()=>{const out={};document.querySelectorAll(".admin-custom-unit").forEach(i=>out[i.dataset.unit]=Math.max(0,Number(i.value)||0));localStorage.setItem("reinosDeGuerra_customTroops",JSON.stringify(out));applyArmyPreset(out);bootstrap.Modal.getOrCreateInstance($("#trainingModal")).hide();notifyUI("Preset personalizado salvo e carregado.","success")}; bootstrap.Modal.getOrCreateInstance($("#trainingModal")).show(); };
      $("#adminSaveCustomTroops").onclick = () => {
        const f = new FormData($("#adminTroopsForm")),
          u = {};
        Object.keys(C.units).forEach(
          (k) => (u[k] = Number(f.get("unit-" + k)) || 0),
        );
        localStorage.setItem("reinosDeGuerra_customTroops", JSON.stringify(u));
        window.dispatchEvent(
          new CustomEvent("game-notify", {
            detail: { msg: "Preset personalizável salvo.", type: "success" },
          }),
        );
      };
      $("#adminLoadCustomTroops").onclick = () => {
        let u;
        try {
          u = JSON.parse(localStorage.getItem("reinosDeGuerra_customTroops"));
        } catch (e) {}
        applyArmyPreset(u || C.adminPresets.customTroops);
      };
      $("#adminInitialBuildings").onclick = () => fillAdminBuildings(G.state.settings.initialBuildingLevels);
    }
    if(view==="ranking"){
      document.querySelectorAll(".ranking-tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".ranking-tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll("[data-rank-pane]").forEach(p=>p.classList.toggle("d-none",p.dataset.rankPane!==b.dataset.rank));});
      document.querySelectorAll(".ranking-name").forEach(b=>b.onclick=()=>openPlayerProfile(b.dataset.player));
    }
    if(view==="commands") document.querySelectorAll(".command-village-link").forEach(b=>b.onclick=()=>{if(!b.dataset.villageId)return;localStorage.setItem("rdg_map_focus",b.dataset.villageId);view="map";mapLeft=null;mapTop=null;render(true)});
    if(view==="villages"){
      const selected=()=>[...document.querySelectorAll(".village-bulk-check:checked")].map(x=>x.value);
      $("#villageSelectAll")?.addEventListener("click",()=>document.querySelectorAll(".village-bulk-check").forEach(x=>x.checked=true));
      $("#villageClearAll")?.addEventListener("click",()=>document.querySelectorAll(".village-bulk-check").forEach(x=>x.checked=false));
      $("#villageBulkBuild")?.addEventListener("click",()=>{const ids=selected(),k=$("#villageBulkBuilding").value;if(ids.length&&k)G.bulkBuild(ids,k)});
      document.querySelectorAll(".village-bulk-preset").forEach(b=>b.onclick=()=>{const key=b.dataset.preset,preset=key==="defense"?C.adminPresets.defenseTroops:key==="attack"?C.adminPresets.attackTroops:(JSON.parse(localStorage.getItem("reinosDeGuerra_customTroops")||"null")||C.adminPresets.customTroops);G.bulkRecruitPreset(selected(),preset)});
      $("#editVillageCustom")?.addEventListener("click",()=>{const cur=JSON.parse(localStorage.getItem("reinosDeGuerra_customTroops")||"null")||C.adminPresets.customTroops;$("#trainingModalTitle").textContent="Preset personalizado";$("#trainingModalBody").innerHTML=`<p class="text-secondary small">Defina quantas unidades o preset coletivo tentará recrutar por aldeia. Recursos, requisitos e população continuam sendo respeitados.</p><div class="row g-2">${Object.entries(C.units).map(([k,u])=>`<div class="col-6 col-md-4"><label class="small">${u.icon} ${u.name}</label><input class="form-control custom-preset-unit" data-unit="${k}" type="number" min="0" value="${cur[k]||0}"></div>`).join("")}</div><button id="saveVillageCustomPreset" class="btn btn-warning mt-3">Salvar personalizado</button>`;$("#saveVillageCustomPreset").onclick=()=>{const out={};document.querySelectorAll(".custom-preset-unit").forEach(i=>out[i.dataset.unit]=Math.max(0,Number(i.value)||0));localStorage.setItem("reinosDeGuerra_customTroops",JSON.stringify(out));notifyUI("Preset personalizado salvo.","success");bootstrap.Modal.getOrCreateInstance($("#trainingModal")).hide()};bootstrap.Modal.getOrCreateInstance($("#trainingModal")).show();});
      document.querySelectorAll(".village-open").forEach(b=>b.onclick=()=>{G.setActive(b.dataset.id);view="village";render(true)});
      document.querySelectorAll(".village-map").forEach(b=>b.onclick=()=>{G.setActive(b.dataset.id);view="map";render(true);setTimeout(()=>$("#mapCenterBtn")?.click(),0)});
    }
    if(view==="achievements"){document.querySelectorAll(".claim-achievement").forEach(b=>b.onclick=()=>{G.claimAchievement(b.dataset.id,G.currentPlayerId(),b.dataset.villageId||null);render(true)});}
    if(view==="market"){$("#marketExchangeForm")?.addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget),r=G.marketExchange(f.get("give"),f.get("take"),f.get("amount"));if(!r.ok)return showInfo("Troca não realizada",r.msg);showInfo("Troca concluída",`Você recebeu ${fmt(r.receive)} recursos.`);market();});}
    if(view==="simulator"){$("#simulatorForm")?.addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget),a={},d={};Object.keys(C.units).forEach(k=>{a[k]=Number(f.get(`a-${k}`))||0;d[k]=Number(f.get(`d-${k}`))||0});const wall=Number(f.get("wall"))||0,r=G.simulateCombat(a,d,wall),box=$("#simResult");box.classList.remove("d-none");if(!r){box.innerHTML="Não foi possível simular.";return;}box.innerHTML=`<h3 class="h6">Resultado pelo motor real de combate</h3><strong class="${r.victory?"text-success":"text-danger"}">${r.victory?"Vitória do atacante":"Vitória da defesa"}</strong><div class="mt-2"><b>Sobreviventes atacantes:</b> ${Object.entries(r.attacking?.survivors||{}).filter(([,q])=>q).map(([k,q])=>`${C.units[k]?.icon||""}${fmt(q)}`).join(" ")||"nenhum"}</div><div><b>Sobreviventes defensores:</b> ${Object.entries(r.defending?.survivors||{}).filter(([,q])=>q).map(([k,q])=>`${C.units[k]?.icon||""}${fmt(q)}`).join(" ")||"nenhum"}</div>${r.siege?.ram?`<div>Muralha: ${r.siege.ram.before} → ${r.siege.ram.after}</div>`:""}${r.siege?.catapult?`<div>Catapulta: ${C.buildings[r.siege.catapult.building]?.name||r.siege.catapult.building} ${r.siege.catapult.before} → ${r.siege.catapult.after}</div>`:""}<small class="text-secondary">A simulação executa o mesmo resolvedor do ataque real sobre uma cópia temporária do mundo.</small>`;});document.querySelectorAll(".sim-preset").forEach(b=>b.onclick=()=>{const x=C.adminPresets[b.dataset.preset]||{};Object.keys(C.units).forEach(k=>{const el=document.querySelector(`[name='a-${k}']`);if(el)el.value=x[k]||0})});$(".sim-preset-defense")?.addEventListener("click",()=>{const x=C.adminPresets.defenseTroops||{};Object.keys(C.units).forEach(k=>{const el=document.querySelector(`[name='d-${k}']`);if(el)el.value=x[k]||0})});document.querySelectorAll(".sim-clear").forEach(b=>b.onclick=()=>Object.keys(C.units).forEach(k=>{const el=document.querySelector(`[name='a-${k}']`);if(el)el.value=0}));}

    if(view==="reports"){ document.querySelectorAll(".report-summary").forEach(b=>b.onclick=e=>{e.preventDefault();const r=visibleReports().find(x=>String(x.id)===String(b.dataset.reportId));if(r)reportModal(r)}); $("#reportTypeFilter")?.addEventListener("change",e=>{localStorage.setItem("rdg_report_filter",e.target.value);render(true)}); $("#reportStateFilter")?.addEventListener("change",e=>{localStorage.setItem("rdg_report_state",e.target.value);render(true)}); document.querySelectorAll(".report-favorite").forEach(b=>b.onclick=()=>G.toggleReportFavorite(b.dataset.reportId)); $("#reportDeleteSelected")?.addEventListener("click",()=>G.deleteReports([...document.querySelectorAll(".report-check:checked")].map(x=>x.value))); }
    if(view==="commands"){ const rf=$("#recurringAttackForm");if(rf)rf.onsubmit=e=>{e.preventDefault();const f=new FormData(rf),targets=[...$("#recurringKnownTarget").selectedOptions].map(o=>o.value);if(f.get("x")!==""&&f.get("y")!==""){const manual=G.villageAt(f.get("x"),f.get("y"));if(manual&&!targets.includes(manual.id))targets.push(manual.id);}if(!targets.length)return showInfo("Destino inválido","Selecione uma ou mais aldeias conhecidas ou informe coordenadas válidas.");const origins=[...document.querySelectorAll(".recurring-origin:checked")].map(x=>x.value),units={};Object.keys(C.units).forEach(k=>units[k]=Math.max(0,Number(f.get(`u-${k}`))||0));if(!Object.values(units).some(Boolean))return showInfo("Sem tropas","Informe ao menos uma unidade.");if(G.createRecurringAttack({origins,targets,units,intervalMs:(Number(f.get("interval"))||5)*60000,durationMs:(Number(f.get("duration"))||0)*60000})){showInfo("Programação criada","Os disparos verificarão as tropas disponíveis a cada execução.");render(true);}};document.querySelectorAll(".recurring-action").forEach(b=>b.onclick=()=>{G.toggleRecurringAttack(b.dataset.id,b.dataset.action);render(true)}); const sf=$("#syncAttackForm"); if(sf) sf.onsubmit=e=>{e.preventDefault();const f=new FormData(sf),target=G.villageAt(f.get("x"),f.get("y"));if(!target)return notifyUI("Não existe aldeia no destino.","warning");const ratio=Number(f.get("ratio"))||.25,at=new Date(f.get("at")).getTime();let ok=0,fail=0;document.querySelectorAll(".sync-origin:checked").forEach(c=>{const v=G.state.villages[c.value],units=Object.fromEntries(Object.keys(C.units).map(k=>[k,Math.floor((v.units[k]||0)*ratio)]));G.scheduleAttackFrom(v.id,target.id,units,at,"arrival")?ok++:fail++;});if(ok){window.dispatchEvent(new Event("game-update"));notifyUI(`${ok} ataque(s) sincronizado(s).${fail?` ${fail} origem(ns) não puderam cumprir o horário/regras.`:""}`,fail?"warning":"success");}else notifyUI("Nenhuma origem pôde ser agendada.","warning");}; document.querySelectorAll(".support-withdraw").forEach(b=>b.onclick=()=>G.withdrawSupport(b.dataset.support)); document.querySelectorAll(".cancel-scheduled").forEach(b=>b.onclick=()=>G.cancelScheduled(b.dataset.movement)); }
    if (view === "map") bindMap();
  }
  const renderers = { overview, village, army, villages, commands, market, simulator, ranking, achievements, map, reports, settings, admin };
  function render(force = false) {
    const focused = document.activeElement,
      editing =
        !force &&
        focused?.matches?.("input,select,textarea") &&
        (focused.closest("#view-settings") ||
          focused.closest("#view-admin") ||
          focused.closest("#attackModal"));
    header();
    const mine = G.owned();
    if (!mine.length && !isAdmin()) {
      $("#view-village").innerHTML = `<section class="panel p-4 text-center"><div class="eyebrow">Reino derrotado</div><h2>Você perdeu todas as aldeias</h2><p class="text-secondary">Escolha no aviso se deseja continuar neste mesmo mundo com uma nova aldeia ou começar um mundo novo.</p></section>`;
      document.querySelectorAll(".game-view").forEach(e=>e.classList.add("d-none"));
      $("#view-village").classList.remove("d-none");
      const dm=bootstrap.Modal.getOrCreateInstance($("#defeatModal")); dm.show();
      return;
    }
    if (!G.active() && isAdmin() && ["village","army"].includes(view)) {
      $("#view-"+view).innerHTML = `<section class="panel p-4 text-center"><div class="eyebrow">Administração do mundo</div><h2>Nenhuma aldeia pertencente ao Admin</h2><p class="text-secondary">O Administrador está com 0 pontos e 0 aldeias. Use Administração → Criar aldeia para atribuir uma aldeia ao Admin quando desejar.</p></section>`;
    } else if (!editing) renderers[view]();
    if (editing) return;
    document
      .querySelectorAll(".game-view")
      .forEach((e) => e.classList.add("d-none"));
    $("#view-" + view).classList.remove("d-none");
    document
      .querySelectorAll(".game-nav .nav-link")
      .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    try{G.refreshAchievements();const st=G.state.achievements?.[G.currentPlayerId()]||{},pending=Object.values(st).some(x=>(x?.unlocked&&!x?.claimed)||Object.values(x?.villages||{}).some(v=>v?.unlocked&&!v?.claimed));document.querySelector('[data-view="achievements"]')?.classList.toggle("achievement-nav-alert",pending);}catch{}
    bindDynamic();
  }
  $("#defeatRestartSame")?.addEventListener("click",()=>{ bootstrap.Modal.getOrCreateInstance($("#defeatModal")).hide(); G.restartCurrentPlayer(); view="village"; render(true); });
  $("#defeatNewWorld")?.addEventListener("click",async()=>{ bootstrap.Modal.getOrCreateInstance($("#defeatModal")).hide(); if(await modalConfirm("Apagar o mundo atual e começar um novo mundo do zero?")){ G.reset({...G.state.settings}); G.ensureCurrentPlayer(); view="village"; render(true); } else bootstrap.Modal.getOrCreateInstance($("#defeatModal")).show(); });
  document.querySelectorAll(".game-nav .nav-link").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.view === "admin" && !requireAdmin()) return;
        view = b.dataset.view;
        render(true);
      }),
  );
  $("#villageSelect").addEventListener("change", (e) => {
    G.setActive(e.target.value);
    view = "village";
  });
  $("#pauseBtn").onclick = () => G.togglePause();
  $("#attackForm").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      target = G.villageAt(f.get("targetX"), f.get("targetY")),
      units = Object.fromEntries(
        Object.keys(C.units).map((k) => [k, Number(f.get(k))]),
      );
    if (target) {
      const count = Math.max(
        1,
        Math.min(20, Number(f.get("attackCount")) || 1),
      );
      const available = { ...G.active().units };
      const enough = Object.entries(units).every(
        ([k, n]) => (available[k] || 0) >= n * count,
      );
      if (!enough)
        window.dispatchEvent(
          new CustomEvent("game-notify", {
            detail: {
              msg: "Não há tropas suficientes para repetir esse ataque nessa quantidade.",
              type: "danger",
            },
          }),
        );
      else
        for (let i = 0; i < count; i++)
          f.get("commandType")==="support" ? G.sendSupport(target.id,units) : (f.get("scheduleMode")!=="now" ? G.scheduleAttack(target.id,units,new Date(f.get("scheduleAt")).getTime(),f.get("scheduleMode"),f.get("catapultTarget")) : G.sendAttack(target.id, units, f.get("catapultTarget")));
    } else
      window.dispatchEvent(
        new CustomEvent("game-notify", {
          detail: {
            msg: "Não existe aldeia nessas coordenadas.",
            type: "warning",
          },
        }),
      );
    bootstrap.Modal.getInstance($("#attackModal"))?.hide();
  };
  $("#importInput").onchange = async (e) => {
    try {
      await G.import(e.target.files[0]);
    } catch (err) {
      notifyUI(err.message,"danger");
    }
  };
  // O motor do jogo atualiza o estado várias vezes por segundo. Nunca fazemos uma
  // renderização completa como consequência automática desses ticks: reconstruir a
  // view remove foco, recria inputs/modais e leva o scroll ao topo. Isso afetava
  // Exército, Aldeia, Administração, Ajustes e qualquer formulário aberto.
  //
  // As views completas são renderizadas apenas por navegação/ações explícitas do
  // usuário. Durante o processamento do mundo atualizamos somente elementos vivos.
  // Delegação estável: relatórios continuam abrindo mesmo após filtros/atualizações parciais.
  document.addEventListener("click", (e) => {
    const sim=e.target.closest?.(".report-sim-spy,.report-sim-survivors");if(sim){const r=visibleReports().find(x=>String(x.id)===String(sim.dataset.reportId));if(r){bootstrap.Modal.getOrCreateInstance($("#reportModal")).hide();view="simulator";const data=sim.classList.contains("report-sim-spy")?r.intel?.units:r.defending?.survivors;render(true);setTimeout(()=>{simulator({units:data||{},wall:r.intel?.buildings?.wall||0,label:`Dados do relatório de ${new Date(r.time).toLocaleString("pt-BR")} — podem estar desatualizados`});bindDynamic();window.scrollTo({top:0,behavior:"smooth"});},50);}return;}
    const b=e.target.closest?.(".report-summary[data-report-id]");
    if(!b) return;
    const r=visibleReports().find(x=>String(x.id)===String(b.dataset.reportId));
    if(r){ e.preventDefault(); reportModal(r); }
  });
  window.addEventListener("game-update", () => { updateLive(); });
  window.addEventListener("game-tick", updateLive);
  window.addEventListener("game-objective", (e) => {
    $("#objectiveReachedText").textContent = e.detail.name;
    $("#objectiveNextSelect").innerHTML = Object.entries(C.objectives)
      .map(
        ([k, o]) =>
          `<option value="${k}" ${k === G.state.settings.objective ? "selected" : ""}>${o.name}</option>`,
      )
      .join("");
    bootstrap.Modal.getOrCreateInstance($("#objectiveModal")).show();
  });
  $("#objectiveContinueBtn").onclick = () =>
    bootstrap.Modal.getInstance($("#objectiveModal"))?.hide();
  $("#objectiveSetBtn").onclick = () => {
    G.setObjective($("#objectiveNextSelect").value);
    bootstrap.Modal.getInstance($("#objectiveModal"))?.hide();
  };
  window.addEventListener("game-notify", (e) => {
    if(window.matchMedia("(max-width: 767px)").matches && ["warning","danger"].includes(e.detail.type)){showInfo("Ação não disponível",e.detail.msg);return;}
    const a = document.createElement("div");
    a.className = `alert alert-${e.detail.type} alert-dismissible fade show`;
    a.innerHTML = `${e.detail.msg}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    $("#alerts").append(a);
    setTimeout(() => a.remove(), 3500);
  });
  window.addEventListener("achievement-unlocked",e=>showInfo("Conquista desbloqueada",`<strong>${e.detail.name}</strong>${e.detail.village?`<div class="text-secondary mt-1">${e.detail.village}</div>`:""}<div class="mt-2">Acesse Conquistas para verificar a recompensa.</div>`));
  function applySessionUI() {
    const session = window.RDGAuth?.current();
    const login = $("#loginScreen"), shell = $("#gameShell");
    if (!session) { login?.classList.remove("d-none"); shell?.classList.add("d-none"); return false; }
    login?.classList.add("d-none"); shell?.classList.remove("d-none");
    document.querySelectorAll(".admin-link, [data-view=\"settings\"]").forEach(el=>el.classList.toggle("d-none", !isAdmin()));
    const badge=$("#sessionRole"); if(badge) badge.textContent=isAdmin()?`Administrador · ${session.username}`:`Jogador · ${session.username}`;
    return true;
  }
  $("#loginForm").onsubmit = (e) => {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    if (!window.RDGAuth.login(f.get("username"),f.get("password"))) { $("#loginError").textContent="Usuário ou senha inválidos."; $("#loginError").classList.remove("d-none"); return; }
    $("#loginError").classList.add("d-none");
    // Mostra a sessão antes de inicializar o mundo. Assim um erro de migração/renderização
    // nunca faz um login válido parecer rejeitado.
    applySessionUI();
    try { G.ensureCurrentPlayer(); view="village"; render(true); }
    catch(err) { console.error("Falha ao iniciar o mundo após login:",err); showInfo("Erro ao carregar o mundo",`O login foi aceito, mas ocorreu um erro ao carregar o mundo.<div class="small text-secondary mt-2">${String(err?.message||err)}</div>`); }
  };
  $("#showRegisterBtn").onclick=()=>{$("#loginForm").classList.add("d-none");$("#registerForm").classList.remove("d-none");};
  $("#backLoginBtn").onclick=()=>{$("#registerForm").classList.add("d-none");$("#loginForm").classList.remove("d-none");};
  $("#registerForm").onsubmit=(e)=>{ e.preventDefault(); const f=new FormData(e.currentTarget), r=window.RDGAuth.register(f.get("username"),f.get("password")); if(!r.ok){$("#registerError").textContent=r.error;$("#registerError").classList.remove("d-none");return;} window.RDGAuth.login(f.get("username"),f.get("password")); G.ensureCurrentPlayer(); applySessionUI(); view="village"; render(true); };
  $("#logoutBtn").onclick=()=>window.RDGAuth.logout();
  document.querySelectorAll('[data-view="admin"], [data-view="settings"]').forEach(b=>b.addEventListener("click",e=>{ if(!isAdmin()){e.preventDefault();e.stopImmediatePropagation();requireAdmin();} },true));
  if (applySessionUI()) { G.ensureCurrentPlayer(); render(true); }
})();
