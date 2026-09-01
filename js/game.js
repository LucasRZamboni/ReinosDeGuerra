(function () {
  const C = window.GAME_CONFIG,
    S = window.GameStorage,
    clone = (o) => JSON.parse(JSON.stringify(o)),
    rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
    id = (x, y) => `v-${x}-${y}`,
    mapMinX = () => C.mapOriginCentered ? -Math.floor(C.mapWidth/2) : 0,
    mapMinY = () => C.mapOriginCentered ? -Math.floor(C.mapHeight/2) : 0,
    mapMaxX = () => mapMinX()+C.mapWidth-1,
    mapMaxY = () => mapMinY()+C.mapHeight-1;
  const session = () => window.RDGAuth?.current?.() || null;
  const currentPlayerId = () => session()?.playerId || "admin";
  const isAdmin = () => session()?.role === "admin";
  const isMine = (v) => !!v && v.owner === "player" && v.ownerId === currentPlayerId();
  const isPlayerVillage = (v) => !!v && v.owner === "player";
  const emptyUnits = () =>
    Object.fromEntries(Object.keys(C.units).map((k) => [k, 0]));
  const bonusDefaults = () => clone(C.bonusDefaults || {
    chance: 12, wood: 30, clay: 30, iron: 30, farm: 10, resources: 15,
    barracks: 10, stable: 10, storage: 50,
  });
  function defaults() {
    return {
      difficulty: "normal",
      objective: "villages10",
      production: clone(C.productionPerMinute || { wood: 1, clay: 1, iron: 1 }),
      buildCostMultiplier: C.buildCostMultiplier ?? 1,
      buildTimeMultiplier: C.buildTimeMultiplier ?? 1,
      travelSecondsPerTile: C.travelSecondsPerTile ?? 10,
      startingVillagePoints: C.startingVillagePoints,
      worldName: C.worldName,
      mapFrameSize: C.defaultMapFrameSize,
      freeVillagesTrainTroops: C.freeVillagesTrainTroops ?? true,
      unlimitedBuildQueue: C.unlimitedBuildQueue ?? false,
      enemiesEnabled: C.enemiesEnabled ?? false,
      enemyCount: C.enemyCount ?? 0,
      barbarianSpawn: clone(C.barbarianSpawn || {enabled:true,intervalMinutes:30,maxNewVillages:20,perCycle:1,bonusChance:15,maximized:false}),
      enemyRules: clone(C.enemyRules || {}),
      buildingPresets: clone(C.buildingPresets || {halfRatio:.5,custom:null}),
      newPlayerProtectionHours: C.newPlayerProtectionHours ?? 72,
      victoryRules: clone(C.victoryRules || {enabled:true,type:"villages",target:10}),
      initialBuildingLevels: clone(C.initialBuildingLevels),
      freeStartingPointLevels: clone(C.freeStartingPointLevels),
      bonus: bonusDefaults(),
    };
  }
  function mergedSettings(options = {}) {
    const d = defaults();
    return {
      ...d,
      ...options,
      production: { ...d.production, ...(options.production || {}) },
      bonus: { ...d.bonus, ...(options.bonus || {}) },
      barbarianSpawn: { ...d.barbarianSpawn, ...(options.barbarianSpawn || {}) },
      enemyRules: { ...d.enemyRules, ...(options.enemyRules || {}) },
      buildingPresets: { ...d.buildingPresets, ...(options.buildingPresets || {}) },
      victoryRules: { ...d.victoryRules, ...(options.victoryRules || {}) },
      initialBuildingLevels: { ...d.initialBuildingLevels, ...(options.initialBuildingLevels || {}) },
      freeStartingPointLevels: { ...d.freeStartingPointLevels, ...(options.freeStartingPointLevels || {}) },
    };
  }
  function rollBonus(owner, settings) {
    if (owner === "player" || Math.random() * 100 >= settings.chance)
      return "none";
    const types = [
      "wood",
      "clay",
      "iron",
      "farm",
      "resources",
      "barracks",
      "stable",
      "storage",
    ];
    return types[rand(0, types.length - 1)];
  }
  function makeVillage(x, y, owner = null, settings = mergedSettings()) {
    const player = owner === "player",
      buildings = { ...Object.fromEntries(Object.keys(C.buildings).map((k) => [k, 0])), ...clone(settings.initialBuildingLevels) };
    return {
      id: id(x, y),
      name: player ? C.startingVillage.name : `Aldeia bárbara ${x}|${y}`,
      x,
      y,
      owner,
      ownerId: player ? currentPlayerId() : null,
      bonusType: rollBonus(owner, settings.bonus),
      loyalty: C.baseLoyalty,
      resources: player
        ? clone(C.startingResources)
        : {
            wood: rand(250, 1000),
            clay: rand(250, 1000),
            iron: rand(250, 1000),
          },
      buildings,
      units: player
        ? { ...emptyUnits(), spear: 12 }
        : { ...emptyUnits(), spear: rand(6, 30), sword: rand(0, 15) },
      buildQueue: [],
      trainQueue: [],
    };
  }
  function makeTerrain() {
    const cells = [];
    for (let y = mapMinY(); y <= mapMaxY(); y++)
      for (let x = mapMinX(); x <= mapMaxX(); x++) {
        const n = Math.random(),
          type =
            n < 0.1
              ? "forest"
              : n < 0.14
                ? "lake"
                : n < 0.19
                  ? "hill"
                  : "grass";
        cells.push({ x, y, type });
      }
    return cells;
  }
  function newState(options = {}) {
    const settings = mergedSettings(options),
      villages = {},
      terrain = makeTerrain();
    for (let y = mapMinY(); y <= mapMaxY(); y++)
      for (let x = mapMinX(); x <= mapMaxX(); x++) {
        const start = x === C.startingVillage.x && y === C.startingVillage.y;
        if (start || Math.random() < C.villageDensity)
          {
            const village = makeVillage(x, y, start ? "player" : null, settings);
            if (start) village.buildings = { ...village.buildings, ...settings.initialBuildingLevels };
            villages[id(x, y)] = village;
          }
      }
    return {
      version: 8,
      createdAt: Date.now(),
      lastUpdate: Date.now(),
      lastAiAction: Date.now(),
      speed: C.defaultSpeed,
      paused: false,
      won: false,
      settings,
      activeVillageId: id(C.startingVillage.x, C.startingVillage.y),
      terrain,
      villages,
      movements: [],
      combatStats: {},
      supportStationed: {},
      aiDiagnostics: {},
      reports: [
        {
          id: `info-${Date.now()}`,
          time: Date.now(),
          type: "info",
          title: "Um novo domínio",
          text: "Sua aldeia está pronta para crescer.",
        },
      ],
    };
  }
  function migrate(data) {
    const old = data.version || 1;
    data.settings = mergedSettings(data.settings || {});
    data.villages = data.villages || {};
    if (old < 6) {
      data.terrain = makeTerrain();
      const target = Math.round(C.mapWidth * C.mapHeight * C.villageDensity),
        empty = [];
      for (let y = mapMinY(); y <= mapMaxY(); y++)
        for (let x = mapMinX(); x <= mapMaxX(); x++)
          if (!data.villages[id(x, y)]) empty.push([x, y]);
      while (Object.keys(data.villages).length < target && empty.length) {
        const [x, y] = empty.splice(rand(0, empty.length - 1), 1)[0];
        data.villages[id(x, y)] = makeVillage(x, y, null, data.settings);
      }
      data.version = 6;
    }
    if (old < 7) {
      Object.values(data.villages).forEach(v => {
        if (!v.owner) v.buildings = { ...Object.fromEntries(Object.keys(C.buildings).map(k => [k, 0])), ...clone(data.settings.initialBuildingLevels) };
      });
      data.version = 7;
    }

    // v8: mundo compartilhado. Aldeias de jogadores passam a ter ownerId.
    // A aldeia legada fica com o administrador para preservar o save existente.
    Object.values(data.villages).forEach(v => {
      if (v.owner === "player" && !v.ownerId) v.ownerId = "admin";
      if (v.owner !== "player" && v.ownerId) v.ownerId = null;
      if (v.owner === "enemy" && !v.aiId) v.aiId = `ai-${v.id}`;
    });
    data.players = data.players || {};
    // v9: coordenadas centradas em 0|0. Saves antigos 0..99 são deslocados sem perder movimentos.
    if (C.mapOriginCentered && Number(data.version||1) < 9 && Object.values(data.villages).some(v => v.x > mapMaxX() || v.y > mapMaxY())) {
      const dx=Math.floor(C.mapWidth/2), dy=Math.floor(C.mapHeight/2), remap={};
      Object.values(data.villages).forEach(v=>{const old=v.id;v.x-=dx;v.y-=dy;v.id=id(v.x,v.y);remap[old]=v.id;});
      data.villages=Object.fromEntries(Object.values(data.villages).map(v=>[v.id,v]));
      (data.terrain||[]).forEach(c=>{c.x-=dx;c.y-=dy;});
      (data.movements||[]).forEach(m=>{m.fromId=remap[m.fromId]||m.fromId;m.targetId=remap[m.targetId]||m.targetId;});
      data.activeVillageId=remap[data.activeVillageId]||data.activeVillageId;
    }
    data.version = Math.max(Number(data.version||1), 9);
    if (!data.terrain || data.terrain.length !== C.mapWidth * C.mapHeight)
      data.terrain = makeTerrain();
    if (!data.lastAiAction) data.lastAiAction = Date.now();
    Object.values(data.villages).forEach((v) => {
      v.buildings = v.buildings || {};
      v.units = v.units || {};
      if (v.owner === "rival") v.owner = null;
      if (!v.bonusType) v.bonusType = rollBonus(v.owner, data.settings.bonus);
      Object.keys(v.buildings).forEach((k) => {
        if (!C.buildings[k]) delete v.buildings[k];
      });
      Object.keys(C.buildings).forEach((k) => {
        if (v.buildings[k] === undefined) v.buildings[k] = 0;
      });
      if (v.units.rider) {
        v.units.light = (v.units.light || 0) + v.units.rider;
        delete v.units.rider;
      }
      Object.keys(v.units).forEach((k) => {
        if (!C.units[k]) delete v.units[k];
      });
      Object.keys(C.units).forEach((k) => {
        if (v.units[k] === undefined) v.units[k] = 0;
      });
      v.buildQueue = (v.buildQueue || []).filter(
        (q) => C.buildings[q.building],
      );
      v.trainQueue = (v.trainQueue || [])
        .map((q) => {
          const unit = q.unit === "rider" ? "light" : q.unit;
          const amount = Math.max(1, Math.floor(q.amount || 1));
          const trained = Math.max(0, Math.min(amount, Math.floor(q.trained || 0)));
          const duration = q.unitDuration || Math.max(1, ((q.end || Date.now()) - (q.start || Date.now())) / amount);
          return { ...q, unit, amount, trained, unitDuration: duration, nextAt: q.nextAt || (q.start || Date.now()) + duration * (trained + 1) };
        })
        .filter((q) => C.units[q.unit]);
    });
    data.movements = data.movements || [];
    data.combatStats = data.combatStats || {};
    data.reports = data.reports || [];
    data.supportStationed = data.supportStationed || {}; data.aiDiagnostics = data.aiDiagnostics || {};
    Object.values(data.villages).forEach(v=>{ if(v.owner==="player" && !v.protectionUntil && v.ownerId && v.ownerId!=="admin") v.protectionUntil=0; });
    data.settings.objective =
      data.settings.objective === "rivals" ? "map100" : data.settings.objective;
    if (!data.villages[data.activeVillageId]) data.activeVillageId = Object.keys(data.villages)[0];
    return data;
  }
  let state = migrate(S.load() || newState());
  const active = () => state.villages[state.activeVillageId],
    owned = () => Object.values(state.villages).filter(isMine),
    villageAt = (x, y) => state.villages[id(Number(x), Number(y))];
  const cap = (v) => {
    const base = C.warehouseByLevel[Math.min(30, v.buildings.storage || 1)];
    return Math.floor(base * (v.bonusType === "storage" ? 1 + bonusValue(v, "storage") / 100 : 1));
  };
  function bonusValue(v, key) {
    return Number(state.settings.bonus[key] || 0);
  }
  function popCap(v) {
    const base = C.farmByLevel[Math.min(30, v.buildings.farm || 1)];
    return Math.floor(
      base * (v.bonusType === "farm" ? 1 + bonusValue(v, "farm") / 100 : 1),
    );
  }
  function buildingPopulationAt(k, lv) { const b=C.buildings[k]; lv=Math.max(0,Number(lv||0)); return (!b||!lv||!Number(b.populationBase)) ? 0 : Math.round(Number(b.populationBase)*Math.pow(Number(b.populationFactor||1),lv-1)); }
  function buildingPopulation(v) {
    return Object.entries(C.buildings).reduce((sum,[k,b]) => {
      const lv=Math.max(0,Number(v.buildings?.[k]||0));
      return sum + buildingPopulationAt(k,lv);
    },0);
  }
  const population = (v) =>
    buildingPopulation(v) + Object.entries(v.units).reduce(
      (n, [k, q]) => n + (C.units[k] ? q * C.units[k].population : 0),
      0,
    ) +
    (v.trainQueue || []).reduce(
      (n, q) =>
        n + (C.units[q.unit] ? Math.max(0,(q.amount||0)-(q.trained||0)) * C.units[q.unit].population : 0),
      0,
    );
  function prod(v, r) {
    const lv =
        v.buildings[
          r === "wood" ? "lumber" : r === "clay" ? "claypit" : "mine"
        ] || 0,
      p =
        v.bonusType === r
          ? bonusValue(v, r)
          : v.bonusType === "resources"
            ? bonusValue(v, "resources")
            : 0;
    return (
      ((C.productionByLevel[lv] || 0) / 60) *
      state.settings.production[r] *
      (1 + p / 100)
    );
  }
  function buildingCost(k, v) {
    const b = C.buildings[k],
      lv = v.buildings[k] || 0;
    return Object.fromEntries(
      Object.entries(b.baseCost).map(([r, n]) => [
        r,
        Math.ceil(
          n *
            Math.pow(b.costFactor[r], lv) *
            state.settings.buildCostMultiplier,
        ),
      ]),
    );
  }
  function buildingTime(k, v) {
    const b = C.buildings[k],
      lv = v.buildings[k] || 0;
    return Math.ceil(
      (b.baseTime * Math.pow(1.2, lv) * state.settings.buildTimeMultiplier) /
        Math.pow(1.05, (v.buildings.keep || 1) - 1),
    );
  }
  function buildingPoints(k, lv) {
    const b = C.buildings[k];
    if (!b || !lv) return 0;
    // Tabela clássica de pontos totais: o valor do nível é o total acumulado
    // daquele edifício (ex.: Principal 1=10, 2=12, 3=14...).
    return Math.round(b.pointBase * Math.pow(C.buildingPointFactor, lv - 1));
  }
  const pointCache = new Map();
  function points(v) {
    const sig=Object.keys(C.buildings).map(k=>v.buildings[k]||0).join(",")+"|"+Object.keys(C.buildings).map(k=>state.settings.freeStartingPointLevels?.[k]||0).join(",");
    const cached=pointCache.get(v.id); if(cached?.sig===sig) return cached.value;
    // A pontuação da aldeia vem exclusivamente dos edifícios existentes.
    // Assim não há soma artificial de 28 pontos e o ritmo/velocidade do mundo
    // nunca altera a pontuação. O preset inicial padrão soma exatamente 28.
    const value=Object.entries(v.buildings).reduce((n, [k, lv]) => {
      const free = Number(state.settings.freeStartingPointLevels?.[k] || 0);
      return n + Math.max(0, buildingPoints(k, lv) - buildingPoints(k, Math.min(lv, free)));
    }, 0);
    pointCache.set(v.id,{sig,value}); return value;
  }
  function maxVillagePoints(){ const fake={id:"__max__",buildings:Object.fromEntries(Object.entries(C.buildings).map(([k,b])=>[k,b.maxLevel]))}; return points(fake); }
  const unitBuildings = {
    spear: "barracks",
    sword: "barracks",
    axe: "barracks",
    archer: "barracks",
    scout: "stable",
    light: "stable",
    mounted: "stable",
    heavy: "stable",
    ram: "workshop",
    catapult: "workshop",
    noble: "academy",
    paladin: "statue",
  };
  function unitDiscount(v, k) {
    const trainer = unitBuildings[k];
    return v.bonusType === trainer ? bonusValue(v, trainer) : 0;
  }
  function unitCost(k, v) {
    const discount = unitDiscount(v, k);
    return Object.fromEntries(
      Object.entries(C.units[k].cost).map(([r, n]) => [
        r,
        Math.ceil(n * (1 - discount / 100)),
      ]),
    );
  }
  function unitTrainTime(k, v) {
    return Math.max(
      1,
      Math.ceil(C.units[k].trainSeconds * (1 - unitDiscount(v, k) / 100)),
    );
  }
  const meets = (v, req = {}) =>
      Object.entries(req).every(([k, n]) => (v.buildings[k] || 0) >= n),
    canPay = (v, c) => Object.entries(c).every(([r, n]) => v.resources[r] >= n),
    pay = (v, c) =>
      Object.entries(c).forEach(([r, n]) => (v.resources[r] -= n));
  function notify(msg, type = "success") {
    window.dispatchEvent(
      new CustomEvent("game-notify", { detail: { msg, type } }),
    );
  }
  function build(k) {
    const v = active(),
      b = C.buildings[k],
      c = buildingCost(k, v);
    if (!meets(v, b.requires))
      return notify(
        "Os requisitos deste edifício ainda não foram atendidos.",
        "warning",
      );
    if ((v.buildings[k] || 0) >= b.maxLevel)
      return notify("Nível máximo atingido.", "warning");
    const queueUnlocked = state.settings.unlimitedBuildQueue === true || (v.buildings.keep || 0) >= 10;
    if (v.buildQueue.length && !queueUnlocked)
      return notify("A fila múltipla é liberada no Edifício Principal nível 10 ou pelo administrador.", "warning");
    // A construção pode ser enfileirada. Para custo/tempo, considera níveis do mesmo
    // edifício que já estejam aguardando na fila.
    const projected = clone(v);
    v.buildQueue.forEach(q => projected.buildings[q.building] = (projected.buildings[q.building] || 0) + 1);
    if ((projected.buildings[k] || 0) >= b.maxLevel)
      return notify("Nível máximo já atingido ou enfileirado.", "warning");
    const currentProjectedPop=population(projected), nextLv=(projected.buildings[k]||0)+1;
    const extraBuildingPop=buildingPopulationAt(k,nextLv)-buildingPopulationAt(k,projected.buildings[k]||0);
    if(currentProjectedPop+extraBuildingPop>popCap(projected)) return notify("População insuficiente na Fazenda para esta construção.","warning");
    const queuedCost = buildingCost(k, projected);
    if (!canPay(v, queuedCost)) return notify("Recursos insuficientes.", "danger");
    pay(v, queuedCost);
    const start = v.buildQueue.length ? v.buildQueue[v.buildQueue.length - 1].end : Date.now();
    v.buildQueue.push({
      building: k,
      start,
      end: start + (buildingTime(k, projected) * 1000) / state.speed,
    });
    saveRender();
  }
  function recruit(k, amount) {
    amount = Math.max(1, Math.floor(amount));
    const v = active(),
      u = C.units[k];
    if (!meets(v, u.requires))
      return notify(
        "Os edifícios necessários ainda não foram construídos.",
        "warning",
      );
    if (
      u.limit &&
      (v.units[k] || 0) +
        v.trainQueue
          .filter((q) => q.unit === k)
          .reduce((n, q) => n + q.amount, 0) +
        amount >
        u.limit
    )
      return notify(`Limite de ${u.name}: ${u.limit}.`, "warning");
    const each = unitCost(k, v),
      cost = Object.fromEntries(
        Object.entries(each).map(([r, n]) => [r, n * amount]),
      );
    if (!canPay(v, cost)) return notify("Recursos insuficientes.", "danger");
    if (population(v) + u.population * amount > popCap(v))
      return notify("População insuficiente.", "warning");
    pay(v, cost);
    const duration = (unitTrainTime(k, v) * 1000) / state.speed;
    const start = v.trainQueue.length ? v.trainQueue.at(-1).end : Date.now();
    v.trainQueue.push({
      unit: k, amount, trained: 0, start,
      nextAt: start + duration,
      end: start + duration * amount,
      unitDuration: duration,
    });
    saveRender();
  }
  function strength(
    units,
    kind = "attack",
    mix = { inf: 1, cav: 0, arch: 0 },
    wall = 0,
  ) {
    let total = 0;
    Object.entries(units).forEach(([k, q]) => {
      const u = C.units[k];
      if (!u) return;
      total +=
        (kind === "attack"
          ? u.attack
          : u.defenseInfantry * mix.inf +
            u.defenseCavalry * mix.cav +
            u.defenseArcher * mix.arch) * q;
    });
    return total * (kind === "defense" ? 1 + wall * 0.05 : 1);
  }
  function travelInfo(targetId, units) {
    const from = active(),
      target = state.villages[targetId];
    if (!from || !target) return null;
    const sent = Object.entries(units || {}).filter(
        ([k, n]) => C.units[k] && Number(n) > 0,
      ),
      distance = Math.hypot(from.x - target.x, from.y - target.y);
    if (!sent.length) return { distance, seconds: 0 };
    const slow = Math.min(...sent.map(([k]) => C.units[k].speed));
    return {
      distance,
      seconds: Math.max(
        3,
        (state.settings.travelSecondsPerTile * distance) / slow / state.speed,
      ),
    };
  }
  function estimate(targetId, units) {
    const t = state.villages[targetId];
    if (!t) return null;
    const atk = strength(units),
      def =
        Object.entries(t.units).reduce(
          (n, [k, q]) =>
            n +
            ((C.units[k].defenseInfantry + C.units[k].defenseCavalry) / 2) * q,
          0,
        ) *
        (1 + (t.buildings.wall || 0) * 0.08),
      travel = travelInfo(targetId, units);
    return {
      attack: Math.round(atk),
      defense: Math.round(def),
      chance: Math.max(
        5,
        Math.min(95, Math.round((atk / (atk + def || 1)) * 100)),
      ),
      ...travel,
    };
  }
  function launch(from, target, units, catapultTarget = null) {
    Object.entries(units).forEach(([k, n]) => (from.units[k] -= n));
    const info = travelInfo(target.id, units),
      ms = info.seconds * 1000;
    state.movements.push({
      id: `m-${Date.now()}-${Math.random()}`,
      fromId: from.id,
      targetId: target.id,
      units,
      catapultTarget,
      outbound: true,
      travelMs: ms,
      end: Date.now() + ms,
    });
  }
  function sendAttack(targetId, units, catapultTarget = null) {
    const from = active(),
      target = state.villages[targetId];
    if (!target)
      return notify("Não existe aldeia nessas coordenadas.", "warning");
    if (isMine(target))
      return notify(
        "Não é possível atacar uma aldeia em sua posse.",
        "warning",
      );
    const sent = Object.fromEntries(
      Object.entries(units)
        .filter(([k]) => C.units[k])
        .map(([k, n]) => [k, Math.max(0, Math.floor(Number(n) || 0))])
        .filter(([, n]) => n),
    );
    if (!Object.keys(sent).length)
      return notify("Escolha pelo menos uma unidade.", "warning");
    if (Object.entries(sent).some(([k, n]) => from.units[k] < n))
      return notify("Quantidade inválida.", "danger");
    launch(from, target, sent, catapultTarget);
    saveRender();
    notify("As tropas iniciaram a marcha.");
  }
  function losses(before, after) {
    return Object.fromEntries(
      Object.entries(before).map(([k, n]) => [
        k,
        Math.max(0, n - (after[k] || 0)),
      ]),
    );
  }
  function combatKey(v){ return v?.owner==="enemy" ? (v.aiId||`ai-${v.id}`) : v?.owner==="player" ? v.ownerId : null; }
  function combatStat(key){ if(!key) return null; return state.combatStats[key]||(state.combatStats[key]={attackerPoints:0,defenderPoints:0,conquests:0}); }
  function unitLossScore(units){ return Object.entries(units||{}).reduce((n,[k,q])=>n+q*((C.units[k]?.population||1)+(C.units[k]?.attack||0)/50),0); }
  function sendSupport(targetId, units) {
    const from=active(), target=state.villages[targetId]; if(!from||!target) return notify("Destino inválido.","warning");
    const clean={}; let any=false; for(const k of Object.keys(C.units)){const n=Math.max(0,Math.floor(Number(units?.[k])||0)); if(n>(from.units[k]||0)) return notify("Tropas insuficientes.","warning"); clean[k]=n; any ||= n>0;}
    if(!any) return notify("Selecione tropas para o apoio.","warning"); Object.entries(clean).forEach(([k,n])=>from.units[k]-=n);
    const info=travelInfo(targetId,clean), ms=info.seconds*1000; state.movements.push({id:`support-${Date.now()}-${Math.random()}`,kind:"support",fromId:from.id,targetId:target.id,units:clean,outbound:true,travelMs:ms,end:Date.now()+ms}); saveRender();
  }
  function withdrawSupport(supportId){ const x=state.supportStationed[supportId]; if(!x) return; const target=state.villages[x.targetId], home=state.villages[x.fromId]; if(!target||!home) return; delete state.supportStationed[supportId]; const ms=Math.max(1000,Math.hypot(target.x-home.x,target.y-home.y)*state.settings.travelSecondsPerTile*1000/state.speed); state.movements.push({id:`support-return-${Date.now()}-${Math.random()}`,kind:"supportReturn",fromId:x.fromId,targetId:x.targetId,units:x.units,outbound:false,travelMs:ms,end:Date.now()+ms}); saveRender(); }
  function arriveSupport(m){ state.supportStationed[m.id]={id:m.id,fromId:m.fromId,targetId:m.targetId,units:clone(m.units),arrivedAt:Date.now()}; }
  function resolve(m) {
    const from = state.villages[m.fromId],
      target = state.villages[m.targetId];
    if (!from || !target) return;
    const attackerKey=combatKey(from), defenderKey=combatKey(target);
    const attacker = { name: from.name, x: from.x, y: from.y, owner: from.owner || null },
      defender = { name: target.name, x: target.x, y: target.y, owner: target.owner || null },
      defenderBonus = { type: target.bonusType || "none", value: target.bonusType && target.bonusType !== "none" ? bonusValue(target, target.bonusType) : 0 },
      atkRaw = strength(m.units),
      types = { inf: 0, cav: 0, arch: 0 };
    Object.entries(m.units).forEach(([k, q]) => {
      const u = C.units[k],
        p = u.attack * q;
      if (u.class === "cavalry") types.cav += p;
      else if (u.class === "archer") types.arch += p;
      else types.inf += p;
    });
    const mix = {
        inf: atkRaw ? types.inf / atkRaw : 1,
        cav: atkRaw ? types.cav / atkRaw : 0,
        arch: atkRaw ? types.arch / atkRaw : 0,
      },
      defRaw = C.baseVillageDefense + strength(
        target.units,
        "defense",
        mix,
        target.buildings.wall || 0,
      ),
      atk = atkRaw * (0.9 + Math.random() * 0.2),
      def = defRaw * (0.9 + Math.random() * 0.2),
      ratio = atk / (atk + def || 1),
      win = atk > def,
      attackBefore = clone(m.units),
      defBefore = clone(target.units),
      survivors = {};
    Object.entries(m.units).forEach(
      ([k, q]) =>
        (survivors[k] = win
          ? Math.floor(q * (0.5 + 0.45 * ratio))
          : Math.floor(q * 0.08 * ratio)),
    );
    // Nobres são unidades de conquista, não linha de frente. Quando há escolta
    // suficiente para vencer a batalha, eles permanecem protegidos. Sem escolta
    // (ou numa derrota), continuam sujeitos às baixas normais.
    if ((attackBefore.noble || 0) > 0) {
      const escortUnits = { ...attackBefore };
      delete escortUnits.noble;
      const escortAttack = strength(escortUnits);
      if (win && escortAttack >= defRaw) survivors.noble = attackBefore.noble;
    }
    Object.keys(target.units).forEach(
      (k) =>
        (target.units[k] = Math.floor(
          target.units[k] *
            (win ? (1 - ratio) * 0.15 : 0.68 + 0.25 * (1 - ratio)),
        )),
    );
    const atkLosses=losses(attackBefore,survivors), defLosses=losses(defBefore,target.units);
    const ast=combatStat(attackerKey), dst=combatStat(defenderKey);
    if(ast) ast.attackerPoints += Math.round(unitLossScore(defLosses));
    if(dst) dst.defenderPoints += Math.round(unitLossScore(atkLosses));
    const loyaltyBefore = Math.max(0, Number(target.loyalty ?? C.baseLoyalty));
    let loot = { wood: 0, clay: 0, iron: 0 },
      conquered = false,
      loyaltyDamage = 0,
      loyaltyAfter = loyaltyBefore,
      siege = { ram: null, catapult: null };
    if (win) {
      const capacity = Object.entries(survivors).reduce(
        (n, [k, q]) => n + q * C.units[k].carry,
        0,
      );
      ["wood", "clay", "iron"].forEach((r) => {
        loot[r] = Math.min(target.resources[r], Math.floor(capacity / 3));
        target.resources[r] -= loot[r];
        from.resources[r] = Math.min(cap(from), from.resources[r] + loot[r]);
      });
      if ((attackBefore.ram || 0) > 0) {
        const before = target.buildings.wall || 0,
          damage = Math.max(1, Math.floor(attackBefore.ram / 20));
        target.buildings.wall = Math.max(0, before - damage);
        siege.ram = { building: "wall", before, after: target.buildings.wall, levelsDestroyed: before - target.buildings.wall, sent: attackBefore.ram };
      }
      if ((attackBefore.catapult || 0) > 0) {
        const targets = Object.keys(C.buildings).filter(
            (k) => (target.buildings[k] || 0) > 0 && k !== "hide",
          ),
          requested = m.catapultTarget,
          chosen = requested && targets.includes(requested) ? requested : targets[rand(0, targets.length - 1)];
        if (chosen) {
          const before = target.buildings[chosen] || 0,
            minimum = ["keep", "farm", "storage"].includes(chosen) ? 1 : 0,
            damage = Math.max(1, Math.floor(attackBefore.catapult / 25));
          target.buildings[chosen] = Math.max(minimum, before - damage);
          siege.catapult = { building: chosen, before, after: target.buildings[chosen], levelsDestroyed: before - target.buildings[chosen], sent: attackBefore.catapult };
        }
      }
      if ((survivors.noble || 0) > 0) {
        // Cada nobre sobrevivente reduz entre os limites configurados.
        // O padrão é 25–35, portanto um único nobre normalmente exige cerca de 4 ataques.
        for (let i = 0; i < survivors.noble && target.loyalty > 0; i++)
          loyaltyDamage += rand(...C.conquestLoyaltyDamage);
        target.loyalty = Math.max(0, target.loyalty - loyaltyDamage);
        loyaltyAfter = target.loyalty;
        if (target.loyalty <= 0) {
          target.owner = from.owner === "enemy" ? "enemy" : "player";
          target.ownerId = from.owner === "player" ? from.ownerId : null;
          if (from.owner === "enemy") { target.aiProfile = from.aiProfile || "expansive"; target.aiId = from.aiId || `ai-${from.id}`; }
          target.loyalty = 100;
          target.name = `Fortaleza ${target.x}|${target.y}`;
          survivors.noble--;
          conquered = true;
          if(ast) ast.conquests=(ast.conquests||0)+1;
          // Só avisa o usuário quando a aldeia conquistada era realmente dele.
          if (defenderOwnerBefore === "player" && defenderOwnerIdBefore === currentPlayerId())
            notify(`${target.name} foi conquistada pelo inimigo!`, "danger");
        }
      }
    }
    const attackScouts = attackBefore.scout || 0,
      remainingScouts = survivors.scout || 0,
      defenderScouts = target.units.scout || 0,
      spied = attackScouts > 0 && remainingScouts > defenderScouts,
      intel = attackScouts
        ? {
            success: spied,
            reason: spied
              ? "Espionagem concluída."
              : "Os batedores defensores impediram a espionagem.",
          }
        : null;
    if (spied) {
      const scoutAdvantage = Math.max(1, remainingScouts - defenderScouts);
      intel.level = scoutAdvantage >= 100 ? 3 : scoutAdvantage >= 25 ? 2 : 1;
      intel.reason = intel.level === 3 ? "Espionagem completa: recursos, edifícios e tropas revelados." : intel.level === 2 ? "Espionagem avançada: recursos e edifícios revelados." : "Espionagem básica: recursos revelados.";
      intel.resources = clone(target.resources);
      if (intel.level >= 2) intel.buildings = clone(target.buildings);
      if (intel.level >= 3) intel.units = clone(target.units);
    }
    // Relatórios de batalha pertencem ao jogador: não registrar combates
    // entre inimigos/bárbaros que não envolvam nenhuma aldeia do jogador.
    const reportRecipients = [...new Set([from.owner === "player" ? from.ownerId : null, defenderOwnerBefore === "player" ? defenderOwnerIdBefore : null].filter(Boolean))];
    const playerInvolved = reportRecipients.length > 0;
    if (playerInvolved) state.reports.unshift({
      recipients: reportRecipients,
      id: `rpt-${Date.now()}-${Math.random()}`,
      time: Date.now(),
      type: win ? "win" : "loss",
      victory: win,
      attackerPlayerId: from.owner === "player" ? from.ownerId : null,
      defenderPlayerId: defenderOwnerBefore === "player" ? defenderOwnerIdBefore : null,
      attacker,
      defender,
      defenderBonus,
      attacking: {
        before: attackBefore,
        losses: losses(attackBefore, survivors),
        survivors: clone(survivors),
      },
      defending: {
        before: defBefore,
        losses: losses(defBefore, target.units),
        survivors: clone(target.units),
      },
      loot,
      conquered,
      loyaltyDamage,
      loyaltyBefore,
      loyaltyAfter,
      siege,
      intel,
    });
    if (playerInvolved) state.reports = state.reports.slice(0, 200);
    if (Object.values(survivors).some(Boolean) && from.owner)
      state.movements.push({
        ...m,
        id: `return-${Date.now()}-${Math.random()}`,
        units: survivors,
        outbound: false,
        end: Date.now() + m.travelMs,
      });
    checkVictory();
  }
  function aiAction(now) {
    const d = C.difficulties[state.settings.difficulty];
    // Aldeias não-jogadoras recebem recursos pelo mesmo sistema de produção do jogador.
    // A IA não ganha mais recursos, edifícios ou tropas gratuitamente a cada ciclo.
    Object.values(state.villages).filter((v) => v.owner !== "player").forEach((v) => {
      const profile=v.aiProfile||"economic"; const choices = profile==="defensive" ? ["wall","farm","storage","barracks","keep","lumber","claypit","mine"] : profile==="offensive" ? ["barracks","stable","smithy","farm","storage","keep","lumber","claypit","mine"] : profile==="expansive" ? ["academy","farm","storage","barracks","stable","keep","lumber","claypit","mine"] : ["lumber","claypit","mine","farm","storage","keep","market","barracks"];
      const erLocal=state.settings.enemyRules||{}, isEnemy=v.owner==="enemy"; if(isEnemy){ const drec=state.aiDiagnostics[v.aiId||v.id]||(state.aiDiagnostics[v.aiId||v.id]={}); drec.lastSeen=now; drec.status=(v.buildQueue||[]).length?"Construindo":(v.trainQueue||[]).length?"Recrutando":population(v)>=popCap(v)?"Fazenda cheia":"Economia/evolução"; drec.villageId=v.id; }
      if ((!isEnemy || erLocal.canBuild!==false) && !(v.buildQueue || []).length && Math.random() < (isEnemy ? 0.62 : 0.28) * d.aiGrowth) {
        let candidates = choices.filter(k => C.buildings[k] && (v.buildings[k] || 0) < C.buildings[k].maxLevel && meets(v, C.buildings[k].requires) && canPay(v, buildingCost(k, v)));
        // IAs expansionistas/ofensivas perseguem a cadeia que libera Academia/Nobres,
        // em vez de depender de sorte para um dia chegar aos requisitos.
        if (isEnemy && erLocal.canRecruitNobles!==false && erLocal.canConquer!==false && ["expansive","offensive"].includes(profile)) {
          const strategic=["keep","barracks","smithy","market","academy","farm","storage","lumber","claypit","mine"];
          candidates.sort((a,b)=>strategic.indexOf(a)-strategic.indexOf(b));
        }
        if (candidates.length) {
          const k = (isEnemy && ["expansive","offensive"].includes(profile)) ? candidates[0] : candidates[rand(0, candidates.length - 1)], cost = buildingCost(k, v);
          pay(v, cost);
          v.buildQueue.push({ building: k, start: now, end: now + (buildingTime(k, v) * 1000) / state.speed });
        }
      }
      if (state.settings.freeVillagesTrainTroops !== false && (!isEnemy || erLocal.canRecruitTroops!==false) && Math.random() < 0.55 * d.aiGrowth) {
        // A IA recompõe o exército com todas as classes que já desbloqueou.
        // Expansivas/Ofensivas também passam a formar Nobres quando a Academia e os recursos permitem.
        const pools = profile === "defensive" ? ["spear","sword","archer","heavy","scout"]
          : profile === "expansive" ? ["axe","light","spear","scout","ram","noble"]
          : profile === "offensive" ? ["axe","light","mounted","ram","catapult","scout","noble"]
          : ["spear","sword","axe","archer","scout","light"];
        const options = pools.filter(k => C.units[k] && (!isEnemy || k!=="noble" || erLocal.canRecruitNobles!==false) && (!isEnemy || !["ram","catapult"].includes(k) || erLocal.canUseSiege!==false) && meets(v, C.units[k].requires || {}) && population(v) + C.units[k].population <= popCap(v) && canPay(v, unitCost(k, v)));
        if (options.length) {
          // Prioriza um Nobre quando pode conquistar e ainda não possui um disponível.
          const er = state.settings.enemyRules || {};
          let k = options.includes("noble") && er.canConquer !== false && (v.units.noble || 0) < 1 ? "noble" : options[rand(0, options.length - 1)];
          const cost = unitCost(k, v), room = Math.floor((popCap(v)-population(v))/Math.max(1,C.units[k].population));
          let batch = k === "noble" ? 1 : Math.max(1, Math.min(Number(erLocal.recruitmentBatch)||20, room));
          for (const r of ["wood","clay","iron"]) batch = Math.min(batch, Math.floor(v.resources[r]/Math.max(1,cost[r])));
          batch = Math.max(0,batch);
          if (batch) { pay(v, Object.fromEntries(["wood","clay","iron"].map(r=>[r,cost[r]*batch]))); v.units[k] = (v.units[k] || 0) + batch; }
        }
      }
    });
    if (state.settings.enemiesEnabled) {
      Object.values(state.villages).filter(v => v.owner === "enemy").forEach(from => {
        const profile=from.aiProfile||"offensive"; const attackRate=profile==="offensive"?.32:profile==="expansive"?.22:profile==="defensive"?.08:.12; if (Math.random() > attackRate * d.aiGrowth) return;
        const er=state.settings.enemyRules||{};
        if (!from.aiId) from.aiId = `ai-${from.id}`;
        const enemyVillageCount=Object.values(state.villages).filter(v=>v.owner==="enemy" && v.aiId===from.aiId).length;
        const targets = Object.values(state.villages).filter(v => {
          if(v.id===from.id) return false;
          const dist=Math.hypot(v.x-from.x,v.y-from.y); if(dist>(Number(er.attackRadius)||25)) return false;
          if(v.owner==="player") return er.canAttackPlayers!==false && !(v.protectionUntil && now < v.protectionUntil);
          if(v.owner==="enemy") return er.canAttackOtherEnemies===true && v.aiId !== from.aiId;
          return er.canAttackBarbarians!==false;
        });
        if (!targets.length) { const drec=state.aiDiagnostics[from.aiId||from.id]||(state.aiDiagnostics[from.aiId||from.id]={}); drec.status="Sem alvo permitido"; return; }
        targets.sort((a,b) => Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y));
        const target = targets[rand(0, Math.min(7, targets.length-1))];
        const units = {}; let any=false;
        ["spear","sword","axe","archer","light","heavy","ram"].forEach(k => { if(k==="ram" && er.canUseSiege===false)return; const n=Math.floor((from.units[k]||0)*0.20); units[k]=n; if(n){from.units[k]-=n; any=true;} });
        const conquestAllowed=er.canConquer!==false && enemyVillageCount < (Number(er.maxVillagesPerEnemy)||12) && (target.owner==="player" ? er.canConquerPlayers!==false : target.owner==="enemy" ? er.canConquerOtherEnemies===true : er.canConquerBarbarians!==false);
        if(conquestAllowed && !(from.units.noble||0)){ const drec=state.aiDiagnostics[from.aiId||from.id]||(state.aiDiagnostics[from.aiId||from.id]={}); drec.status="Preparando Nobre"; }
        if(conquestAllowed && (from.units.noble||0)>0 && (profile==="expansive" || profile==="offensive")){ units.noble=1; from.units.noble-=1; any=true; }
        if (any) { const dist=Math.hypot(target.x-from.x,target.y-from.y), travelMs=Math.max(1000, dist*state.settings.travelSecondsPerTile*1000/state.speed); state.movements.push({id:`enemy-${Date.now()}-${Math.random()}`,fromId:from.id,targetId:target.id,units,outbound:true,start:now,end:now+travelMs,travelMs,catapultTarget:null}); if(isMine(target)) notify(`⚔ Ataque inimigo a caminho de ${target.name} (${target.x}|${target.y}).`,"danger"); }
      });
    }
    state.lastAiAction = now;
  }
  function checkVictory() {
    const vr=state.settings.victoryRules||{}, o = vr.enabled===false ? {type:"none",target:Infinity,name:"Sem condição de vitória"} : (vr.type ? {type:vr.type,target:Number(vr.target)||10,name:`${vr.type}: ${vr.target}`} : (C.objectives[state.settings.objective] || C.objectives.villages10)),
      count = owned().length,
      total = Object.keys(state.villages).length,
      won =
        o.type === "none" ? false : o.type === "last" ? [...new Set(Object.values(state.villages).filter(v=>v.owner==="player"||v.owner==="enemy").map(v=>v.owner==="enemy"?(v.aiId||v.id):(v.ownerId||v.id)))].length<=1 : o.type === "points" ? owned().reduce((n,v)=>n+points(v),0)>=o.target : o.type === "conquests"
          ? Math.max(0, count - 1) >= o.target
          : o.type === "villages"
            ? count >= o.target
            : (count / total) * 100 >= o.target;
    if (won && !state.won) {
      state.won = true;
      state.reports.unshift({
        id: `goal-${Date.now()}`,
        time: Date.now(),
        type: "info",
        title: "Objetivo cumprido!",
        text: o.name,
      });
      notify("Vitória! O objetivo deste mundo foi alcançado.");
      window.dispatchEvent(new CustomEvent("game-objective", { detail: { key: state.settings.objective, name: o.name } }));
    }
  }
  function spawnBarbarians(now) {
    const cfg=state.settings.barbarianSpawn||{}; if(cfg.enabled===false) return;
    const interval=Math.max(1,Number(cfg.intervalMinutes)||30)*60000;
    if(now-(state.lastBarbarianSpawn||state.createdAt||now)<interval) return;
    const spawned=Number(state.spawnedBarbarians||0), max=Math.max(0,Number(cfg.maxNewVillages)||20); if(spawned>=max) return;
    let amount=Math.min(Math.max(1,Number(cfg.perCycle)||1),max-spawned), tries=0;
    while(amount>0 && tries++<500){ const x=rand(mapMinX(),mapMaxX()),y=rand(mapMinY(),mapMaxY()); if(state.villages[id(x,y)]) continue; const v=makeVillage(x,y,null,state.settings); if(cfg.maximized) Object.entries(C.buildings).forEach(([k,b])=>v.buildings[k]=b.maxLevel); if(Math.random()*100 < (Number(cfg.bonusChance)||15)) v.bonusType=rollBonus(null,{...state.settings.bonus,chance:100}); state.villages[v.id]=v; amount--; state.spawnedBarbarians=(state.spawnedBarbarians||0)+1; }
    state.lastBarbarianSpawn=now;
  }
  function adminSpawnNow(){ if(!isAdmin()) return; const cfg=state.settings.barbarianSpawn||{}; state.lastBarbarianSpawn=Date.now()-(Math.max(1,Number(cfg.intervalMinutes)||30)*60000)-1; const before=state.spawnedBarbarians||0; spawnBarbarians(Date.now()); S.save(state); notify((state.spawnedBarbarians||0)>before?"Ciclo de nascimento executado.":"Nenhuma aldeia foi gerada: verifique limite, ativação e espaços vazios.",(state.spawnedBarbarians||0)>before?"success":"warning"); saveRender(); }
  function process(now, dt) {
    let changed = false;
    if (!state.paused) {
      // Processa economia e filas de TODAS as aldeias. Isso mantém bárbaras, bônus e inimigas
      // sob as mesmas regras de produção/construção do jogador.
      Object.values(state.villages).forEach((v) => {
        ["wood", "clay", "iron"].forEach(
          (r) =>
            (v.resources[r] = Math.min(
              cap(v),
              v.resources[r] + (prod(v, r) * dt * state.speed) / 60000,
            )),
        );
        if (v.buildQueue[0] && now >= v.buildQueue[0].end) {
          { const bk = v.buildQueue[0].building;
            v.buildings[bk] = Math.min(C.buildings[bk]?.maxLevel ?? Infinity, (v.buildings[bk] || 0) + 1); }
          v.buildQueue.shift();
          changed = true;
        }
        if (v.trainQueue[0]) {
          const q = v.trainQueue[0];
          q.trained = Math.max(0, Math.floor(q.trained || 0));
          q.unitDuration = q.unitDuration || ((unitTrainTime(q.unit, v) * 1000) / state.speed);
          q.nextAt = q.nextAt || (q.start || now) + q.unitDuration * (q.trained + 1);
          while (q.trained < q.amount && now >= q.nextAt) {
            v.units[q.unit] = (v.units[q.unit] || 0) + 1;
            q.trained += 1;
            q.nextAt += q.unitDuration;
            changed = true;
          }
          if (q.trained >= q.amount) v.trainQueue.shift();
        }
      });
      const due = state.movements.filter((m) => now >= m.end);
      state.movements = state.movements.filter((m) => now < m.end);
      if (due.length) changed = true;
      due.forEach((m) =>
        m.outbound
          ? (m.kind === "support" ? arriveSupport(m) : resolve(m))
          : Object.entries(m.units).forEach(([k, n]) => {
              const v = state.villages[m.fromId];
              if (v) v.units[k] = (v.units[k] || 0) + n;
            }),
      );
      spawnBarbarians(now);
      if (
        now - state.lastAiAction >
        (C.ai.actionIntervalSeconds * 1000) / state.speed
      )
        aiAction(now);
    }
    state.lastUpdate = now;
    return changed;
  }
  function saveRender() {
    S.save(state);
    window.dispatchEvent(new Event("game-update"));
  }
  let last = Date.now(),
    lastSave = Date.now();
  setInterval(() => {
    const n = Date.now(),
      changed = process(n, n - last);
    last = n;
    if (changed) {
      saveRender();
      lastSave = n;
    } else {
      if (n - lastSave >= (C.autosaveMs || 10000)) {
        S.save(state);
        lastSave = n;
      }
      window.dispatchEvent(new Event("game-tick"));
    }
  }, C.tickMs);
  function syncEnemies() {
    const desired = state.settings.enemiesEnabled ? Math.max(0, Math.floor(Number(state.settings.enemyCount) || 0)) : 0;
    let enemies = Object.values(state.villages).filter(v => v.owner === "enemy");
    while (enemies.length > desired) { enemies.pop().owner = null; }
    const free = Object.values(state.villages).filter(v => !v.owner);
    while (enemies.length < desired && free.length) {
      const v = free.splice(rand(0, free.length - 1), 1)[0];
      v.owner = "enemy"; v.name = `Inimigo ${enemies.length + 1}`; v.aiProfile = ["offensive","defensive","economic","expansive"][enemies.length%4]; v.aiId = `ai-${v.id}`;
      v.units.spear = Math.max(v.units.spear || 0, 80); v.units.axe = Math.max(v.units.axe || 0, 120);
      enemies.push(v);
    }
  }
  function adminCreateVillage(data) {
    const x = Math.max(mapMinX(), Math.min(mapMaxX(), Math.floor(Number(data.x))));
    const y = Math.max(mapMinY(), Math.min(mapMaxY(), Math.floor(Number(data.y))));
    if (state.villages[id(x,y)]) return notify("Já existe uma aldeia nessas coordenadas.", "warning");
    const v = makeVillage(x, y, data.owner || null, state.settings);
    v.name = String(data.name || `Aldeia ${x}|${y}`).trim().slice(0,40);
    v.bonusType = C.bonusTypes[data.bonusType] ? data.bonusType : "none";
    Object.keys(C.buildings).forEach(k => { if (data.buildings?.[k] !== undefined) v.buildings[k] = Math.max(0, Math.min(C.buildings[k].maxLevel, Math.floor(Number(data.buildings[k]) || 0))); });
    Object.keys(C.units).forEach(k => { if (data.units?.[k] !== undefined) v.units[k] = Math.max(0, Math.floor(Number(data.units[k]) || 0)); });
    ["wood","clay","iron"].forEach(r => { if (data.resources?.[r] !== undefined) v.resources[r] = Math.max(0, Number(data.resources[r]) || 0); });
    state.villages[v.id] = v; saveRender(); notify("Nova aldeia criada."); return v.id;
  }

  function adminCreateRandomVillages(data,count=1){ if(!isAdmin())return 0; let made=0,tries=0; const wanted=Math.max(1,Math.min(500,Number(count)||1)); while(made<wanted&&tries++<10000){const x=rand(mapMinX(),mapMaxX()),y=rand(mapMinY(),mapMaxY());if(state.villages[id(x,y)])continue;const v=makeVillage(x,y,data.owner||null,state.settings);v.name=`${String(data.name||"Nova aldeia").trim().slice(0,32)} ${made+1}`;v.bonusType=C.bonusTypes[data.bonusType]?data.bonusType:"none";Object.keys(C.buildings).forEach(k=>{if(data.buildings?.[k]!==undefined)v.buildings[k]=Math.max(0,Math.min(C.buildings[k].maxLevel,Math.floor(Number(data.buildings[k])||0)))});const fixed=clampAdminUnits(v,data.units||{});v.units=fixed.units;["wood","clay","iron"].forEach(r=>{if(data.resources?.[r]!==undefined)v.resources[r]=Math.max(0,Number(data.resources[r])||0)});if(v.owner==="enemy"){v.aiId=`ai-${v.id}`;v.aiProfile=["offensive","defensive","economic","expansive"][made%4];}state.villages[v.id]=v;made++;}S.save(state);saveRender();notify(`${made} aldeia(s) criada(s) em coordenadas aleatórias.`);return made;}
  function adminMaximizeSpawnCycle(){ if(!isAdmin())return; const cfg=state.settings.barbarianSpawn||{}; state.settings.barbarianSpawn={...cfg,maximized:true}; S.save(state); notify("Ciclo de aldeias ajustado para mundo maximizado."); saveRender();}
  function clampAdminUnits(v, desired) {
    const out={};
    Object.keys(C.units).forEach(k=>out[k]=Math.max(0,Math.floor(Number(desired?.[k] ?? v.units?.[k] ?? 0)||0)));
    // Filas já reservam população; edição administrativa não pode ignorá-las.
    const queued=(v.trainQueue||[]).reduce((n,q)=>n+(C.units[q.unit]?Math.max(0,(q.amount||0)-(q.trained||0))*C.units[q.unit].population:0),0);
    const available=Math.max(0,popCap(v)-buildingPopulation(v)-queued);
    const requested=Object.entries(out).reduce((n,[k,q])=>n+q*(C.units[k]?.population||0),0);
    const ratio=requested>available && requested>0 ? available/requested : 1;
    Object.keys(out).forEach(k=>{ out[k]=Math.floor(out[k]*ratio); if(C.units[k]?.limit) out[k]=Math.min(out[k],C.units[k].limit); });
    return {units:out, adjusted:ratio<1};
  }
  function adminUpdate(villageId, data) {
    const v = state.villages[villageId];
    if (!v) return;
    Object.keys(C.buildings).forEach((k) => {
      if (data.buildings?.[k] !== undefined)
        v.buildings[k] = Math.max(
          0,
          Math.min(
            C.buildings[k].maxLevel,
            Math.floor(Number(data.buildings[k]) || 0),
          ),
        );
    });
    if (data.units) {
      const fixed=clampAdminUnits(v,{...v.units,...data.units});
      v.units=fixed.units;
      if(fixed.adjusted) notify("Tropas ajustadas proporcionalmente ao limite real de população da aldeia.","warning");
    }
    ["wood", "clay", "iron"].forEach((r) => {
      if (data.resources?.[r] !== undefined)
        v.resources[r] = Math.max(
          0,
          Math.min(cap(v), Number(data.resources[r]) || 0),
        );
    });
    saveRender();
    notify("Valores administrativos atualizados.");
  }
  function adminIdentity(villageId, data) {
    const v = state.villages[villageId];
    if (!v) return;
    v.name =
      String(data.name || v.name)
        .trim()
        .slice(0, 40) || v.name;
    v.loyalty = Math.max(0, Math.min(100, Number(data.loyalty) || 0));
    v.owner = data.owner || null;
    if (C.bonusTypes[data.bonusType]) v.bonusType = data.bonusType;
    if (v.owner === "player" && !state.villages[state.activeVillageId]?.owner)
      state.activeVillageId = v.id;
    saveRender();
    notify("Identidade, posse e bônus atualizados.");
  }
  function adminFinishBuild(villageId, index = 0) {
    const v = state.villages[villageId], q = v?.buildQueue?.[index];
    if (!q) return notify("Nenhuma construção nessa posição.", "warning");
    v.buildings[q.building] = Math.min(C.buildings[q.building]?.maxLevel ?? Infinity, (v.buildings[q.building] || 0) + 1);
    v.buildQueue.splice(index, 1); saveRender(); notify("Construção finalizada pelo administrador.");
  }
  function adminFinishTraining(villageId, index = 0) {
    const v = state.villages[villageId], q = v?.trainQueue?.[index];
    if (!q) return notify("Nenhum treinamento nessa posição.", "warning");
    const remaining = Math.max(0, (q.amount || 0) - (q.trained || 0));
    v.units[q.unit] = (v.units[q.unit] || 0) + remaining;
    v.trainQueue.splice(index, 1); saveRender(); notify("Treinamento finalizado pelo administrador.");
  }
  function adminFinishAll(villageId) {
    const v = state.villages[villageId]; if (!v) return;
    while (v.buildQueue?.length) { const q=v.buildQueue.shift(); v.buildings[q.building]=Math.min(C.buildings[q.building]?.maxLevel ?? Infinity,(v.buildings[q.building]||0)+1); }
    (v.trainQueue || []).forEach(q => v.units[q.unit]=(v.units[q.unit]||0)+Math.max(0,(q.amount||0)-(q.trained||0)));
    v.trainQueue=[]; saveRender(); notify("Filas da aldeia finalizadas pelo administrador.");
  }
  function renameVillage(villageId, name) {
    const v = state.villages[villageId];
    if (!v || !isMine(v))
      return notify(
        "Somente aldeias em sua posse podem ser renomeadas.",
        "warning",
      );
    const clean = String(name || "")
      .trim()
      .slice(0, 40);
    if (!clean) return notify("Digite um nome válido.", "warning");
    v.name = clean;
    saveRender();
    notify("Aldeia renomeada.");
  }
  function ensureCurrentPlayer() {
    const sess=session(); if(!sess) return null;
    const pid=currentPlayerId();
    state.players = state.players || {};
    const previousPlayer = state.players[pid] || null;
    state.players[pid] = { ...(previousPlayer||{}), id:pid, username:sess.username, role:sess.role, lastSeen:Date.now() };
    let mine=Object.values(state.villages).filter(v=>v.owner==="player"&&v.ownerId===pid);
    if (mine.length) state.players[pid].hasStarted = true;
    // Jogador comum recebe aldeia somente na primeira entrada. Se perdeu todas, permanece derrotado
    // até escolher explicitamente reiniciar. O Admin nunca recebe aldeia automaticamente.
    if(!mine.length && sess.role==="player" && !state.players[pid].hasStarted) {
      const occupied=new Set(Object.keys(state.villages)); let spots=[];
      for(let y=mapMinY();y<=mapMaxY();y++) for(let x=mapMinX();x<=mapMaxX();x++) if(!occupied.has(id(x,y))) spots.push([x,y]);
      if(!spots.length) return notify("Não há espaço livre para uma nova aldeia.","danger");
      const [x,y]=spots[rand(0,spots.length-1)]; const v=makeVillage(x,y,"player",state.settings);
      v.ownerId=pid; v.name=`Aldeia de ${sess.username}`; v.buildings={...Object.fromEntries(Object.keys(C.buildings).map(k=>[k,0])),...clone(state.settings.initialBuildingLevels)};
      state.villages[v.id]=v; mine=[v]; state.players[pid].hasStarted=true;
      state.reports.unshift({id:`info-${Date.now()}`,time:Date.now(),type:"info",playerId:pid,title:"Bem-vindo ao mundo",text:`Sua aldeia inicial foi fundada em ${x}|${y}.`});
    }
    if(mine.length && (!state.villages[state.activeVillageId] || (!isAdmin() && !isMine(state.villages[state.activeVillageId])))) state.activeVillageId=mine[0].id;
    S.save(state); return mine[0]||null;
  }

  function restartCurrentPlayer() {
    const sess=session(); if(!sess || sess.role!=="player") return null;
    const pid=currentPlayerId();
    const occupied=new Set(Object.keys(state.villages)); let spots=[];
    for(let y=mapMinY();y<=mapMaxY();y++) for(let x=mapMinX();x<=mapMaxX();x++) if(!occupied.has(id(x,y))) spots.push([x,y]);
    if(!spots.length){ notify("Não há espaço livre para reiniciar neste mundo.","danger"); return null; }
    const [x,y]=spots[rand(0,spots.length-1)], v=makeVillage(x,y,"player",state.settings);
    v.ownerId=pid; v.name=`Aldeia de ${sess.username}`;
    v.buildings={...Object.fromEntries(Object.keys(C.buildings).map(k=>[k,0])),...clone(state.settings.initialBuildingLevels)};
    v.protectionUntil=Date.now()+Math.max(0,Number(state.settings.newPlayerProtectionHours)||0)*3600000; state.villages[v.id]=v; state.activeVillageId=v.id;
    state.players=state.players||{}; state.players[pid]={...(state.players[pid]||{}),id:pid,username:sess.username,role:sess.role,hasStarted:true,lastSeen:Date.now()};
    S.save(state); saveRender(); notify(`Nova aldeia fundada em ${x}|${y}.`,"success"); return v;
  }

  function withVillage(villageId, fn) {
    const old = state.activeVillageId;
    const v = state.villages[villageId];
    if (!v || !isMine(v)) return notify("Aldeia inválida ou sem permissão.", "warning");
    state.activeVillageId = villageId;
    try { return fn(); } finally { state.activeVillageId = old; S.save(state); }
  }
  function buildAt(villageId, building) { return withVillage(villageId, () => build(building)); }
  function recruitAt(villageId, unit, amount) { return withVillage(villageId, () => recruit(unit, amount)); }
  function adminBulkUpdate(ids, data) {
    if (!isAdmin()) return notify("Acesso restrito ao administrador.", "danger");
    const list = [...new Set(ids || [])].map(id => state.villages[id]).filter(Boolean);
    list.forEach(v => {
      Object.keys(C.buildings).forEach(k => { if (data.buildings?.[k] !== undefined) v.buildings[k] = Math.max(0, Math.min(C.buildings[k].maxLevel, Math.floor(Number(data.buildings[k]) || 0))); });
      if(data.units){ const fixed=clampAdminUnits(v,{...v.units,...data.units}); v.units=fixed.units; }
      ["wood","clay","iron"].forEach(r => { if (data.resources?.[r] !== undefined) { const raw=data.resources[r]; const value = typeof raw === "string" && raw.endsWith("%") ? cap(v)*(Number(raw.slice(0,-1))/100) : Number(raw); v.resources[r]=Math.max(0,Math.min(cap(v),value||0)); } });
      if (data.bonusType !== undefined && C.bonusTypes[data.bonusType]) v.bonusType=data.bonusType;
    });
    saveRender(); notify(`Alterações aplicadas a ${list.length} aldeia(s).`);
  }


  function bulkBuild(ids, building){ let ok=0; (ids||[]).forEach(vid=>{ const v=state.villages[vid]; if(!v||!isMine(v)||!C.buildings[building])return; const b=C.buildings[building]; if((v.buildings[building]||0)>=b.maxLevel||!meets(v,b.requires))return; const c=buildingCost(building,v); if(!canPay(v,c))return; const queueAllowed=!v.buildQueue.length||state.settings.unlimitedBuildQueue||(v.buildings.keep||0)>=10; if(!queueAllowed)return; pay(v,c); const start=v.buildQueue.length?v.buildQueue[v.buildQueue.length-1].end:Date.now(); v.buildQueue.push({building,start,end:start+(buildingTime(building,v)*1000)/state.speed}); ok++; }); saveRender(); notify(`Construção adicionada em ${ok} aldeia(s).`); }
  function bulkRecruitPreset(ids,preset){ let ok=0; (ids||[]).forEach(vid=>{ const v=state.villages[vid]; if(!v||!isMine(v))return; Object.entries(preset||{}).forEach(([k,w])=>{ if(!C.units[k]||w<=0||!meets(v,C.units[k].requires||{}))return; let max=Math.floor((popCap(v)-population(v))/C.units[k].population); for(const r of ["wood","clay","iron"]) max=Math.min(max,Math.floor(v.resources[r]/Math.max(1,unitCost(k,v)[r]))); const n=Math.max(0,Math.min(Math.floor(w),max)); if(n){ recruitAt(v.id,k,n); ok++; } }); }); notify(`Treinos adicionados (${ok} filas).`); }
  function adminBulkFinish(ids,what="all"){ if(!isAdmin())return; (ids||[]).forEach(vid=>{const v=state.villages[vid];if(!v)return;if(what!=="training")while(v.buildQueue?.length)adminFinishBuild(vid,0);if(what!=="build")while(v.trainQueue?.length)adminFinishTraining(vid,0);}); saveRender(); }
  function adminBulkOwner(ids,ownerId){ if(!isAdmin())return; (ids||[]).forEach(vid=>{const v=state.villages[vid];if(!v)return;if(ownerId==="barbarian"){v.owner=null;v.ownerId=null;}else if(String(ownerId).startsWith("ai:")){v.owner="enemy";v.ownerId=null;v.aiId=String(ownerId).slice(3); const src=Object.values(state.villages).find(x=>x.owner==="enemy"&&x.aiId===v.aiId); v.aiProfile=src?.aiProfile||v.aiProfile||"expansive";}else if(ownerId==="enemy"){v.owner="enemy";v.ownerId=null;v.aiId=v.aiId||`ai-${v.id}`;}else{v.owner="player";v.ownerId=ownerId;v.aiId=null;}});saveRender();notify("Proprietário atualizado em massa.");}

  window.Game = {
    ensureCurrentPlayer, restartCurrentPlayer, isMine, currentPlayerId, buildingPopulation, buildAt, recruitAt, adminBulkUpdate, bulkBuild, bulkRecruitPreset, adminBulkFinish, adminBulkOwner,
    get state() {
      return state;
    },
    active,
    owned,
    villageAt,
    cap,
    population,
    popCap,
    prod,
    points, maxVillagePoints, adminSpawnNow, adminMaximizeSpawnCycle,
    buildingPoints,
    buildingCost,
    buildingTime,
    unitCost,
    unitTrainTime,
    meets,
    estimate,
    travelInfo,
    build,
    recruit,
    sendAttack, sendSupport, withdrawSupport,
    markReportRead(id,read=true){const r=state.reports.find(x=>x.id===id);if(r){r.read=read;S.save(state);}},
    toggleReportFavorite(id){const r=state.reports.find(x=>x.id===id);if(r){r.favorite=!r.favorite;S.save(state);saveRender();}},
    deleteReports(ids){const set=new Set(ids);state.reports=state.reports.filter(r=>!set.has(r.id));saveRender();},
    deleteReport(id) { state.reports = state.reports.filter((r) => r.id !== id); saveRender(); },
    clearReports() { const pid=currentPlayerId(); state.reports = isAdmin() ? [] : state.reports.filter(r => !(r.recipients||[]).includes(pid) && r.playerId !== pid); saveRender(); },
    adminUpdate,
    adminIdentity,
    adminCreateVillage, adminCreateRandomVillages,
    adminFinishBuild, adminFinishTraining, adminFinishAll,
    syncEnemies,
    renameVillage,
    setActive(i) {
      if (isMine(state.villages[i])) {
        state.activeVillageId = i;
        saveRender();
      }
    },
    setObjective(key) {
      if (!C.objectives[key]) return;
      state.settings.objective = key;
      state.won = false;
      saveRender();
    },
    setSpeed(n) {
      state.speed = Number(n);
      saveRender();
    },
    togglePause() {
      state.paused = !state.paused;
      saveRender();
    },
    updateSettings(x) {
      state.settings = mergedSettings({
        ...state.settings,
        ...x,
        production: { ...state.settings.production, ...(x.production || {}) },
        bonus: { ...state.settings.bonus, ...(x.bonus || {}) },
        initialBuildingLevels: { ...state.settings.initialBuildingLevels, ...(x.initialBuildingLevels || {}) },
        freeStartingPointLevels: { ...state.settings.freeStartingPointLevels, ...(x.freeStartingPointLevels || {}) },
      });
      saveRender();
    },
    reset(options = {}) {
      S.clear();
      state = newState(options);
      saveRender();
    },
    export() {
      S.export(state);
    },
    async import(f) {
      state = migrate(await S.import(f));
      saveRender();
    },
  };
})();
