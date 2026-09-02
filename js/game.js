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
      freeVillagesTrainTroops: C.freeVillagesTrainTroops ?? false,
      freeVillageRules: clone(C.freeVillageRules || {barbariansBuild:true,barbariansRecruit:false,bonusBuild:true,bonusRecruit:false}),
      minimumAttackPopulation: C.combatRules?.minimumAttackPopulation ?? C.minimumAttackPopulation ?? 10,
      combatRules: clone(C.combatRules || {minimumAttackPopulation:10,nobleLoyaltyHitsPerCommand:1}),
      trainingRules: clone(C.trainingRules || {}),
      heroRules: clone(C.heroRules || {}),
      aiProfiles: clone(C.aiProfiles || {}),
      ai: clone(C.ai || { actionIntervalSeconds: 25 }),
      periodicResourceBonus: clone(C.periodicResourceBonus || {enabled:true,intervalMinutes:20,amount:1000,players:true,enemies:true,barbarians:true,bonusVillages:true}),
      unlimitedBuildQueue: C.unlimitedBuildQueue ?? false,
      enemiesEnabled: C.enemiesEnabled ?? true,
      minimumInitialEnemies: Math.max(5, Number(C.minimumInitialEnemies) || 5),
      enemyCount: Math.max(5, Number(C.enemyCount) || 5),
      barbarianSpawn: clone(C.barbarianSpawn || {enabled:true,intervalMinutes:30,maxNewVillages:20,perCycle:1,bonusChance:15,maximized:false}),
      enemyRules: clone(C.enemyRules || {}),
      buildingPresets: clone(C.buildingPresets || {halfRatio:.5,custom:null}),
      beginnerProtection: clone(C.beginnerProtection || {enabled:true,minutes:15}),
      marketServer: clone(C.marketServer || {enabled:true,capacityPerResource:600000,exchangeRate:1,regenerationMultiplier:1}),
      worldPreset: "classic",
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
      combatRules: { ...d.combatRules, ...(options.combatRules || {}) },
      trainingRules: { ...d.trainingRules, ...(options.trainingRules || {}) },
      heroRules: { ...d.heroRules, ...(options.heroRules || {}) },
      aiProfiles: { ...d.aiProfiles, ...(options.aiProfiles || {}) },
      ai: { ...d.ai, ...(options.ai || {}), actionIntervalSeconds: Number(options.ai?.actionIntervalSeconds ?? options.enemyRules?.actionIntervalSeconds ?? d.ai.actionIntervalSeconds) || 25 },
      periodicResourceBonus: { ...d.periodicResourceBonus, ...(options.periodicResourceBonus || {}) },
      beginnerProtection: { ...d.beginnerProtection, ...(options.beginnerProtection || {}) },
      marketServer: { ...d.marketServer, ...(options.marketServer || {}) },
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
      units: emptyUnits(),
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
      defeatedEnemies: [],
      achievements: {},
      market: { resources:{wood:600000,clay:600000,iron:600000}, lastUpdate:Date.now(), trades:0 },
      recurringAttacks: [],
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
    // Migração da configuração antiga que descontava 10 pontos do Principal inicial
    // (e fazia a aldeia aparecer com 18 em vez dos 28 pontos clássicos).
    const freePts = data.settings.freeStartingPointLevels || {};
    if (Number(data.settings.startingVillagePoints) === 28 && Number(freePts.keep) === 1 && Number(freePts.lumber||0) === 0 && Number(freePts.claypit||0) === 0 && Number(freePts.mine||0) === 0) {
      Object.keys(C.buildings).forEach(k => freePts[k] = 0);
      data.settings.freeStartingPointLevels = freePts;
    }
    // Todo mundo começa com o sistema de inimigos ativo e nunca com menos de 5 IAs.
    data.settings.enemiesEnabled = true;
    data.settings.minimumInitialEnemies = Math.max(5, Number(data.settings.minimumInitialEnemies) || 5);
    data.settings.enemyCount = Math.max(data.settings.minimumInitialEnemies, Number(data.settings.enemyCount) || 0);
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
    data.achievements = data.achievements || {};
    // Migração: marcos antigos por aldeia passam a usar o motor único de Conquistas.
    const legacyPointIds={100:"villagePoints100",500:"villagePoints500",1500:"villagePoints1500",3000:"villagePoints3000"};
    const legacyProgressIds={25:"villageProgress25",50:"villageProgress50",75:"villageProgress75",100:"villageProgress100"};
    Object.values(data.villages).forEach(v=>{
      const ownerKey=v.owner==="player"?(v.ownerId||"admin"):v.owner==="enemy"?(v.aiId||v.id):null; if(!ownerKey)return;
      const ast=data.achievements[ownerKey]||(data.achievements[ownerKey]={});
      Object.entries(v.claimedMilestones||{}).forEach(([k,when])=>{const m=k.match(/^points-\d+-(\d+)$/)||k.match(/^progress-\d+-(\d+)$/);if(!m)return;const aid=k.startsWith("points")?legacyPointIds[Number(m[1])]:legacyProgressIds[Number(m[1])];if(!aid)return;const root=ast[aid]||(ast[aid]={villages:{}});root.villages=root.villages||{};root.villages[v.id]={unlocked:true,claimed:true,pending:false,claimedAt:when||Date.now()};});
      Object.entries(v.pendingMilestones||{}).forEach(([k,val])=>{const m=k.match(/^points-\d+-(\d+)$/)||k.match(/^progress-\d+-(\d+)$/);if(!m)return;const aid=k.startsWith("points")?legacyPointIds[Number(m[1])]:legacyProgressIds[Number(m[1])];if(!aid)return;const root=ast[aid]||(ast[aid]={villages:{}});root.villages=root.villages||{};root.villages[v.id]={unlocked:true,claimed:false,pending:true,unlockedAt:val?.unlockedAt||Date.now()};});
      delete v.claimedMilestones; delete v.pendingMilestones;
    });
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
    data.market = data.market || {resources:{wood:600000,clay:600000,iron:600000},lastUpdate:Date.now(),trades:0};
    data.recurringAttacks = data.recurringAttacks || [];
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
    if (k === "statue") {
      const hr=state.settings.heroRules||C.heroRules||{};
      if ((!v.owner && hr.allowBarbarians!==true) || (v.bonusType !== "none" && hr.allowBonusVillages!==true)) return notify("A Estátua não pode ser construída em aldeias bárbaras ou bônus.", "warning");
      const key=combatKey(v), own=Object.values(state.villages).filter(x=>combatKey(x)===key).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0) || String(a.id).localeCompare(String(b.id)));
      if (hr.statueOnlyFirstVillage!==false && own[0]?.id !== v.id) return notify("A Estátua só pode ser construída na primeira aldeia do jogador.", "warning");
    }
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
    const bst=combatStat(combatKey(v)); if(bst)bst.buildingLevelsBuilt=(bst.buildingLevelsBuilt||0)+1;
    saveRender();
  }
  function trainingFacility(k) {
    const req=C.units[k]?.requires||{};
    if (k === "noble") return "academy";
    if (k === "ram" || k === "catapult") return "workshop";
    if (["scout","light","mounted","heavy","paladin"].includes(k)) return k === "paladin" ? "statue" : "stable";
    return "barracks";
  }
  function enqueueRecruit(v,k,amount,now=Date.now()) {
    const u=C.units[k]; amount=Math.max(1,Math.floor(Number(amount)||0)); if(!v||!u||!meets(v,u.requires||{})) return false;
    if(population(v)+u.population*amount>popCap(v)) return false;
    const each=unitCost(k,v), cost=Object.fromEntries(Object.entries(each).map(([r,n])=>[r,n*amount])); if(!canPay(v,cost)) return false;
    pay(v,cost); const duration=(unitTrainTime(k,v)*1000)/state.speed, facility=trainingFacility(k);
    const same=v.trainQueue.filter(q=>(q.facility||trainingFacility(q.unit))===facility); const start=same.length?Math.max(now,same.at(-1).end||now):now;
    v.trainQueue.push({unit:k,facility,amount,trained:0,start,nextAt:start+duration,end:start+duration*amount,unitDuration:duration}); return true;
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
    if (k === "paladin") {
      const hr=state.settings.heroRules||C.heroRules||{}; if ((!v.owner && hr.allowBarbarians!==true) || (v.bonusType!=="none" && hr.allowBonusVillages!==true)) return notify("Bárbaras e aldeias bônus não podem criar Herói.", "warning");
      const key=combatKey(v), total=Object.values(state.villages).filter(x=>combatKey(x)===key).reduce((n,x)=>n+(x.units.paladin||0)+(x.trainQueue||[]).filter(q=>q.unit==="paladin").reduce((a,q)=>a+Math.max(0,(q.amount||0)-(q.trained||0)),0),0);
      if (total + amount > Math.max(1,Number(hr.maxPerOwner)||1)) return notify(`É permitido apenas ${Math.max(1,Number(hr.maxPerOwner)||1)} Herói por jogador.`, "warning");
    }
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
    if (!enqueueRecruit(v,k,amount)) return notify("Não foi possível adicionar o treinamento.", "warning");
    const rst=combatStat(combatKey(v)); if(rst)rst.unitsRecruited=(rst.unitsRecruited||0)+amount;
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
  function scheduleAttack(targetId, units, whenMs, mode = "arrival", catapultTarget = null) {
    const from=active(), target=state.villages[targetId];
    if(!from||!target) return notify("Origem ou destino inválido.","warning");
    if(isMine(target)) return notify("Não é possível atacar uma aldeia em sua posse.","warning");
    const sent=Object.fromEntries(Object.entries(units).filter(([k])=>C.units[k]).map(([k,n])=>[k,Math.max(0,Math.floor(Number(n)||0))]).filter(([,n])=>n));
    if(!Object.keys(sent).length) return notify("Escolha pelo menos uma unidade.","warning");
    if(Object.entries(sent).some(([k,n])=>(from.units[k]||0)<n)) return notify("Quantidade inválida ou já reservada.","danger");
    const pop=Object.entries(sent).reduce((sum,[k,n])=>sum+n*(C.units[k]?.population||0),0), min=Math.max(1,Number(state.settings.minimumAttackPopulation??C.minimumAttackPopulation??10));
    if(pop<min) return notify(`Ataques exigem no mínimo ${min} de população militar.`,"warning");
    const info=travelInfo(target.id,sent), travelMs=info.seconds*1000, chosen=Number(whenMs)||0;
    const departAt=mode==="departure"?chosen:chosen-travelMs, arriveAt=mode==="departure"?chosen+travelMs:chosen;
    if(departAt<=Date.now()+500) return notify("O horário escolhido não permite preparar este ataque.","warning");
    Object.entries(sent).forEach(([k,n])=>from.units[k]-=n); // reserva real
    state.movements.push({id:`scheduled-${Date.now()}-${Math.random()}`,kind:"scheduledAttack",fromId:from.id,targetId:target.id,units:sent,catapultTarget,outbound:true,scheduled:true,departAt,end:arriveAt,travelMs});
    saveRender(); notify("Ataque agendado. As tropas ficaram reservadas.","success"); return true;
  }
  function scheduleAttackFrom(fromId,targetId,units,whenMs,mode="arrival",catapultTarget=null){
    const from=state.villages[fromId], target=state.villages[targetId]; if(!from||!isMine(from)||!target)return false;
    const sent=Object.fromEntries(Object.entries(units).filter(([k])=>C.units[k]).map(([k,n])=>[k,Math.max(0,Math.floor(Number(n)||0))]).filter(([,n])=>n));
    if(!Object.keys(sent).length||Object.entries(sent).some(([k,n])=>(from.units[k]||0)<n))return false;
    const pop=Object.entries(sent).reduce((z,[k,n])=>z+n*(C.units[k]?.population||0),0),min=Math.max(1,Number(state.settings.minimumAttackPopulation??10)); if(pop<min)return false;
    const dist=Math.hypot(target.x-from.x,target.y-from.y), slow=Math.max(...Object.keys(sent).map(k=>C.units[k]?.speed||1)), travelMs=Math.max(1000,dist*state.settings.travelSecondsPerTile*slow*1000/state.speed);
    const chosen=Number(whenMs)||0,departAt=mode==="departure"?chosen:chosen-travelMs,arriveAt=mode==="departure"?chosen+travelMs:chosen;if(departAt<=Date.now()+500)return false;
    Object.entries(sent).forEach(([k,n])=>from.units[k]-=n);state.movements.push({id:`scheduled-${Date.now()}-${Math.random()}`,kind:"scheduledAttack",fromId,targetId,units:sent,catapultTarget,outbound:true,scheduled:true,departAt,end:arriveAt,travelMs});return true;
  }
  function cancelScheduled(id){
    const i=state.movements.findIndex(m=>m.id===id&&m.scheduled); if(i<0)return;
    const m=state.movements[i], from=state.villages[m.fromId];
    if(from) Object.entries(m.units||{}).forEach(([k,n])=>from.units[k]=(from.units[k]||0)+n);
    state.movements.splice(i,1); saveRender(); notify("Agendamento cancelado; tropas liberadas.");
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
    const sentPopulation = Object.entries(sent).reduce((sum,[k,n])=>sum+n*(C.units[k]?.population||0),0);
    const minimumPopulation = Math.max(1, Number(state.settings.minimumAttackPopulation ?? C.minimumAttackPopulation ?? 10));
    if (sentPopulation < minimumPopulation) return notify(`Ataques exigem no mínimo ${minimumPopulation} de população militar. Este comando possui ${sentPopulation}.`, "warning");
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
  function combatStat(key){ if(!key) return null; return state.combatStats[key]||(state.combatStats[key]={attackerPoints:0,defenderPoints:0,conquests:0,enemyPopulationDefeated:0,villagesPlundered:0,resourcesPlundered:0,uniqueEnemiesAttacked:[],catapultLevelsDestroyed:0,wallLevelsDestroyed:0,noblesDefeated:0,armiesDestroyed:0,buildingLevelsBuilt:0,unitsRecruited:0,marketTrades:0}); }
  function unitLossScore(units){ return Object.entries(units||{}).reduce((n,[k,q])=>n+q*(C.units[k]?.population||1),0); }
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
    // Preserve ownership before combat/conquest mutates the target. These values
    // are also used to route reports to the correct human player.
    const defenderOwnerBefore = target.owner || null;
    const defenderOwnerIdBefore = target.ownerId || null;
    const defenderAiIdBefore = target.aiId || (defenderOwnerBefore === "enemy" ? `ai-${target.id}` : null);
    const attackerOwnerBefore = from.owner || null;
    const attackerOwnerIdBefore = from.ownerId || null;
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
    if(ast){ ast.attackerPoints += Math.round(unitLossScore(defLosses)); ast.enemyPopulationDefeated=(ast.enemyPopulationDefeated||0)+unitLossScore(defLosses); ast.noblesDefeated=(ast.noblesDefeated||0)+(defLosses.noble||0); ast.uniqueEnemiesAttacked=ast.uniqueEnemiesAttacked||[]; if(defenderKey&&!ast.uniqueEnemiesAttacked.includes(defenderKey))ast.uniqueEnemiesAttacked.push(defenderKey); if(Object.values(target.units).every(q=>!q))ast.armiesDestroyed=(ast.armiesDestroyed||0)+1; }
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
      if(ast)ast.villagesPlundered=(ast.villagesPlundered||0)+1;
      ["wood", "clay", "iron"].forEach((r) => {
        loot[r] = Math.min(target.resources[r], Math.floor(capacity / 3));
        target.resources[r] -= loot[r];
        from.resources[r] = Math.min(cap(from), from.resources[r] + loot[r]); if(ast)ast.resourcesPlundered=(ast.resourcesPlundered||0)+loot[r];
      });
      if ((attackBefore.ram || 0) > 0) {
        const before = target.buildings.wall || 0,
          damage = Math.max(1, Math.floor(attackBefore.ram / 20));
        target.buildings.wall = Math.max(0, before - damage);
        siege.ram = { building: "wall", before, after: target.buildings.wall, levelsDestroyed: before - target.buildings.wall, sent: attackBefore.ram }; if(ast)ast.wallLevelsDestroyed=(ast.wallLevelsDestroyed||0)+(before-target.buildings.wall);
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
          siege.catapult = { building: chosen, before, after: target.buildings[chosen], levelsDestroyed: before - target.buildings[chosen], sent: attackBefore.catapult }; if(ast)ast.catapultLevelsDestroyed=(ast.catapultLevelsDestroyed||0)+(before-target.buildings[chosen]);
        }
      }
      if ((survivors.noble || 0) > 0) {
        // Cada nobre sobrevivente reduz entre os limites configurados.
        // O padrão é 25–35, portanto um único nobre normalmente exige cerca de 4 ataques.
        // Um comando, independentemente da quantidade de Nobres, causa apenas
        // uma redução de lealdade. Reduções múltiplas exigem comandos separados.
        if (target.loyalty > 0) loyaltyDamage = rand(...C.conquestLoyaltyDamage);
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
          // Um inimigo só é considerado derrotado quando perde sua última aldeia.
          if (from.owner === "player" && defenderOwnerBefore === "enemy" && defenderAiIdBefore) {
            const stillAlive = Object.values(state.villages).some(v => v.owner === "enemy" && (v.aiId || `ai-${v.id}`) === defenderAiIdBefore);
            if (!stillAlive) {
              state.defeatedEnemies ||= [];
              if (!state.defeatedEnemies.includes(defenderAiIdBefore)) state.defeatedEnemies.push(defenderAiIdBefore);
            }
          }
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
    const reportRecipients = [...new Set([attackerOwnerBefore === "player" ? attackerOwnerIdBefore : null, defenderOwnerBefore === "player" ? defenderOwnerIdBefore : null].filter(Boolean))];
    const playerInvolved = reportRecipients.length > 0;
    if (playerInvolved) state.reports.unshift({
      recipients: reportRecipients,
      id: `rpt-${Date.now()}-${Math.random()}`,
      time: Date.now(),
      type: win ? "win" : "loss",
      victory: win,
      attackerPlayerId: attackerOwnerBefore === "player" ? attackerOwnerIdBefore : null,
      defenderPlayerId: defenderOwnerBefore === "player" ? defenderOwnerIdBefore : null,
      attacker,
      defender,
      defenderBonus,
      targetId: target.id, fromId: from.id,
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
      const profile=v.aiProfile||"economic"; const profileCfg=(state.settings.aiProfiles||C.aiProfiles||{})[profile]||{}; const choices = profileCfg.buildPriority || ["lumber","claypit","mine","farm","storage","keep","market","barracks","smithy","academy"];
      const erLocal=state.settings.enemyRules||{}, isEnemy=v.owner==="enemy"; if(isEnemy){ const drec=state.aiDiagnostics[v.aiId||v.id]||(state.aiDiagnostics[v.aiId||v.id]={}); drec.lastSeen=now; drec.status=(v.buildQueue||[]).length?"Construindo":(v.trainQueue||[]).length?"Recrutando":population(v)>=popCap(v)?"Fazenda cheia":"Economia/evolução"; drec.villageId=v.id; }
      const freeRules=state.settings.freeVillageRules||{}; const isBonus=!v.owner&&v.bonusType&&v.bonusType!=="none"; const freeCanBuild=isEnemy ? erLocal.canBuild!==false : (isBonus ? freeRules.bonusBuild!==false : freeRules.barbariansBuild!==false); const freeCanRecruit=isEnemy ? erLocal.canRecruitTroops!==false : (isBonus ? freeRules.bonusRecruit===true : freeRules.barbariansRecruit===true);
      if (freeCanBuild && !(v.buildQueue || []).length && Math.random() < (isEnemy ? 0.62 : 0.28) * d.aiGrowth) {
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
      if (freeCanRecruit && Math.random() < 0.55 * d.aiGrowth) {
        // A IA recompõe o exército com todas as classes que já desbloqueou.
        // Expansivas/Ofensivas também passam a formar Nobres quando a Academia e os recursos permitem.
        const presetName=profileCfg.preset || (profile==="defensive"?"defenseTroops":["offensive","expansive"].includes(profile)?"attackNoblesTroops":"economicTroops");
        const targetPreset = {...(C.adminPresets[presetName]||C.adminPresets.economicTroops||{})};
        if(profileCfg.maxScouts!=null) targetPreset.scout=Math.min(Number(targetPreset.scout)||0,Number(profileCfg.maxScouts)||0);
        if(profileCfg.nobleTarget!=null && erLocal.canRecruitNobles!==false) targetPreset.noble=Math.max(Number(targetPreset.noble)||0,Number(profileCfg.nobleTarget)||0);
        const pools = Object.keys(targetPreset);
        const options = pools.filter(k => (v.units[k]||0) < (targetPreset[k]||0) && C.units[k] && (!isEnemy || k!=="noble" || erLocal.canRecruitNobles!==false) && (!isEnemy || !["ram","catapult"].includes(k) || erLocal.canUseSiege!==false) && meets(v, C.units[k].requires || {}) && population(v) + C.units[k].population <= popCap(v) && canPay(v, unitCost(k, v)));
        if (options.length) {
          // Prioriza um Nobre quando pode conquistar e ainda não possui um disponível.
          const er = state.settings.enemyRules || {};
          let k = options.includes("noble") && er.canConquer !== false && (v.units.noble || 0) < 1 ? "noble" : options.sort((a,b)=>((targetPreset[b]||0)-(v.units[b]||0))-((targetPreset[a]||0)-(v.units[a]||0)))[0];
          const cost = unitCost(k, v), room = Math.floor((popCap(v)-population(v))/Math.max(1,C.units[k].population));
          const deficit=Math.max(0,(targetPreset[k]||0)-(v.units[k]||0));
          let batch = k === "noble" ? 1 : Math.max(1, Math.min(Number(erLocal.recruitmentBatch)||20, room, deficit));
          for (const r of ["wood","clay","iron"]) batch = Math.min(batch, Math.floor(v.resources[r]/Math.max(1,cost[r])));
          batch = Math.max(0,batch);
          if (batch) enqueueRecruit(v,k,batch,now);
        }
      }
    });
    if (state.settings.enemiesEnabled) {
      Object.values(state.villages).filter(v => v.owner === "enemy").forEach(from => {
        const profile=from.aiProfile||"offensive"; const profileCfg=(state.settings.aiProfiles||C.aiProfiles||{})[profile]||{}; const attackRate=Number(profileCfg.attackRate ?? (profile==="offensive"?.32:profile==="expansive"?.22:profile==="defensive"?.08:.12)); if (Math.random() > attackRate * d.aiGrowth) return;
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
  function villageProgressPercent(v){ const max=Math.max(1,maxVillagePoints()); return Math.max(0,Math.min(100,(points(v)/max)*100)); }
  function achievementProgress(a, key=currentPlayerId(), villageId=null) {
    const villages=Object.values(state.villages).filter(v=>combatKey(v)===key);
    if(a.repeat==="perVillage"){
      const v=state.villages[villageId]; if(!v || combatKey(v)!==key) return 0;
      if(a.type==="villagePoints") return points(v);
      if(a.type==="villageProgress") return villageProgressPercent(v);
      return 0;
    }
    if(a.type==="points") return villages.reduce((n,v)=>n+points(v),0);
    if(a.type==="conquests") return state.combatStats?.[key]?.conquests||0;
    if(a.type==="hero") return villages.reduce((n,v)=>n+(v.units.paladin||0),0);
    if(a.type==="nobles") return villages.reduce((n,v)=>n+(v.units.noble||0),0);
    const cs=state.combatStats?.[key]||{};
    if(a.type==="uniqueEnemiesAttacked") return (cs.uniqueEnemiesAttacked||[]).length;
    if(["enemyPopulationDefeated","villagesPlundered","resourcesPlundered","catapultLevelsDestroyed","wallLevelsDestroyed","noblesDefeated","armiesDestroyed","buildingLevelsBuilt","unitsRecruited","marketTrades"].includes(a.type)) return Number(cs[a.type])||0;
    return 0;
  }
  function achievementState(key=currentPlayerId()){ return state.achievements[key]||(state.achievements[key]={}); }
  function achievementEntry(a,key,villageId=null){
    const st=achievementState(key);
    if(a.repeat==="perVillage"){
      st[a.id]=st[a.id]||{villages:{}}; st[a.id].villages=st[a.id].villages||{};
      return st[a.id].villages[villageId]||(st[a.id].villages[villageId]={});
    }
    return st[a.id]||(st[a.id]={});
  }
  function refreshAchievements(key=currentPlayerId()){
    if(!key) return;
    const villages=Object.values(state.villages).filter(v=>combatKey(v)===key);
    (C.achievements||[]).forEach(a=>{
      if(a.repeat==="perVillage") villages.forEach(v=>{const e=achievementEntry(a,key,v.id);if(!e.claimed&&achievementProgress(a,key,v.id)>=a.target&&!e.unlocked){e.unlocked=true;e.unlockedAt=Date.now();if(key===currentPlayerId())window.dispatchEvent(new CustomEvent("achievement-unlocked",{detail:{name:a.name,village:v.name}}));}});
      else {const e=achievementEntry(a,key);if(!e.claimed&&achievementProgress(a,key)>=a.target&&!e.unlocked){e.unlocked=true;e.unlockedAt=Date.now();if(key===currentPlayerId())window.dispatchEvent(new CustomEvent("achievement-unlocked",{detail:{name:a.name}}));}}
    });
  }
  function canApplyReward(v,reward){
    if(reward.storagePercent){ const add=cap(v)*reward.storagePercent/100; if(["wood","clay","iron"].some(r=>v.resources[r]+add>cap(v))) return false; }
    const troops=reward.troops||{}; const nobleQty=(reward.noble||0)+(troops.noble||0); if(nobleQty>0 && (v.buildings.academy||0)<1)return false;
    const pop=Object.entries(troops).reduce((n,[k,q])=>n+(C.units[k]?.population||0)*q,0)+(reward.noble||0)*(C.units.noble?.population||0);
    return population(v)+pop<=popCap(v);
  }
  function claimAchievement(id,key=currentPlayerId(),villageId=null){
    refreshAchievements(key); const a=(C.achievements||[]).find(x=>x.id===id); if(!a)return false;
    const entry=achievementEntry(a,key,villageId); if(!entry.unlocked||entry.claimed)return false;
    let villages=Object.values(state.villages).filter(v=>combatKey(v)===key), r=a.reward||{}, targets;
    if(a.repeat==="perVillage") { const v=state.villages[villageId]; targets=v&&combatKey(v)===key?[v]:[]; }
    else targets=r.scope==="active"?[active()].filter(v=>v&&combatKey(v)===key):villages;
    if(r.noblePerAcademy){targets=villages.filter(v=>(v.buildings.academy||0)>0); r={...r,noble:r.noblePerAcademy};}
    if(r.nobleTopAcademies){targets=villages.filter(v=>(v.buildings.academy||0)>0).sort((a,b)=>points(b)-points(a)).slice(0,r.academyCount||10); r={...r,noble:r.nobleTopAcademies};}
    if(r.roleTroops) targets=villages;
    const activeNobleTarget=r.nobleActive ? ([active()].filter(v=>v&&combatKey(v)===key&&(v.buildings.academy||0)>0)[0] || villages.find(v=>(v.buildings.academy||0)>0)) : null;
    if(r.nobleActive && (!activeNobleTarget || population(activeNobleTarget)+(C.units.noble?.population||0)*r.nobleActive>popCap(activeNobleTarget))){entry.pending=true;saveRender();return false;}
    if(!targets.length){entry.pending=true;saveRender();return false;}
    for(const v of targets){let rr={...r};if(r.roleTroops){const role=v.armyRole||"attack";rr.troops=role==="defense"?{spear:3000,sword:3000,archer:3000}:{axe:3000,light:2000,noble:3};}if(!canApplyReward(v,rr)){entry.pending=true;saveRender();return false;}}
    targets.forEach(v=>{let rr={...r};if(r.roleTroops){const role=v.armyRole||"attack";rr.troops=role==="defense"?{spear:3000,sword:3000,archer:3000}:{axe:3000,light:2000,noble:3};}if(rr.storagePercent){const add=cap(v)*rr.storagePercent/100;["wood","clay","iron"].forEach(x=>v.resources[x]=Math.min(cap(v),v.resources[x]+add));}if(rr.noble)v.units.noble=(v.units.noble||0)+rr.noble;Object.entries(rr.troops||{}).forEach(([k,q])=>v.units[k]=(v.units[k]||0)+q);});
    if(r.nobleActive) activeNobleTarget.units.noble=(activeNobleTarget.units.noble||0)+Number(r.nobleActive||0);
    Object.assign(entry,{unlocked:true,claimed:true,pending:false,claimedAt:Date.now()});saveRender();return true;
  }
  function checkVictory() {
    const vr=state.settings.victoryRules||{}, o = vr.enabled===false ? {type:"none",target:Infinity,name:"Sem condição de vitória"} : (vr.type ? {type:vr.type,target:Number(vr.target)||10,name:`${vr.type}: ${vr.target}`} : (C.objectives[state.settings.objective] || C.objectives.villages10)),
      count = owned().length,
      total = Object.keys(state.villages).length,
      won =
        o.type === "none" ? false : o.type === "last" ? [...new Set(Object.values(state.villages).filter(v=>v.owner==="player"||v.owner==="enemy").map(v=>v.owner==="enemy"?(v.aiId||v.id):(v.ownerId||v.id)))].length<=1 : o.type === "points" ? owned().reduce((n,v)=>n+points(v),0)>=o.target : o.type === "enemiesDefeated"
          ? (state.defeatedEnemies||[]).length >= o.target
          : o.type === "allEnemiesDefeated"
            ? (state.defeatedEnemies||[]).length > 0 && !Object.values(state.villages).some(v=>v.owner==="enemy")
          : o.type === "conquests"
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

  function simulateCombat(attUnits,defUnits,wall=0,catapultTarget=null){
    const original=state;try{state=clone(original);const a=makeVillage(mapMinX(),mapMinY(),"player",state.settings),d=makeVillage(mapMinX()+1,mapMinY(),"enemy",state.settings);a.id="__sim_a";d.id="__sim_d";a.ownerId=currentPlayerId();a.units={...emptyUnits(),...clone(attUnits||{})};d.units={...emptyUnits(),...clone(defUnits||{})};d.buildings.wall=Math.max(0,Math.min(20,Number(wall)||0));d.resources={wood:0,clay:0,iron:0};state.villages[a.id]=a;state.villages[d.id]=d;const before=state.reports.length;resolve({id:"__sim",kind:"attack",fromId:a.id,targetId:d.id,units:clone(a.units),catapultTarget,outbound:true,start:Date.now(),end:Date.now()});const report=state.reports[0];return report&&state.reports.length>before?clone(report):null;}finally{state=original;}
  }
  function updateMarket(now=Date.now()){
    const cfg=state.settings.marketServer||C.marketServer||{}; if(cfg.enabled===false)return;
    state.market=state.market||{resources:{wood:0,clay:0,iron:0},lastUpdate:now,trades:0};
    const elapsed=Math.max(0,(now-(state.market.lastUpdate||now))/1000); if(!elapsed)return;
    const villages=Object.values(state.villages), avg={wood:0,clay:0,iron:0};
    ["wood","clay","iron"].forEach(r=>{avg[r]=villages.length?villages.reduce((n,v)=>n+prod(v,r),0)/villages.length:0;});
    const max=Number(cfg.capacityPerResource)||600000,m=Number(cfg.regenerationMultiplier)||1;
    ["wood","clay","iron"].forEach(r=>state.market.resources[r]=Math.min(max,(state.market.resources[r]||0)+avg[r]/60*elapsed*m)); state.market.lastUpdate=now;
  }
  function marketExchange(give,take,amount){
    updateMarket(); const v=active(),cfg=state.settings.marketServer||C.marketServer||{},n=Math.floor(Number(amount)||0),rate=Number(cfg.exchangeRate)||1,receive=Math.floor(n*rate);
    if(!v||!["wood","clay","iron"].includes(give)||!["wood","clay","iron"].includes(take)||give===take||n<=0)return {ok:false,msg:"Informe uma troca válida."};
    if((v.resources[give]||0)<n)return {ok:false,msg:"Recursos insuficientes na aldeia."}; if((state.market.resources[take]||0)<receive)return {ok:false,msg:"O Mercado não possui estoque suficiente."}; if((v.resources[take]||0)+receive>cap(v))return {ok:false,msg:"O Armazém não possui espaço para receber a troca."};
    v.resources[give]-=n;v.resources[take]+=receive;state.market.resources[give]=Math.min(Number(cfg.capacityPerResource)||600000,(state.market.resources[give]||0)+n);state.market.resources[take]-=receive;state.market.trades=(state.market.trades||0)+1;const st=combatStat(currentPlayerId());if(st)st.marketTrades=(st.marketTrades||0)+1;S.save(state);refreshAchievements();return {ok:true,receive};
  }
  function createRecurringAttack(o){
    const origins=(o.origins||[]).filter(id=>isMine(state.villages[id])),targets=(o.targets||[]).filter(id=>state.villages[id]); if(!origins.length||!targets.length)return false;
    const interval=Math.max((C.recurringAttacks?.minimumIntervalSeconds||60)*1000,Number(o.intervalMs)||300000),duration=Number(o.durationMs)||0,now=Date.now();state.recurringAttacks.push({id:`rec-${now}-${Math.random()}`,ownerId:currentPlayerId(),origins,targets,units:clone(o.units||{}),intervalMs:interval,startAt:now,endAt:duration?now+duration:0,nextAt:now,status:"active",attempts:0,sent:0,failed:0,history:[]});S.save(state);return true;
  }
  function toggleRecurringAttack(id,action){const x=state.recurringAttacks.find(x=>x.id===id&&x.ownerId===currentPlayerId());if(!x)return;if(action==="cancel")x.status="cancelled";else if(action==="pause")x.status="paused";else if(action==="resume"){x.status="active";x.nextAt=Date.now();}S.save(state);}
  function processRecurring(now){(state.recurringAttacks||[]).forEach(x=>{if(x.status!=="active"||now<x.nextAt)return;if(x.endAt&&now>x.endAt){x.status="finished";return;}x.attempts++;let cycleSent=0;x.origins.forEach(oid=>{const from=state.villages[oid];if(!from||!isMine(from))return;x.targets.forEach(tid=>{const enough=Object.entries(x.units).every(([k,q])=>(from.units[k]||0)>=q);if(!enough){x.failed++;x.history.unshift({time:now,origin:oid,target:tid,status:"failed",reason:"Tropas insuficientes"});return;}if(scheduleAttackFrom(oid,tid,x.units,now+1000,"departure")){x.sent++;cycleSent++;x.history.unshift({time:now,origin:oid,target:tid,status:"sent"});}else{x.failed++;x.history.unshift({time:now,origin:oid,target:tid,status:"failed",reason:"Comando não pôde ser enviado"});}});});x.nextAt+=x.intervalMs;if(x.endAt&&x.nextAt>x.endAt)x.status="finished";x.history=x.history.slice(0,50);});}
  function process(now, dt) {
    let changed = false;
    if (!state.paused) {
      updateMarket(now);
      processRecurring(now);
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
        // Filas independentes por edifício militar; somente o primeiro lote de
        // cada edifício é processado, e as unidades são liberadas uma a uma.
        const facilities = ["barracks","stable","workshop","academy","statue"];
        facilities.forEach(facility => {
          const q = v.trainQueue.find(x => (x.facility || trainingFacility(x.unit)) === facility);
          if (!q) return;
          q.facility = facility;
          q.trained = Math.max(0, Math.floor(q.trained || 0));
          q.unitDuration = q.unitDuration || ((unitTrainTime(q.unit, v) * 1000) / state.speed);
          q.nextAt = q.nextAt || (q.start || now) + q.unitDuration * (q.trained + 1);
          while (q.trained < q.amount && now >= q.nextAt) {
            v.units[q.unit] = (v.units[q.unit] || 0) + 1;
            q.trained += 1; q.nextAt += q.unitDuration; changed = true;
          }
          if (q.trained >= q.amount) v.trainQueue.splice(v.trainQueue.indexOf(q),1);
        });
      });
      { const br=state.settings.periodicResourceBonus||C.periodicResourceBonus||{}; const interval=Math.max(1,Number(br.intervalMinutes)||20)*60000;
        if(br.enabled!==false && (!state.lastPeriodicResourceBonus || now-state.lastPeriodicResourceBonus>=interval)){
          Object.values(state.villages).forEach(v=>{ const isBonus=!v.owner&&v.bonusType&&v.bonusType!=="none"; const eligible=v.owner==="player"?br.players!==false:v.owner==="enemy"?br.enemies!==false:isBonus?br.bonusVillages!==false:br.barbarians!==false; if(!eligible)return; ["wood","clay","iron"].forEach(r=>v.resources[r]=Math.min(cap(v),Number(v.resources[r]||0)+(Number(br.amount)||1000))); });
          state.lastPeriodicResourceBonus=now; changed=true;
        } }
      state.movements.forEach(m=>{ if(m.scheduled && now>=m.departAt){ m.scheduled=false; m.kind="attack"; m.start=m.departAt; } });
      const due = state.movements.filter((m) => !m.scheduled && now >= m.end);
      state.movements = state.movements.filter((m) => m.scheduled || now < m.end);
      if (due.length) changed = true;
      due.forEach((m) => {
        try {
          if (m.outbound) {
            if (m.kind === "support") arriveSupport(m);
            else resolve(m);
          } else {
            Object.entries(m.units || {}).forEach(([k, n]) => {
              const v = state.villages[m.fromId];
              if (v) v.units[k] = (v.units[k] || 0) + n;
            });
          }
        } catch (err) {
          // Never make troops disappear because of a resolution error. Keep the
          // command queued and retry on the next cycle, while logging diagnostics.
          console.error("Falha ao processar comando", m, err);
          m.end = now + 1500;
          state.movements.push(m);
        }
      });
      spawnBarbarians(now);
      if (
        now - state.lastAiAction >
        ((Number(state.settings.ai?.actionIntervalSeconds)||C.ai.actionIntervalSeconds) * 1000) / state.speed
      )
        aiAction(now);
    }
    refreshAchievements();
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
      // Mudanças automáticas do mundo não podem reconstruir a interface.
      S.save(state);
      window.dispatchEvent(new Event("game-tick"));
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
    const minimum = Math.max(5, Number(state.settings.minimumInitialEnemies ?? C.minimumInitialEnemies) || 5);
    const desired = Math.max(minimum, Math.floor(Number(state.settings.enemyCount) || minimum));
    state.settings.enemiesEnabled = true;
    state.settings.enemyCount = desired;

    // enemyCount representa IAs (identidades), não o total de aldeias que elas conquistaram.
    const enemyVillages = Object.values(state.villages).filter(v => v.owner === "enemy");
    const groups = new Map();
    enemyVillages.forEach(v => {
      if (!v.aiId) v.aiId = `ai-${v.id}`;
      if (!groups.has(v.aiId)) groups.set(v.aiId, []);
      groups.get(v.aiId).push(v);
    });
    const free = Object.values(state.villages).filter(v => !v.owner && (!v.bonusType || v.bonusType === "none"));
    while (groups.size < desired && free.length) {
      const v = free.splice(rand(0, free.length - 1), 1)[0];
      const idx = groups.size;
      v.owner = "enemy";
      v.name = `Inimigo ${idx + 1}`;
      v.aiProfile = ["offensive","defensive","economic","expansive"][idx % 4];
      v.aiId = `ai-${v.id}`;
      groups.set(v.aiId, [v]);
    }
    S.save(state);
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
    if(!remaining) { v.trainQueue.splice(index,1); return saveRender(); }
    v.units[q.unit]=(v.units[q.unit]||0)+1; q.trained=(q.trained||0)+1;
    if(q.trained>=q.amount) v.trainQueue.splice(index,1); else q.nextAt=Date.now()+(q.unitDuration||1000);
    saveRender(); notify("Próxima unidade do treinamento finalizada pelo administrador.");
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
    const savedActive=state.players[pid].activeVillageId;
    if(mine.length){ const chosen=mine.find(v=>v.id===savedActive)||mine[0]; state.activeVillageId=chosen.id; state.players[pid].activeVillageId=chosen.id; }
    else if(sess.role==="admin") state.activeVillageId=null;
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
    v.protectionUntil=state.settings.beginnerProtection?.enabled===false?0:Date.now()+Math.max(0,Number(state.settings.beginnerProtection?.minutes)||15)*60000; state.villages[v.id]=v; state.activeVillageId=v.id;
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
    ensureCurrentPlayer, restartCurrentPlayer, isMine, currentPlayerId, achievementProgress, refreshAchievements, claimAchievement, buildingPopulation, buildAt, recruitAt, adminBulkUpdate, bulkBuild, bulkRecruitPreset, adminBulkFinish, adminBulkOwner,
    get state() {
      return state;
    },
    active,
    owned,
    villageAt,
    cap,
    population,
    popCap,
    prod, villageProgressPercent,
    prodAtLevel(v,r,lv){ const old=v.buildings[r==="wood"?"lumber":r==="clay"?"claypit":"mine"]||0; const base=(C.productionByLevel[Math.max(0,Math.min(30,lv))]||0)/60; const bonus=v.bonusType===r?bonusValue(v,r):v.bonusType==="resources"?bonusValue(v,"resources"):0; return base*state.settings.production[r]*(1+bonus/100); },
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
    sendAttack, scheduleAttack, scheduleAttackFrom, cancelScheduled, sendSupport, withdrawSupport, simulateCombat, marketExchange, updateMarket, createRecurringAttack, toggleRecurringAttack,
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
        const pid=currentPlayerId(); state.players=state.players||{}; state.players[pid]={...(state.players[pid]||{}),activeVillageId:i};
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
