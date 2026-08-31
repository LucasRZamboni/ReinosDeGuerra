(function () {
  const C = window.GAME_CONFIG,
    S = window.GameStorage,
    clone = (o) => JSON.parse(JSON.stringify(o)),
    rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
    id = (x, y) => `v-${x}-${y}`;
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
    for (let y = 0; y < C.mapHeight; y++)
      for (let x = 0; x < C.mapWidth; x++) {
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
    for (let y = 0; y < C.mapHeight; y++)
      for (let x = 0; x < C.mapWidth; x++) {
        const start = x === C.startingVillage.x && y === C.startingVillage.y;
        if (start || Math.random() < C.villageDensity)
          {
            const village = makeVillage(x, y, start ? "player" : null, settings);
            if (start) village.buildings = { ...village.buildings, ...settings.initialBuildingLevels };
            villages[id(x, y)] = village;
          }
      }
    return {
      version: 7,
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
      for (let y = 0; y < C.mapHeight; y++)
        for (let x = 0; x < C.mapWidth; x++)
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
    data.reports = data.reports || [];
    data.settings.objective =
      data.settings.objective === "rivals" ? "map100" : data.settings.objective;
    if (!data.villages[data.activeVillageId]?.owner)
      data.activeVillageId =
        Object.values(data.villages).find((v) => v.owner === "player")?.id ||
        Object.keys(data.villages)[0];
    return data;
  }
  let state = migrate(S.load() || newState());
  const active = () => state.villages[state.activeVillageId],
    owned = () =>
      Object.values(state.villages).filter((v) => v.owner === "player"),
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
  const population = (v) =>
    Object.entries(v.units).reduce(
      (n, [k, q]) => n + (C.units[k] ? q * C.units[k].population : 0),
      0,
    ) +
    (v.trainQueue || []).reduce(
      (n, q) =>
        n + (C.units[q.unit] ? q.amount * C.units[q.unit].population : 0),
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
  function points(v) {
    // A pontuação da aldeia vem exclusivamente dos edifícios existentes.
    // Assim não há soma artificial de 28 pontos e o ritmo/velocidade do mundo
    // nunca altera a pontuação. O preset inicial padrão soma exatamente 28.
    return Object.entries(v.buildings).reduce((n, [k, lv]) => {
      const free = Number(state.settings.freeStartingPointLevels?.[k] || 0);
      return n + Math.max(0, buildingPoints(k, lv) - buildingPoints(k, Math.min(lv, free)));
    }, 0);
  }
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
    if (target.owner === "player")
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
  function resolve(m) {
    const from = state.villages[m.fromId],
      target = state.villages[m.targetId];
    if (!from || !target) return;
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
          target.owner = "player";
          target.loyalty = 100;
          target.name = `Fortaleza ${target.x}|${target.y}`;
          survivors.noble--;
          conquered = true;
          notify(`${target.name} foi conquistada!`);
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
    if (spied)
      Object.assign(intel, {
        resources: clone(target.resources),
        buildings: clone(target.buildings),
        units: clone(target.units),
      });
    // Relatórios de batalha pertencem ao jogador: não registrar combates
    // entre inimigos/bárbaros que não envolvam nenhuma aldeia do jogador.
    const playerInvolved = from.owner === "player" || target.owner === "player";
    if (playerInvolved) state.reports.unshift({
      id: `rpt-${Date.now()}-${Math.random()}`,
      time: Date.now(),
      type: win ? "win" : "loss",
      victory: win,
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
      const choices = ["lumber", "claypit", "mine", "farm", "storage", "keep", "barracks", "wall"];
      if (!(v.buildQueue || []).length && Math.random() < 0.28 * d.aiGrowth) {
        const candidates = choices.filter(k => C.buildings[k] && (v.buildings[k] || 0) < C.buildings[k].maxLevel && meets(v, C.buildings[k].requires) && canPay(v, buildingCost(k, v)));
        if (candidates.length) {
          const k = candidates[rand(0, candidates.length - 1)], cost = buildingCost(k, v);
          pay(v, cost);
          v.buildQueue.push({ building: k, start: now, end: now + (buildingTime(k, v) * 1000) / state.speed });
        }
      }
      if (state.settings.freeVillagesTrainTroops !== false && Math.random() < 0.32 * d.aiGrowth) {
        const options = ["spear", "sword", "axe", "archer"].filter(k => C.units[k] && meets(v, C.units[k].requires || {}) && population(v) + C.units[k].population <= popCap(v) && canPay(v, unitCost(k, v)));
        if (options.length) {
          const k = options[rand(0, options.length - 1)], cost = unitCost(k, v);
          pay(v, cost); v.units[k] = (v.units[k] || 0) + 1;
        }
      }
    });
    if (state.settings.enemiesEnabled) {
      Object.values(state.villages).filter(v => v.owner === "enemy").forEach(from => {
        if (Math.random() > 0.20 * d.aiGrowth) return;
        const targets = Object.values(state.villages).filter(v => v.id !== from.id && v.owner !== "enemy");
        if (!targets.length) return;
        targets.sort((a,b) => Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y));
        const target = targets[rand(0, Math.min(7, targets.length-1))];
        const units = {}; let any=false;
        ["spear","sword","axe","archer","light","heavy","ram"].forEach(k => { const n=Math.floor((from.units[k]||0)*0.20); units[k]=n; if(n){from.units[k]-=n; any=true;} });
        if (any) { const dist=Math.hypot(target.x-from.x,target.y-from.y), travelMs=Math.max(1000, dist*state.settings.travelSecondsPerTile*1000/state.speed); state.movements.push({id:`enemy-${Date.now()}-${Math.random()}`,fromId:from.id,targetId:target.id,units,outbound:true,start:now,end:now+travelMs,travelMs,catapultTarget:null}); }
      });
    }
    state.lastAiAction = now;
  }
  function checkVictory() {
    const o = C.objectives[state.settings.objective] || C.objectives.villages10,
      count = owned().length,
      total = Object.keys(state.villages).length,
      won =
        o.type === "conquests"
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
          ? resolve(m)
          : Object.entries(m.units).forEach(([k, n]) => {
              const v = state.villages[m.fromId];
              if (v) v.units[k] = (v.units[k] || 0) + n;
            }),
      );
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
      if (n - lastSave >= 2000) {
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
      v.owner = "enemy"; v.name = `Inimigo ${enemies.length + 1}`;
      v.units.spear = Math.max(v.units.spear || 0, 80); v.units.axe = Math.max(v.units.axe || 0, 120);
      enemies.push(v);
    }
  }
  function adminCreateVillage(data) {
    const x = Math.max(0, Math.min(C.mapWidth - 1, Math.floor(Number(data.x))));
    const y = Math.max(0, Math.min(C.mapHeight - 1, Math.floor(Number(data.y))));
    if (state.villages[id(x,y)]) return notify("Já existe uma aldeia nessas coordenadas.", "warning");
    const v = makeVillage(x, y, data.owner || null, state.settings);
    v.name = String(data.name || `Aldeia ${x}|${y}`).trim().slice(0,40);
    v.bonusType = C.bonusTypes[data.bonusType] ? data.bonusType : "none";
    Object.keys(C.buildings).forEach(k => { if (data.buildings?.[k] !== undefined) v.buildings[k] = Math.max(0, Math.min(C.buildings[k].maxLevel, Math.floor(Number(data.buildings[k]) || 0))); });
    Object.keys(C.units).forEach(k => { if (data.units?.[k] !== undefined) v.units[k] = Math.max(0, Math.floor(Number(data.units[k]) || 0)); });
    ["wood","clay","iron"].forEach(r => { if (data.resources?.[r] !== undefined) v.resources[r] = Math.max(0, Number(data.resources[r]) || 0); });
    state.villages[v.id] = v; saveRender(); notify("Nova aldeia criada."); return v.id;
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
    Object.keys(C.units).forEach((k) => {
      if (data.units?.[k] !== undefined)
        v.units[k] = Math.max(0, Math.floor(Number(data.units[k]) || 0));
    });
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
    if (!v || v.owner !== "player")
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
  window.Game = {
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
    points,
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
    sendAttack,
    deleteReport(id) { state.reports = state.reports.filter((r) => r.id !== id); saveRender(); },
    clearReports() { state.reports = []; saveRender(); },
    adminUpdate,
    adminIdentity,
    adminCreateVillage,
    adminFinishBuild, adminFinishTraining, adminFinishAll,
    syncEnemies,
    renameVillage,
    setActive(i) {
      if (state.villages[i]?.owner === "player") {
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
      syncEnemies();
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
