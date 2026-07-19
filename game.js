(() => {
  "use strict";

  const GAME_CONFIG = window.DEFENDER_CONFIG;
  if (!GAME_CONFIG?.units?.player || !GAME_CONFIG?.units?.enemy || !GAME_CONFIG?.units?.wall) {
    throw new Error("缺少 game-config.js，或 Config 結構不完整");
  }

  const GAME_RULES = GAME_CONFIG.game;
  const WALL_CONFIG = GAME_CONFIG.units.wall;
  const COLS = GAME_RULES.columns;
  const ROWS = GAME_RULES.rows;
  // Calibrated directly against the painted slab grooves in
  // dungeon-fortress-6x8-transparent-v2.png. Horizontal boundaries follow the
  // image, while every column boundary comes from one linear perspective model
  // so it remains a mathematically straight line from the far row to the wall.
  const GRID_ROW_Y = [.377778, .434921, .496296, .561905, .631746, .705820, .786243, .873016, .969312];
  const GRID_CENTER_X_INTERCEPT = .4984734473;
  const GRID_CENTER_X_SLOPE = .0000577819;
  // Keep the near wall edge fixed while converging the far edge slightly more
  // toward the central vanishing point (about 0.78% per outer endpoint).
  const GRID_COLUMN_SPACING_INTERCEPT = .061696;
  const GRID_COLUMN_SPACING_SLOPE = .043313;
  const ENEMY_DEPTH_SCALES = [.93, .95, .97, .996, 1.018, 1.04, 1.07, 1.105];
  const WALL_MAX_HP = WALL_CONFIG.maxHp;
  const WALL_WARNING_YELLOW_RATIO = .49;
  const WALL_WARNING_RED_RATIO = .10;
  const SPEEDS = GAME_RULES.gameSpeeds;
  const UNIT_UNLOCK_LEVEL = Object.fromEntries(
    Object.entries(GAME_CONFIG.units.player).map(([type, unit]) => [type, unit.unlockLevel || 1])
  );
  const SCORE_RULES = GAME_CONFIG.scoring;
  const LEVEL_CONFIGS = GAME_CONFIG.levels;
  const TOTAL_LEVELS = Object.keys(LEVEL_CONFIGS).filter(level => Number(level) > 0).length;
  const INTERMISSION_TIPS = Object.freeze([
    { id: "repair-wall", text: "開戰之前記得維修城牆喔！", lowWallOnly: true },
    { id: "beholder", text: "眼魔是恐怖的敵人，不僅皮硬肉厚，還能從遠距發動攻擊。", enemy: "beholder" },
    { id: "clear-phase", text: "防守時間歸零後敵人會停止增援，清除場上所有敵人才能過關。", minLevel: 2 },
    { id: "move-defender", text: "選定守軍後點擊空走廊格即可移動；要和其他守軍換位則需要拖曳。", minLevel: 2 },
    { id: "recycle", text: "不再需要的守軍可以回收，取回一半派遣金幣重新配置陣線。", minLevel: 2 },
    { id: "troll-range", text: "巨魔有時會停在兩格外發動攻擊，別只盯著貼近城牆的敵人。", minLevel: 2, enemy: "troll" },
    { id: "ballista", text: "弩砲射速極快，適合持續壓制單一路線上的密集敵人。", minLevel: 2 },
    { id: "cannon", text: "加農砲價格昂貴，但砲彈能對三乘三範圍造成強力濺射傷害。", minLevel: 3 },
    { id: "large-enemies", text: "眼魔與章魚怪會占用二乘二格，請預留足夠火力處理大型目標。", minLevel: 2, enemy: "octopus" },
    { id: "long-defense", text: "第4關起防守時間延長為五分鐘，開戰前請先整頓城牆、兵力與金幣。", minLevel: 4 },
    { id: "pc-select-recycle", text: "PC版可按1～6快速選取對應走廊格守軍，按Z立即回收目前選定的單位。", desktopOnly: true },
    { id: "pc-repair", text: "PC版按F可快速維修城牆；若金幣或城牆狀態不符合條件則不會消耗資源。", desktopOnly: true },
    { id: "pc-speed", text: "PC版按A／D可降低或提高速度，按S可立即回到X1速度。", desktopOnly: true },
    { id: "pc-pause", text: "PC版按空白鍵可快速暫停或繼續遊戲，適合在敵潮密集時重新判讀戰況。", desktopOnly: true },
    { id: "quick-deploy", text: "雙擊選兵ICON可將單位快速部署到最左側空格；六格已滿時不會執行。" },
    { id: "inspect-enemy", text: "選取敵人可查看近戰／遠距、射程與招式名稱，先辨認威脅再調整守軍。" },
    { id: "deployment-cap", text: "派遣上限只計算仍在場上的守軍；陣亡或回收後會重新空出該兵種名額。", minLevel: 2 },
    { id: "ranged-pass-through", text: "遠距敵人停下攻擊後不再阻擋同陣營移動，後方敵人仍可能穿越並向前推進。", minLevel: 2 },
    { id: "large-enemy-retaliation", text: "二乘二大型敵人攻擊城牆時，覆蓋的兩條走廊守軍都可能同時受傷。", minLevel: 2 },
    { id: "wall-warning", text: "城牆低於一半會閃黃光、低於一成會閃紅光；看到警告時應盡快維修。" }
  ]);

  const SPRITE_PATHS = {
    mage: "assets/processed/player-mage.png",
    archer: "assets/processed/player-archer.png",
    warrior: "assets/processed/player-warrior.png",
    cannon: "assets/processed/Turret/player-cannon-slot3-perspective.png?v=20260718-turret",
    ballista: "assets/processed/Turret/player-ballista-slot3-perspective.png?v=20260718-turret",
    goblin: "assets/processed/enemy-goblin.png",
    troll: "assets/processed/enemy-troll.png",
    beholder: "assets/processed/enemy-beholder.png",
    wolf: "assets/processed/enemy-wolf.png",
    octopus: "assets/processed/enemy-octopus.png",
    ghost: "assets/processed/enemy-ghost.png",
    animatedArmor: "assets/processed/enemy-animated-armor.png",
    skeleton: "assets/processed/enemy-skeleton.png",
    lizard: "assets/processed/enemy-lizard.png",
    stoneGolem: "assets/processed/enemy-stone-golem.png",
    spider: "assets/processed/enemy-spider.png"
  };

  const PERSPECTIVE_SPRITE_PATHS = {
    "cannon-slot1": "assets/processed/Turret/player-cannon-slot1-perspective.png?v=20260718-turret",
    "cannon-slot2": "assets/processed/Turret/player-cannon-slot2-perspective.png?v=20260718-turret",
    "cannon-slot3": "assets/processed/Turret/player-cannon-slot3-perspective.png?v=20260718-turret",
    "cannon-slot4": "assets/processed/Turret/player-cannon-slot4-perspective.png?v=20260718-turret",
    "cannon-slot5": "assets/processed/Turret/player-cannon-slot5-perspective.png?v=20260718-turret",
    "cannon-slot6": "assets/processed/Turret/player-cannon-slot6-perspective.png?v=20260718-turret",
    "ballista-slot1": "assets/processed/Turret/player-ballista-slot1-perspective.png?v=20260718-turret",
    "ballista-slot2": "assets/processed/Turret/player-ballista-slot2-perspective.png?v=20260718-turret",
    "ballista-slot3": "assets/processed/Turret/player-ballista-slot3-perspective.png?v=20260718-turret",
    "ballista-slot4": "assets/processed/Turret/player-ballista-slot4-perspective.png?v=20260718-turret",
    "ballista-slot5": "assets/processed/Turret/player-ballista-slot5-perspective.png?v=20260718-turret",
    "ballista-slot6": "assets/processed/Turret/player-ballista-slot6-perspective.png?v=20260718-turret"
  };

  const DRAG_NEUTRAL_SPRITE_PATHS = {
    cannon: "assets/processed/Turret/player-cannon.png?v=20260718-neutral-drag",
    ballista: "assets/processed/Turret/player-ballista.png?v=20260718-neutral-drag"
  };

  const ICON_PATHS = {
    mage: "assets/processed/icons/player-mage-icon-3d-v3.png?v=20260719-300",
    archer: "assets/processed/icons/player-archer-icon-3d-v3.png?v=20260719-300",
    warrior: "assets/processed/icons/player-warrior-icon-3d-v3.png?v=20260719-300",
    cannon: "assets/processed/icons/player-cannon-icon-3d-v4.png?v=20260719-centered-300",
    ballista: "assets/processed/icons/player-ballista-icon-3d-v4.png?v=20260719-centered-300"
  };

  const CARD_STAT_ICON_PATHS = {
    attack: "assets/processed/UI/ui-sword-attack-v1.png?v=20260718",
    cost: "assets/processed/UI/coin-single-v1.png"
  };

  function footprintSize(unit) {
    return Math.max(1, unit.footprint?.columns || 1, unit.footprint?.rows || 1);
  }

  function normalizePlayerUnit(unit) {
    return {
      ...unit,
      name: unit.displayName,
      cost: unit.resourceCost,
      interval: unit.attackInterval,
      range: unit.attackRange,
      damage: unit.attackDamage,
      attack: unit.attackType,
      hp: unit.maxHp,
      footprint: footprintSize(unit)
    };
  }

  function normalizeEnemyUnit(unit) {
    return {
      ...unit,
      name: unit.displayName,
      hp: unit.maxHp,
      attackEvery: unit.attackInterval,
      damage: unit.attackDamage,
      defenderDamage: unit.splashDamage,
      range: unit.attackRange,
      moveEvery: unit.moveInterval,
      reward: unit.killReward,
      score: unit.scoreValue,
      footprint: footprintSize(unit)
    };
  }

  const PLAYER_TYPES = Object.fromEntries(
    Object.entries(GAME_CONFIG.units.player).map(([type, unit]) => [type, normalizePlayerUnit(unit)])
  );
  const ENEMY_TYPES = Object.fromEntries(
    Object.entries(GAME_CONFIG.units.enemy).map(([type, unit]) => [type, normalizeEnemyUnit(unit)])
  );
  const UNIT_AUDIO_CONFIGS = {
    wall: WALL_CONFIG.audio,
    ...Object.fromEntries(Object.entries(PLAYER_TYPES).map(([type, unit]) => [type, unit.audio])),
    ...Object.fromEntries(Object.entries(ENEMY_TYPES).map(([type, unit]) => [type, unit.audio]))
  };

  const spriteCache = new Map();
  const perspectiveSpriteCache = new Map();
  const dragNeutralSpriteCache = new Map();
  const iconCache = new Map();
  const attackAudioPools = new Map();
  const unitCardCache = new Map();
  const visualPools = new Map();
  const activeVisualCounts = new Map();
  const audioLastPlayedAt = new Map();
  const PERFORMANCE = Object.freeze({
    uiInterval: .1,
    maxPoolSize: 36,
    audioRetriggerMs: 55,
    desktopVisualLimits: { playerProjectile: 32, enemyProjectile: 24, impact: 18, muzzle: 12, cannon: 4, slash: 4, troll: 4, number: 24, coin: 14 },
    lowPowerVisualLimits: { playerProjectile: 18, enemyProjectile: 12, impact: 9, muzzle: 6, cannon: 2, slash: 2, troll: 2, number: 12, coin: 8 }
  });
  const RAPID_SFX = new Set(["fireball", "arrow", "slash", "shell", "boom", "bolt", "hit", "wall"]);
  const UNIT_SELECT_AUDIO = Object.freeze({ path: "assets/audio/音效/PutIn.mp3", volume: 1 });

  const els = {
    app: document.querySelector("#app"), board: document.querySelector("#board"), tileLayer: document.querySelector("#tileLayer"),
    rangeLayer: document.querySelector("#rangeLayer"), unitLayer: document.querySelector("#unitLayer"), effectLayer: document.querySelector("#effectLayer"),
    corridor: document.querySelector("#corridor"), deck: document.querySelector("#unitDeck"), timer: document.querySelector("#timerText"), levelLabel: document.querySelector("#levelLabel"),
    score: document.querySelector("#scoreText"), wall: document.querySelector("#wall"), wallHpFill: document.querySelector("#wallHpFill"),
    wallHpText: document.querySelector("#wallHpText"), repair: document.querySelector("#repairButton"),
    repairAmount: document.querySelector("#repairAmountText"), repairCost: document.querySelector("#repairCostText"), recycle: document.querySelector("#recycleButton"),
    unlock: document.querySelector("#unlockText"), threat: document.querySelector("#threatFill"), levelProgress: document.querySelector("#levelProgress"),
    speed: document.querySelector("#speedDisplay"), speedDown: document.querySelector("#speedDownButton"), speedUp: document.querySelector("#speedUpButton"),
    pause: document.querySelector("#pauseButton"), mute: document.querySelector("#muteButton"), debug: document.querySelector("#debugButton"),
    debugMenu: document.querySelector("#debugMenu"), bgmToggle: document.querySelector("#bgmToggleButton"), collisionToggle: document.querySelector("#collisionToggleButton"),
    gridToggle: document.querySelector("#gridToggleButton"), unlockAllUnits: document.querySelector("#unlockAllUnitsButton"),
    debugCoins: document.querySelector("#debugCoinsButton"),
    bgm: document.querySelector("#bgmAudio"), title: document.querySelector("#titleScreen"),
    continue: document.querySelector("#continueButton"), countdown: document.querySelector("#countdownOverlay"), toast: document.querySelector("#toastLayer"),
    result: document.querySelector("#resultOverlay"), resultKicker: document.querySelector("#resultKicker"), resultTitle: document.querySelector("#resultTitle"),
    resultSubtitle: document.querySelector("#resultSubtitle"), resultTip: document.querySelector("#resultTip"), resultTipTitle: document.querySelector("#resultTipTitle"), resultTipText: document.querySelector("#resultTipText"),
    resultKills: document.querySelector("#resultKills"), resultTime: document.querySelector("#resultTime"),
    pauseControls: document.querySelector("#pauseControls"), pauseMute: document.querySelector("#pauseMuteButton"),
    pauseSpeedDown: document.querySelector("#pauseSpeedDownButton"), pauseSpeed: document.querySelector("#pauseSpeedDisplay"), pauseSpeedUp: document.querySelector("#pauseSpeedUpButton"),
    restart: document.querySelector("#restartButton"), deckCoinPile: document.querySelector("#deckCoinPile"), deckCoinText: document.querySelector("#deckCoinText"),
    fullscreen: document.querySelector("#fullscreenButton"), orientationGuard: document.querySelector("#orientationGuard")
  };

  let audio = null;
  let muted = false;
  let bgmEnabled = true;
  let showEnemyCollision = false;
  let showBoardGrid = false;
  let gameHasStarted = false;
  let bgmErrorShown = false;
  let state = null;
  let raf = 0;
  let lastFrame = 0;
  let drag = null;
  let selectedCard = null;
  let selectedDefender = null;
  let selectedEnemyId = null;
  let selectedWall = false;
  let orientationPauseActive = false;
  let focusPauseActive = false;
  let resumeAfterSystemPause = false;
  let resultAction = "restart";
  let enemyLayoutDirty = true;
  let lowPowerVisualMode = false;
  let enemyOccupancy = [];
  let enemiesByColumn = [];
  const rangeSurfaceTiles = new Map();
  let lastUnitCardActivation = { type: null, at: -Infinity };
  const QUICK_DEPLOY_DOUBLE_TAP_MS = 380;

  function initialState() {
    return {
      running: false, paused: false, ended: false, level: 1, secondsLeft: LEVEL_CONFIGS[1].duration, elapsed: 0, coins: GAME_RULES.initialResources, score: 0, wallHp: WALL_MAX_HP,
      enemies: [], defenders: Array(COLS).fill(null), openSlots: Math.min(COLS, GAME_RULES.startingOpenSlots), spawnCooldown: 1.2, pendingSpawn: null, kills: 0, levelKills: 0, levelSpawned: 0,
      killScore: 0, defenseScore: 0, performanceScore: 0, wallSafeTime: 0, defenseScoreBuffer: 0, levelDamageTaken: 0,
      defenseTimeReached: false, clearPhaseElapsed: 0,
      levelBonuses: {}, awardedLevels: [], shownTipIds: [], speedIndex: 0, nextEnemyId: 1, debugAllUnitsUnlocked: false,
      uiCooldown: 0, livingEnemies: 0, enemyTypeCounts: Object.create(null), levelSpawnedByType: Object.create(null)
    };
  }

  function setTextIfChanged(element, value) {
    if (!element) return;
    const text = String(value);
    if (element.textContent !== text) element.textContent = text;
  }

  function setStyleIfChanged(element, property, value) {
    if (!element) return;
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
  }

  function detectLowPowerVisualMode() {
    const compactScreen = window.matchMedia("(max-width: 820px)").matches;
    const limitedMemory = Number(navigator.deviceMemory || 8) <= 4;
    lowPowerVisualMode = compactScreen || limitedMemory;
    document.body.classList.toggle("low-power-effects", lowPowerVisualMode);
  }

  function visualLimit(kind) {
    const limits = lowPowerVisualMode ? PERFORMANCE.lowPowerVisualLimits : PERFORMANCE.desktopVisualLimits;
    return limits[kind] ?? 8;
  }

  function acquireVisual(kind, className, html = "", container = els.effectLayer) {
    const active = activeVisualCounts.get(kind) || 0;
    if (active >= visualLimit(kind)) return null;
    const pool = visualPools.get(kind) || [];
    visualPools.set(kind, pool);
    const element = pool.pop() || document.createElement("div");
    element.getAnimations().forEach(animation => animation.cancel());
    element.className = className;
    element.removeAttribute("style");
    if (element.innerHTML !== html) element.innerHTML = html;
    container.append(element);
    element._visualKind = kind;
    activeVisualCounts.set(kind, active + 1);
    return element;
  }

  function releaseVisual(kind, element) {
    if (!element || element._visualKind !== kind) return;
    element._visualKind = null;
    element.getAnimations().forEach(animation => {
      animation.onfinish = null;
      animation.cancel();
    });
    element.remove();
    element.className = "";
    element.removeAttribute("style");
    activeVisualCounts.set(kind, Math.max(0, (activeVisualCounts.get(kind) || 1) - 1));
    const pool = visualPools.get(kind) || [];
    visualPools.set(kind, pool);
    if (pool.length < PERFORMANCE.maxPoolSize) pool.push(element);
  }

  function resetVisualEffects() {
    els.effectLayer.querySelectorAll("*").forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
    els.effectLayer.innerHTML = "";
    activeVisualCounts.clear();
  }

  function resetEnemyIndexes() {
    enemyOccupancy = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => new Set()));
    enemiesByColumn = Array.from({ length: COLS }, () => new Set());
    enemyLayoutDirty = true;
  }

  function addEnemyToIndexes(enemy) {
    for (let row = enemy.row; row < Math.min(ROWS, enemy.row + enemy.footprint); row++) {
      for (let col = enemy.col; col < Math.min(COLS, enemy.col + enemy.footprint); col++) enemyOccupancy[row][col].add(enemy);
    }
    for (let col = enemy.col; col < Math.min(COLS, enemy.col + enemy.footprint); col++) enemiesByColumn[col].add(enemy);
  }

  function removeEnemyFromOccupancy(enemy, row = enemy.row, col = enemy.col) {
    for (let y = row; y < Math.min(ROWS, row + enemy.footprint); y++) {
      for (let x = col; x < Math.min(COLS, col + enemy.footprint); x++) enemyOccupancy[y][x].delete(enemy);
    }
  }

  function removeEnemyFromIndexes(enemy) {
    removeEnemyFromOccupancy(enemy);
    for (let col = enemy.col; col < Math.min(COLS, enemy.col + enemy.footprint); col++) enemiesByColumn[col].delete(enemy);
  }

  function gridPoint(col, row) {
    const boundedRow = Math.max(0, Math.min(ROWS, row));
    const rowA = Math.floor(boundedRow);
    const rowB = Math.min(ROWS, rowA + 1);
    const t = boundedRow - rowA;
    const y = GRID_ROW_Y[rowA] + (GRID_ROW_Y[rowB] - GRID_ROW_Y[rowA]) * t;
    const centerX = GRID_CENTER_X_INTERCEPT + GRID_CENTER_X_SLOPE * y;
    const spacing = GRID_COLUMN_SPACING_INTERCEPT + GRID_COLUMN_SPACING_SLOPE * y;
    return {
      x: centerX + (col - COLS / 2) * spacing,
      y
    };
  }

  function gridRegion(col, row, colSpan = 1, rowSpan = 1) {
    const points = [
      gridPoint(col, row),
      gridPoint(col + colSpan, row),
      gridPoint(col + colSpan, row + rowSpan),
      gridPoint(col, row + rowSpan)
    ];
    const left = Math.min(...points.map(point => point.x));
    const right = Math.max(...points.map(point => point.x));
    const top = Math.min(...points.map(point => point.y));
    const bottom = Math.max(...points.map(point => point.y));
    const width = right - left;
    const height = bottom - top;
    const clip = `polygon(${points.map(point => `${(point.x - left) / width * 100}% ${(point.y - top) / height * 100}%`).join(",")})`;
    return { points, left, top, width, height, clip };
  }

  function cellSurfacePoints(col, row) {
    const [topLeft, topRight, bottomRight, bottomLeft] = gridRegion(col, row).points;
    const topWidth = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y) * 1000;
    const bottomWidth = Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y) * 1000;
    const leftHeight = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y) * 1000;
    const rightHeight = Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y) * 1000;
    const averageWidth = (topWidth + bottomWidth) / 2;
    const averageHeight = (leftHeight + rightHeight) / 2;
    // Fixed image-space insets follow the painted bevel instead of filling the
    // mathematical collision cell from groove to groove.
    const insetU = Math.min(.115, 6.2 / averageWidth);
    const insetV = Math.min(.13, 5.2 / averageHeight);
    const chamferU = Math.min(.09, 5.4 / averageWidth);
    const chamferV = Math.min(.1, 4.6 / averageHeight);
    const point = (u, v) => {
      const topX = topLeft.x + (topRight.x - topLeft.x) * u;
      const topY = topLeft.y + (topRight.y - topLeft.y) * u;
      const bottomX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * u;
      const bottomY = bottomLeft.y + (bottomRight.y - bottomLeft.y) * u;
      return {
        x: topX + (bottomX - topX) * v,
        y: topY + (bottomY - topY) * v
      };
    };
    return [
      point(insetU + chamferU, insetV),
      point(1 - insetU - chamferU, insetV),
      point(1 - insetU, insetV + chamferV),
      point(1 - insetU, 1 - insetV - chamferV),
      point(1 - insetU - chamferU, 1 - insetV),
      point(insetU + chamferU, 1 - insetV),
      point(insetU, 1 - insetV - chamferV),
      point(insetU, insetV + chamferV)
    ];
  }

  function createRangeSurfaceLayer() {
    rangeSurfaceTiles.clear();
    els.rangeLayer.innerHTML = "";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("perspective-range", "surface-range");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <radialGradient id="rangeSurfacePaint" cx="48%" cy="38%" r="72%">
        <stop offset="0%" stop-color="#c7fff4" stop-opacity=".43"/>
        <stop offset="52%" stop-color="#43e8d2" stop-opacity=".31"/>
        <stop offset="100%" stop-color="#079b86" stop-opacity=".2"/>
      </radialGradient>
      <linearGradient id="rangeSurfaceSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ddfff8" stop-opacity=".28"/>
        <stop offset="34%" stop-color="#6effe3" stop-opacity=".08"/>
        <stop offset="100%" stop-color="#007c6f" stop-opacity=".16"/>
      </linearGradient>`;
    svg.append(defs);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tile = document.createElementNS("http://www.w3.org/2000/svg", "g");
        tile.classList.add("range-surface-tile");
        tile.dataset.row = row;
        tile.dataset.col = col;
        const points = cellSurfacePoints(col, row).map(point => `${point.x * 1000},${point.y * 1000}`).join(" ");
        const paint = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        paint.classList.add("range-surface-paint");
        paint.setAttribute("points", points);
        const sheen = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        sheen.classList.add("range-surface-sheen");
        sheen.setAttribute("points", points);
        tile.append(paint, sheen);
        svg.append(tile);
        rangeSurfaceTiles.set(`${col}:${row}`, tile);
      }
    }
    els.rangeLayer.append(svg);
  }

  function placeOnGrid(element, col, row, colSpan = 1, rowSpan = 1, clipElement = false) {
    const region = gridRegion(col, row, colSpan, rowSpan);
    element.style.left = `${region.left * 100}%`;
    element.style.top = `${region.top * 100}%`;
    element.style.width = `${region.width * 100}%`;
    element.style.height = `${region.height * 100}%`;
    element.style.setProperty("--region-clip", region.clip);
    if (clipElement) element.style.clipPath = region.clip;
    return region;
  }

  function createBoard() {
    els.tileLayer.innerHTML = "";
    const grid = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    grid.classList.add("perspective-grid");
    grid.setAttribute("viewBox", "0 0 1000 1000");
    grid.setAttribute("preserveAspectRatio", "none");
    grid.setAttribute("aria-hidden", "true");
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const region = gridRegion(col, row);
        cell.classList.add("grid-cell");
        if (row === 0) cell.classList.add("spawn-zone");
        if (row === ROWS - 1) cell.classList.add("danger-zone");
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.setAttribute("points", region.points.map(point => `${point.x * 1000},${point.y * 1000}`).join(" "));
        grid.append(cell);
      }
    }
    for (let row = 0; row <= ROWS; row++) {
      const start = gridPoint(0, row);
      const end = gridPoint(COLS, row);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.classList.add("grid-line", "horizontal");
      line.setAttribute("x1", start.x * 1000);
      line.setAttribute("y1", start.y * 1000);
      line.setAttribute("x2", end.x * 1000);
      line.setAttribute("y2", end.y * 1000);
      grid.append(line);
    }
    for (let col = 0; col <= COLS; col++) {
      const start = gridPoint(col, 0);
      const end = gridPoint(col, ROWS);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.classList.add("grid-line", "vertical");
      line.setAttribute("x1", start.x * 1000);
      line.setAttribute("y1", start.y * 1000);
      line.setAttribute("x2", end.x * 1000);
      line.setAttribute("y2", end.y * 1000);
      grid.append(line);
    }
    els.tileLayer.append(grid);
    createRangeSurfaceLayer();
    els.corridor.querySelectorAll(".corridor-slot").forEach(el => el.remove());
    for (let col = 0; col < COLS; col++) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "corridor-slot";
      slot.dataset.col = col;
      slot.setAttribute("aria-label", `部署位置 ${col + 1}`);
      slot.addEventListener("click", () => onSlotClick(col));
      els.corridor.append(slot);
    }
  }

  function createDeck() {
    els.deck.innerHTML = "";
    unitCardCache.clear();
    Object.entries(PLAYER_TYPES).forEach(([key, unit]) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "unit-card";
      card.dataset.type = key;
      card.innerHTML = `
        <span class="card-stat card-stat-attack" aria-label="攻擊力 ${unit.damage}">
          <img src="${CARD_STAT_ICON_PATHS.attack}" alt="" draggable="false"><strong>${unit.damage}</strong>
        </span>
        <span class="card-stat card-stat-cost" aria-label="派遣價格 ${unit.cost} 金幣">
          <img src="${CARD_STAT_ICON_PATHS.cost}" alt="" draggable="false"><strong>${unit.cost}</strong>
        </span>
        <span class="card-icon">${unit.glyph}</span><b><span class="card-name">${unit.name}</span><span class="deployment-count" data-deployment-count></span></b>`;
      card.addEventListener("pointerdown", e => beginDrag(e, key), { passive: false });
      card.addEventListener("click", e => {
        if (drag?.moved) return;
        e.preventDefault();
        const now = performance.now();
        const isDoubleActivation = e.detail >= 2
          || (lastUnitCardActivation.type === key && now - lastUnitCardActivation.at <= QUICK_DEPLOY_DOUBLE_TAP_MS);
        lastUnitCardActivation = isDoubleActivation ? { type: null, at: -Infinity } : { type: key, at: now };
        if (isDoubleActivation) {
          quickDeploy(key);
          return;
        }
        selectCard(key);
      });
      applyIcon(card.querySelector(".card-icon"), key);
      els.deck.append(card);
      unitCardCache.set(key, card);
    });
  }

  function resetGame() {
    cancelAnimationFrame(raf);
    state?.enemies?.forEach(enemy => clearTimeout(enemy.hpHideTimer));
    state = initialState();
    selectedCard = null;
    selectedDefender = null;
    selectedEnemyId = null;
    selectedWall = false;
    resetEnemyIndexes();
    detectLowPowerVisualMode();
    els.wall.classList.remove("selected");
    els.wall.setAttribute("aria-selected", "false");
    els.unitLayer.innerHTML = "";
    resetVisualEffects();
    els.rangeLayer.innerHTML = "";
    els.result.classList.remove("show", "level-complete", "pause-menu");
    els.resultTip.hidden = true;
    els.recycle.disabled = true;
    createBoard();
    createDeck();
    syncUI(true);
  }

  async function beginGame() {
    ensureAudio();
    gameHasStarted = true;
    startBgm();
    els.title.classList.add("hidden");
    resetGame();
    resultAction = "restart";
    els.restart.textContent = "再玩一次";
    els.restart.disabled = false;
    await playCountdown(["第一關", "3", "2", "1", "守住城牆!"]);
    state.running = true;
    syncPageFocus();
    lastFrame = performance.now();
    raf = requestAnimationFrame(loop);
  }

  async function playCountdown(labels) {
    els.countdown.classList.add("show");
    for (const label of labels) {
      els.countdown.textContent = label;
      els.countdown.classList.toggle("compact-message", String(label).includes("繼續防守"));
      els.countdown.classList.remove("pop");
      void els.countdown.offsetWidth;
      els.countdown.classList.add("pop");
      sfx(/^\d$/.test(label) ? "count" : "start");
      await wait(/^\d$/.test(label) ? 760 : 900);
    }
    els.countdown.classList.remove("show", "pop", "compact-message");
  }

  function loop(now) {
    const realDt = Math.min(.12, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (state.running && !state.paused && !state.ended) {
      const dt = realDt * SPEEDS[state.speedIndex];
      update(dt);
    }
    renderEnemies();
    raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    const levelConfig = LEVEL_CONFIGS[state.level];
    state.elapsed += dt;
    updateSafeDefenseScore(dt);
    state.secondsLeft = Math.max(0, state.secondsLeft - dt);
    const progress = 1 - state.secondsLeft / levelConfig.duration;
    if (!state.defenseTimeReached && state.secondsLeft <= 0) {
      state.defenseTimeReached = true;
      state.clearPhaseElapsed = 0;
      state.pendingSpawn = null;
      toast("成功突破防守時間，清除場上所有敵人即可過關", 3800);
      sfx("unlock");
    }
    if (!state.defenseTimeReached) {
      state.spawnCooldown -= dt;
      const spawnInterval = lerp(levelConfig.spawnStart, levelConfig.spawnEnd, Math.pow(progress, .68));
      if (state.spawnCooldown <= 0) {
        const canAddEnemy = state.livingEnemies < GAME_RULES.maxActiveEnemies;
        const spawned = canAddEnemy && spawnEnemy(progress);
        if (spawned) state.spawnCooldown += spawnInterval * rand(.78, 1.24);
        else state.spawnCooldown = .12;
      }
    } else {
      state.clearPhaseElapsed += dt;
    }

    for (const enemy of state.enemies) updateEnemy(enemy, dt, progress);
    for (let col = 0; col < COLS; col++) if (state.defenders[col]) updateDefender(state.defenders[col], dt);
    state.enemies = state.enemies.filter(e => !e.remove);

    const hasLivingEnemies = state.livingEnemies > 0;
    if (state.wallHp <= 0) endGame(false);
    else if (state.defenseTimeReached && !hasLivingEnemies && state.clearPhaseElapsed >= 1.4) {
      if (state.level < Object.keys(LEVEL_CONFIGS).length) completeLevel();
      else endGame(true);
    }
    state.uiCooldown -= dt;
    if (state.uiCooldown <= 0) {
      state.uiCooldown += PERFORMANCE.uiInterval;
      syncUI();
    }
  }

  function updateSafeDefenseScore(dt) {
    state.wallSafeTime += dt;
    const rate = SCORE_RULES.safeDefenseRate.find(rule => state.wallSafeTime >= rule.after)?.pointsPerSecond || 0;
    state.defenseScoreBuffer += dt * rate;
    const earned = Math.floor(state.defenseScoreBuffer);
    if (earned <= 0) return;
    state.defenseScoreBuffer -= earned;
    state.defenseScore += earned;
    state.score += earned;
  }

  function updateUnlocks() {
    const shouldOpen = Math.min(COLS, GAME_RULES.startingOpenSlots + Math.floor(state.elapsed / GAME_RULES.slotUnlockInterval));
    if (shouldOpen > state.openSlots) {
      for (let n = state.openSlots; n < shouldOpen; n++) {
        state.openSlots++;
        toast(`塔樓第 ${state.openSlots} 格已開放`);
        sfx("unlock");
        const slot = els.corridor.querySelector(`[data-col="${state.openSlots - 1}"]`);
        slot?.animate([{ transform: "scale(.6)", filter: "brightness(3)" }, { transform: "scale(1)", filter: "none" }], { duration: 650, easing: "cubic-bezier(.2,1,.3,1)" });
      }
      syncSlots();
    }
  }

  function enemyTouchesWallAt(enemy, row = enemy.row) {
    return row >= ROWS - enemy.footprint;
  }

  function footprintsOverlap(aCol, aRow, aSize, bCol, bRow, bSize) {
    return aCol < bCol + bSize && aCol + aSize > bCol && aRow < bRow + bSize && aRow + aSize > bRow;
  }

  function isStationaryRangedAttacker(enemy) {
    if (!enemy || enemy.dead || enemy.remove) return false;
    const effectiveAttackRange = enemy.resolvedAttackRange ?? enemy.range;
    if (effectiveAttackRange <= 1) return false;
    return ROWS - enemyFrontRow(enemy) <= effectiveAttackRange;
  }

  function canEnemyOccupy(enemy, targetRow, targetCol) {
    if (targetCol < 0 || targetRow < 0 || targetCol + enemy.footprint > COLS || targetRow + enemy.footprint > ROWS) return false;

    // Every enemy may merge into the wall crowd only on the step that reaches the wall.
    if (enemy.canOverlapAtWall && enemyTouchesWallAt(enemy, targetRow)) return true;

    const occupants = new Set();
    for (let row = targetRow; row < targetRow + enemy.footprint; row++) {
      for (let col = targetCol; col < targetCol + enemy.footprint; col++) {
        enemyOccupancy[row][col].forEach(other => occupants.add(other));
      }
    }
    for (const other of occupants) {
      if (other === enemy || other.dead || other.remove) continue;
      // A ranged enemy that has stopped to attack no longer blocks the lane.
      // Moving enemies may pass through it and continue toward the wall.
      if (isStationaryRangedAttacker(other)) continue;
      if (footprintsOverlap(targetCol, targetRow, enemy.footprint, other.col, other.row, other.footprint)) return false;
    }
    return true;
  }

  function spawnEnemy(progress) {
    if (!state.pendingSpawn) {
      const config = LEVEL_CONFIGS[state.level];
      let unlocked = Object.keys(ENEMY_TYPES).filter(type => progress >= config.unlock[type]);
      if (progress < config.openingGoblinOnly) unlocked = ["goblin"];
      unlocked = unlocked.filter(type => {
        const cap = config.activeCaps[type];
        return !cap || (state.enemyTypeCounts[type] || 0) < cap;
      });
      unlocked = unlocked.filter(type => !enemySpawnLimitReached(type));
      if (!unlocked.length) return false;
      const type = weightedChoice(unlocked, typeKey => config.weight[typeKey]);
      const base = ENEMY_TYPES[type];
      const footprint = base.footprint || 1;
      state.pendingSpawn = {
        type,
        col: Math.floor(Math.random() * (COLS - footprint + 1)),
        progress
      };
    }

    const { type, col, progress: scheduledProgress } = state.pendingSpawn;
    const base = ENEMY_TYPES[type];
    const tier = 1 + Math.floor(scheduledProgress * 4);
    const config = LEVEL_CONFIGS[state.level];
    const scale = config.scaleStart + scheduledProgress * config.scaleGrowth;
    const footprint = base.footprint || 1;
    const configuredStopChance = Number(base.stopAtMaxRangeChance);
    const stopAtMaxRangeChance = Number.isFinite(configuredStopChance)
      ? Math.max(0, Math.min(1, configuredStopChance))
      : null;
    const spawnProbe = { footprint };
    if (!canEnemyOccupy(spawnProbe, 0, col)) return false;
    const enemy = {
      id: state.nextEnemyId++, type, col, row: 0, hp: Math.round(base.hp * scale), maxHp: Math.round(base.hp * scale),
      moveCooldown: base.moveEvery * rand(1 - GAME_RULES.enemyMoveSpeedVariance, 1 + GAME_RULES.enemyMoveSpeedVariance),
      attackCooldown: base.attackEvery,
      damage: Math.round(base.damage * (1 + scheduledProgress * GAME_RULES.enemyDamageGrowth)),
      defenderDamage: Math.round(base.defenderDamage * (1 + scheduledProgress * GAME_RULES.enemyDamageGrowth)),
      range: base.range || 1,
      stopAtMaxRangeChance,
      resolvedAttackRange: null,
      reward: base.reward,
      footprint,
      splashColumns: Math.max(1, base.splashArea?.columns || footprint),
      canOverlapAtWall: base.canOverlapAtWall,
      dead: false, remove: false, tier, el: null, hpFill: null, hpDirty: true
    };
    state.pendingSpawn = null;
    enemy.el = makeEnemyElement(enemy);
    enemy.hpFill = enemy.el.querySelector(".enemy-hpbar i");
    state.enemies.push(enemy);
    state.livingEnemies++;
    state.enemyTypeCounts[type] = (state.enemyTypeCounts[type] || 0) + 1;
    state.levelSpawnedByType[type] = (state.levelSpawnedByType[type] || 0) + 1;
    state.levelSpawned++;
    addEnemyToIndexes(enemy);
    enemyLayoutDirty = true;
    els.unitLayer.append(enemy.el);
    placeOnGrid(enemy.el, enemy.col, enemy.row, footprint, footprint);
    setEnemyDepthScale(enemy);
    enemy.el.animate([{ opacity: 0, transform: "translateY(-70%) scale(.35)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 470 / SPEEDS[state.speedIndex], easing: "cubic-bezier(.2,1,.3,1)" });
    return true;
  }

  function makeEnemyElement(enemy) {
    const base = ENEMY_TYPES[enemy.type];
    const combatType = base.range >= 2 ? "遠距" : "近戰";
    const combatClass = base.range >= 2 ? "ranged" : "melee";
    const rangeText = `${enemy.range || base.range || 1}格`;
    const el = document.createElement("div");
    el.className = `game-unit enemy ${enemy.type} footprint-${enemy.footprint}`;
    el.dataset.id = enemy.id;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `選取${base.name}`);
    el.innerHTML = `<div class="enemy-selection-ring" aria-hidden="true"></div><div class="body"><span class="unit-glyph">${base.glyph}</span><div class="enemy-hpbar" aria-hidden="true"><i></i></div></div><div class="unit-name-label" aria-hidden="true">${base.name}<span class="enemy-side-info"><span class="enemy-combat-label ${combatClass}">${combatType}</span><span class="enemy-range-label">${rangeText}</span><span class="enemy-attack-name">${base.attackName || "—"}</span></span></div>`;
    applySprite(el.querySelector(".body"), enemy.type);
    el.addEventListener("click", e => {
      if (enemy.dead || enemy.remove) return;
      e.stopPropagation();
      selectEnemy(enemy.id);
    });
    el.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      selectEnemy(enemy.id);
    });
    return el;
  }

  function elementAnchorInBoard(element, xRatio = .5, yRatio = .45) {
    if (!element) return null;
    const boardRect = els.board.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scaleX = boardRect.width / els.board.clientWidth || 1;
    const scaleY = boardRect.height / els.board.clientHeight || 1;
    return {
      x: (elementRect.left + elementRect.width * xRatio - boardRect.left) / scaleX,
      y: (elementRect.top + elementRect.height * yRatio - boardRect.top) / scaleY
    };
  }

  function enemyAttackOrigin(enemy) {
    const body = enemy.el?.querySelector(".body");
    const yRatio = {
      octopus: .36,
      beholder: .43,
      ghost: .42,
      spider: .53,
      lizard: .48
    }[enemy.type] ?? .52;
    const visualAnchor = elementAnchorInBoard(body, .5, yRatio);
    if (visualAnchor) return visualAnchor;
    const fallback = gridPoint(enemy.col + enemy.footprint / 2, enemy.row + enemy.footprint / 2);
    return { x: fallback.x * els.board.clientWidth, y: fallback.y * els.board.clientHeight };
  }

  function enemyWallImpactPoint(enemy) {
    const point = gridPoint(enemy.col + enemy.footprint / 2, ROWS);
    return {
      x: point.x * els.board.clientWidth,
      y: point.y * els.board.clientHeight + 7
    };
  }

  function resolveEnemyAttack(enemy, playedAttackAudio) {
    if (!enemy || state.ended) return;
    damageWall(enemy.damage);
    damageDefendersInEnemyColumns(enemy);
    const playedImpactAudio = playUnitImpactAudio(enemy.type);
    if (!playedAttackAudio && !playedImpactAudio) sfx("wall");
  }

  function enemyMagicImpactAt(x, y, type) {
    const fx = acquireVisual("impact", `enemy-magic-impact ${type}`, `<i></i><b></b><span></span>`);
    if (!fx) return;
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;
    setTimeout(() => releaseVisual("impact", fx), 620);
  }

  function launchEnemyMagicProjectile(enemy, onHit) {
    const from = enemyAttackOrigin(enemy);
    const to = enemyWallImpactPoint(enemy);
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const flightAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    const distance = Math.hypot(deltaX, deltaY);
    const duration = Math.max(240, (210 + distance * .48) / SPEEDS[state.speedIndex]);
    const projectile = acquireVisual("enemyProjectile", `enemy-magic-projectile ${enemy.type}`, `<i aria-hidden="true"></i>`);
    if (!projectile) {
      setTimeout(onHit, duration);
      return;
    }
    projectile.style.left = `${from.x}px`;
    projectile.style.top = `${from.y}px`;
    projectile.style.setProperty("--enemy-flight-angle", `${flightAngle}deg`);
    const animation = projectile.animate(
      [{ transform: "translate(0,0) scale(.72)" }, { transform: `translate(${deltaX}px,${deltaY}px) scale(1.08)` }],
      { duration, easing: "cubic-bezier(.28,.48,.38,1)" }
    );
    animation.onfinish = () => {
      releaseVisual("enemyProjectile", projectile);
      enemyMagicImpactAt(to.x, to.y, enemy.type);
      onHit();
    };
  }

  function lizardThrustImpactAt(x, y, strike) {
    const fx = acquireVisual("impact", `enemy-lizard-thrust-impact strike-${strike}`, `<i></i><b></b><span></span>`);
    if (!fx) return;
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;
    setTimeout(() => releaseVisual("impact", fx), 470);
  }

  function launchEnemyTripleThrust(enemy, onHit) {
    const from = enemyAttackOrigin(enemy);
    const to = enemyWallImpactPoint(enemy);
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const flightAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    const distance = Math.hypot(deltaX, deltaY);
    const speed = SPEEDS[state.speedIndex];
    const strikeGap = Math.max(26, 72 / speed);
    const duration = Math.max(100, (170 + distance * .28) / speed);
    const offsets = [-5, 4, 0];

    offsets.forEach((offset, index) => {
      setTimeout(() => {
        const thrust = acquireVisual("enemyProjectile", `enemy-lizard-thrust strike-${index + 1}`, `<i aria-hidden="true"></i><b aria-hidden="true"></b><span aria-hidden="true"></span>`);
        if (thrust) {
          thrust.style.left = `${from.x}px`;
          thrust.style.top = `${from.y}px`;
          thrust.style.width = `${distance}px`;
          thrust.style.setProperty("--lizard-thrust-angle", `${flightAngle}deg`);
          thrust.style.setProperty("--lizard-thrust-offset", `${offset}px`);
          thrust.style.setProperty("--lizard-thrust-duration", `${duration}ms`);
          setTimeout(() => releaseVisual("enemyProjectile", thrust), duration + 70);
        }
        setTimeout(() => lizardThrustImpactAt(to.x, to.y + offset, index + 1), duration * .68);
      }, strikeGap * index);
    });

    setTimeout(onHit, strikeGap * 2 + duration * .78);
  }

  function trollRangedSweep(enemy, onHit) {
    const from = enemyAttackOrigin(enemy);
    const to = enemyWallImpactPoint(enemy);
    const row = Math.min(ROWS - 1, enemyFrontRow(enemy));
    const cellWidth = Math.abs(gridPoint(enemy.col + 1, row).x - gridPoint(enemy.col, row).x) * els.board.clientWidth;
    const duration = Math.max(250, 520 / SPEEDS[state.speedIndex]);
    const fx = acquireVisual("troll", "enemy-troll-sweep", `<svg viewBox="0 0 260 170" preserveAspectRatio="none" aria-hidden="true"><path class="troll-sweep-glow" pathLength="1" d="M 12 10 C 22 158 238 158 248 10"/><path class="troll-sweep-edge" pathLength="1" d="M 12 10 C 22 158 238 158 248 10"/><path class="troll-sweep-inner" pathLength="1" d="M 34 14 C 46 133 214 133 226 14"/></svg>`);
    if (!fx) {
      setTimeout(onHit, duration * .58);
      return;
    }
    fx.style.left = `${from.x}px`;
    fx.style.top = `${from.y}px`;
    fx.style.width = `${Math.max(118, cellWidth * 2.25)}px`;
    fx.style.height = `${Math.max(88, to.y - from.y + 12)}px`;
    fx.style.setProperty("--troll-sweep-duration", `${duration}ms`);
    setTimeout(onHit, duration * .58);
    setTimeout(() => releaseVisual("troll", fx), duration + 90);
  }

  function updateEnemy(enemy, dt) {
    if (enemy.dead) return;
    const wallDistance = ROWS - enemyFrontRow(enemy);
    if (enemy.resolvedAttackRange === null && enemy.stopAtMaxRangeChance !== null && enemy.range > 1 && wallDistance <= enemy.range) {
      const stopsAtMaxRange = Math.random() < enemy.stopAtMaxRangeChance;
      enemy.resolvedAttackRange = stopsAtMaxRange ? enemy.range : Math.max(1, enemy.range - 1);
    }
    const effectiveAttackRange = enemy.resolvedAttackRange ?? enemy.range;
    if (wallDistance > effectiveAttackRange) {
      enemy.moveCooldown -= dt;
      if (enemy.moveCooldown <= 0) {
        const nextRow = enemy.row + 1;
        if (!canEnemyOccupy(enemy, nextRow, enemy.col)) {
          enemy.moveCooldown = Math.min(.4, Math.max(.12, ENEMY_TYPES[enemy.type].moveEvery * .18));
          return;
        }
        removeEnemyFromOccupancy(enemy);
        enemy.row = nextRow;
        addEnemyToIndexes(enemy);
        enemyLayoutDirty = true;
        enemy.moveCooldown += ENEMY_TYPES[enemy.type].moveEvery;
        enemy.el?.animate([{ filter: "brightness(1.45)", scale: "1.08" }, { filter: "none", scale: "1" }], { duration: 300 / SPEEDS[state.speedIndex], easing: "ease-out" });
      }
    } else {
      enemy.attackCooldown -= dt;
      if (enemy.attackCooldown <= 0) {
        enemy.attackCooldown += ENEMY_TYPES[enemy.type].attackEvery;
        enemy.el.classList.add("attacking");
        setTimeout(() => enemy.el?.classList.remove("attacking"), 300);
        const playedAttackAudio = playUnitAttackAudio(enemy.type);
        const attackType = ENEMY_TYPES[enemy.type].attackType;
        if (!playedAttackAudio) {
          if (attackType === "magic" || attackType === "venom") sfx("fireball");
          else if (attackType === "spear") sfx("arrow");
          else sfx("slash");
        }
        if (attackType === "magic" || attackType === "venom") {
          launchEnemyMagicProjectile(enemy, () => resolveEnemyAttack(enemy, playedAttackAudio));
        } else if (attackType === "spear") {
          launchEnemyTripleThrust(enemy, () => resolveEnemyAttack(enemy, playedAttackAudio));
        } else if (enemy.type === "troll" && wallDistance > 1) {
          trollRangedSweep(enemy, () => resolveEnemyAttack(enemy, playedAttackAudio));
        } else {
          resolveEnemyAttack(enemy, playedAttackAudio);
        }
      }
    }
  }

  function renderEnemies() {
    if (!state) return;
    const hasHpChanges = state.enemies.some(enemy => enemy.hpDirty);
    if (!enemyLayoutDirty && !hasHpChanges) return;
    const stacks = new Map();
    for (const enemy of state.enemies) {
      if (enemy.remove || !enemy.el) continue;
      if (enemyLayoutDirty) {
        const key = `${enemy.col}-${enemy.row}-${enemy.footprint}`;
        const index = stacks.get(key) || 0;
        stacks.set(key, index + 1);
        const offsets = [[0,0],[-12,4],[12,7],[-7,-6],[9,-8]];
        const [ox, oy] = offsets[index % offsets.length];
        placeOnGrid(enemy.el, enemy.col, enemy.row, enemy.footprint, enemy.footprint);
        setEnemyDepthScale(enemy);
        setStyleIfChanged(enemy.el, "--row", String(enemyFrontRow(enemy)));
        setStyleIfChanged(enemy.el, "--stack-x", `${ox}%`);
        setStyleIfChanged(enemy.el, "--stack-y", `${oy}%`);
      }
      if (enemy.hpDirty && enemy.hpFill) {
        setStyleIfChanged(enemy.hpFill, "width", `${Math.max(0, enemy.hp / enemy.maxHp * 100)}%`);
        enemy.hpDirty = false;
      }
    }
    enemyLayoutDirty = false;
  }

  function setEnemyDepthScale(enemy) {
    if (!enemy?.el) return;
    const footRow = Math.max(0, Math.min(ENEMY_DEPTH_SCALES.length - 1, enemyFrontRow(enemy)));
    enemy.el.style.setProperty("--depth-scale", ENEMY_DEPTH_SCALES[footRow].toFixed(3));
  }

  function updateDefender(defender, dt) {
    defender.cooldown -= dt;
    if (defender.cooldown > 0) return;
    const def = PLAYER_TYPES[defender.type];
    const targets = findTargets(defender.col, def);
    if (!targets.length) {
      // Do not bank negative cooldown while this lane has no valid target.
      // Otherwise moving a ready defender into an occupied lane repays that
      // accumulated time as one projectile per frame, creating a bullet burst.
      defender.cooldown = 0;
      return;
    }
    defender.cooldown += def.interval;
    defender.el.classList.add("attack");
    setTimeout(() => defender.el?.classList.remove("attack"), 290);
    if (!playDefenderFireAudio(defender.type)) sfx(def.attack);
    if (def.attack === "slash") {
      slashAttack(defender, targets, def);
    } else if (def.attack === "shell") {
      launchProjectile(defender, targets[0], "shell", () => cannonImpact(targets[0], def.splashDamage || def.damage, def.splashArea, defender.type));
    } else {
      launchProjectile(defender, targets[0], def.attack, () => damageEnemy(targets[0], def.damage, defender.type));
    }
  }

  function enemyFrontRow(enemy) {
    return enemy.row + enemy.footprint - 1;
  }

  function enemyCoversCol(enemy, col) {
    return col >= enemy.col && col < enemy.col + enemy.footprint;
  }

  function enemyOverlapsColumns(enemy, minCol, maxCol) {
    return enemy.col <= maxCol && enemy.col + enemy.footprint - 1 >= minCol;
  }

  function enemyOverlapsArea(enemy, minCol, maxCol, minRow, maxRow) {
    return enemyOverlapsColumns(enemy, minCol, maxCol) && enemy.row <= maxRow && enemyFrontRow(enemy) >= minRow;
  }

  function findTargets(col, def) {
    const splashColumns = Math.max(1, def.splashArea?.columns || 1);
    const leftReach = Math.floor((splashColumns - 1) / 2);
    const rightReach = splashColumns - 1 - leftReach;
    const collectColumns = (minCol, maxCol) => {
      const found = new Set();
      for (let lane = Math.max(0, minCol); lane <= Math.min(COLS - 1, maxCol); lane++) {
        enemiesByColumn[lane].forEach(enemy => found.add(enemy));
      }
      return [...found].filter(enemy => !enemy.dead && !enemy.remove && ROWS - enemyFrontRow(enemy) <= def.range);
    };
    let candidates;
    if (def.attack === "slash") candidates = collectColumns(col - leftReach, col + rightReach).filter(e => enemyOverlapsColumns(e, col - leftReach, col + rightReach));
    else if (def.attack === "shell") {
      const same = collectColumns(col, col).filter(e => enemyCoversCol(e, col));
      candidates = same.length ? same : collectColumns(col - leftReach, col + rightReach).filter(e => enemyOverlapsColumns(e, col - leftReach, col + rightReach));
    } else candidates = collectColumns(col, col).filter(e => enemyCoversCol(e, col));
    return candidates.sort((a, b) => enemyFrontRow(b) - enemyFrontRow(a));
  }

  function slashAttack(defender, targets, def) {
    const slashMarkup = `<svg viewBox="0 0 300 180" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="warriorSlashGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ff8b28" stop-opacity="0"/>
          <stop offset=".28" stop-color="#ffc94e" stop-opacity=".82"/>
          <stop offset=".58" stop-color="#fffbd5"/>
          <stop offset=".84" stop-color="#ffb037" stop-opacity=".92"/>
          <stop offset="1" stop-color="#ff7522" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="slash-glow" pathLength="1" d="M 12 170 C 26 -46 274 -46 288 170"/>
      <path class="slash-edge" pathLength="1" d="M 12 170 C 26 -46 274 -46 288 170"/>
      <path class="slash-inner" pathLength="1" d="M 34 171 C 54 -8 246 -8 266 171"/>
    </svg>`;
    const fx = acquireVisual("slash", "slash-sweep", slashMarkup);
    const splashColumns = Math.max(1, def.splashArea?.columns || 1);
    const splashRows = Math.max(1, def.splashArea?.rows || 1);
    const leftReach = Math.floor((splashColumns - 1) / 2);
    const rightReach = splashColumns - 1 - leftReach;
    const minCol = Math.max(0, defender.col - leftReach);
    const maxCol = Math.min(COLS - 1, defender.col + rightReach);
    if (fx) {
      placeOnGrid(fx, minCol, Math.max(0, ROWS - splashRows), maxCol - minCol + 1, splashRows, true);
      setTimeout(() => releaseVisual("slash", fx), 680);
    }
    targets.forEach((target, index) => damageEnemy(target, def.splashDamage || def.damage, defender.type, index === 0));
  }

  function muzzleFlashAt(x, y, kind, angle) {
    if (kind !== "shell" && kind !== "bolt") return;
    const fx = acquireVisual("muzzle", `muzzle-flash ${kind}`, `<i class="muzzle-cone"></i><i class="muzzle-core"></i><i class="muzzle-ring"></i><i class="muzzle-sparks"></i>`);
    if (!fx) return;
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;
    fx.style.setProperty("--muzzle-angle", `${angle}deg`);
    setTimeout(() => releaseVisual("muzzle", fx), kind === "shell" ? 420 : 260);
  }

  function launchProjectile(defender, enemy, kind, onHit) {
    if (!enemy || enemy.dead) return;
    // Projectile origin is visual only. Anchor every corridor slot to the same
    // perspective row so the two outer launchers follow the painted grid axis
    // instead of using a flat, equally-spaced screen coordinate.
    const launcherPoint = gridPoint(defender.col + .5, GAME_RULES.projectileLauncherRow);
    const usesTurretMuzzle = defender.type === "cannon" || defender.type === "ballista";
    const slotLauncherOffsetX = usesTurretMuzzle
      ? Number(GAME_RULES.projectileLauncherSlotOffsetX?.[defender.col]) || 0
      : 0;
    const fromX = launcherPoint.x * els.board.clientWidth + GAME_RULES.projectileLauncherOffsetX + slotLauncherOffsetX;
    const fromY = launcherPoint.y * els.board.clientHeight + GAME_RULES.projectileLauncherOffsetY;
    const targetPoint = gridPoint(enemy.col + enemy.footprint / 2, enemy.row + enemy.footprint / 2);
    const toX = targetPoint.x * els.board.clientWidth;
    const toY = targetPoint.y * els.board.clientHeight;
    const anchorDeltaX = toX - fromX;
    const anchorDeltaY = toY - fromY;
    const flightAngle = Math.atan2(anchorDeltaY, anchorDeltaX) * 180 / Math.PI;
    // Move both the projectile and its firing flare to the same visible barrel
    // tip. The six slot-specific X offsets remain their shared base anchor.
    const muzzleForwardDistance = kind === "shell" ? 42 : kind === "bolt" ? 34 : 0;
    const flightRadians = flightAngle * Math.PI / 180;
    const muzzleX = fromX + Math.cos(flightRadians) * muzzleForwardDistance;
    const muzzleY = fromY + Math.sin(flightRadians) * muzzleForwardDistance;
    const deltaX = toX - muzzleX;
    const deltaY = toY - muzzleY;
    const distance = Math.hypot(deltaX, deltaY);
    const duration = Math.max(80, (180 + distance * .55) / SPEEDS[state.speedIndex]);
    const finishProjectile = () => {
      if (!state.ended) onHit();
      if (kind === "shell") cannonExplosionAt(toX, toY);
      else impactAt(toX, toY, kind === "fireball" ? "#ff7c2e" : "#6ffff0");
    };
    muzzleFlashAt(muzzleX, muzzleY, kind, flightAngle);
    const p = acquireVisual("playerProjectile", `projectile ${kind}`, `<i aria-hidden="true"></i>`);
    if (!p) {
      setTimeout(finishProjectile, duration);
      return;
    }
    p.style.left = `${muzzleX}px`;
    p.style.top = `${muzzleY}px`;
    p.style.setProperty("--flight-angle", `${flightAngle}deg`);
    const anim = p.animate(
      [{ transform: "translate(0,0)" }, { transform: `translate(${deltaX}px,${deltaY}px)` }],
      { duration, easing: kind === "shell" ? "cubic-bezier(.2,.7,.35,1)" : "linear" }
    );
    anim.onfinish = () => {
      releaseVisual("playerProjectile", p);
      finishProjectile();
    };
  }

  function cannonImpact(center, damage, splashArea, sourceType = "cannon") {
    if (!center) return;
    const impactCol = Math.min(COLS - 1, center.col + Math.floor(center.footprint / 2));
    const impactRow = Math.min(ROWS - 1, center.row + Math.floor(center.footprint / 2));
    const areaColumns = Math.max(1, splashArea?.columns || 1);
    const areaRows = Math.max(1, splashArea?.rows || 1);
    const leftReach = Math.floor((areaColumns - 1) / 2);
    const rightReach = areaColumns - 1 - leftReach;
    const topReach = Math.floor((areaRows - 1) / 2);
    const bottomReach = areaRows - 1 - topReach;
    state.enemies
      .filter(e => !e.dead && enemyOverlapsArea(e, impactCol - leftReach, impactCol + rightReach, impactRow - topReach, impactRow + bottomReach))
      .forEach(e => damageEnemy(e, damage, null, false));
    if (!playDefenderHitAudio(sourceType)) sfx("boom");
  }

  function impactAt(x, y, color) {
    const fx = acquireVisual("impact", "impact");
    if (!fx) return;
    fx.style.left = `${x}px`; fx.style.top = `${y}px`; fx.style.setProperty("--impact", color);
    setTimeout(() => releaseVisual("impact", fx), 470);
  }

  function cannonExplosionAt(x, y) {
    const blastSize = Math.max(220, Math.min(320, els.board.clientWidth / COLS * 2.75));
    const debrisCount = lowPowerVisualMode ? 6 : 14;
    const debris = Array.from({ length: debrisCount }, (_, index) => {
      const angle = index * (360 / debrisCount) + (index % 2 ? 6 : -3);
      const distance = -(18 + index % 5 * 6);
      const delay = (index % 4) * 18;
      return `<b style="--debris-angle:${angle}deg;--debris-distance:${distance}%;--debris-delay:${delay}ms"></b>`;
    }).join("");
    const fx = acquireVisual("cannon", "cannon-impact", `<i class="cannon-scorch"></i><i class="cannon-blast-cloud"></i><i class="cannon-blast-core"></i><i class="cannon-shockwave secondary"></i><i class="cannon-shockwave"></i><i class="cannon-debris">${debris}</i>`);
    if (!fx) return;
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;
    fx.style.setProperty("--cannon-blast-size", `${blastSize}px`);
    setTimeout(() => releaseVisual("cannon", fx), 1250);
  }

  function damageEnemy(enemy, amount, sourceType = null, playHitAudio = true) {
    if (!enemy || enemy.dead) return;
    enemy.hp -= amount;
    enemy.hpDirty = true;
    showEnemyHp(enemy);
    enemy.el.classList.add("hit");
    setTimeout(() => enemy.el?.classList.remove("hit"), 250);
    const centerOffset = (enemy.footprint - 1) / 2;
    floatingNumber(enemy.col + centerOffset, enemy.row + centerOffset, amount);
    if (!playHitAudio || !playDefenderHitAudio(sourceType)) {
      if (playHitAudio) sfx("hit");
    }
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function showEnemyHp(enemy) {
    const hpbar = enemy.el?.querySelector(".enemy-hpbar");
    if (!hpbar) return;
    clearTimeout(enemy.hpHideTimer);
    hpbar.classList.add("is-visible");
    enemy.hpHideTimer = setTimeout(() => hpbar.classList.remove("is-visible"), GAME_RULES.hpBarVisibleSeconds * 1000);
  }

  function killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    removeEnemyFromIndexes(enemy);
    state.livingEnemies = Math.max(0, state.livingEnemies - 1);
    state.enemyTypeCounts[enemy.type] = Math.max(0, (state.enemyTypeCounts[enemy.type] || 1) - 1);
    enemyLayoutDirty = true;
    if (selectedEnemyId === enemy.id) selectedEnemyId = null;
    enemy.el.classList.remove("selected");
    state.kills++;
    state.levelKills++;
    const base = ENEMY_TYPES[enemy.type];
    const strengthMultiplier = enemy.maxHp / base.hp;
    const killPoints = Math.max(10, Math.round(base.score * strengthMultiplier / 10) * 10);
    state.killScore += killPoints;
    state.score += killPoints;
    state.coins += enemy.reward;
    enemy.el.classList.add("dead");
    playUnitDeathAudio(enemy.type);
    const centerOffset = (enemy.footprint - 1) / 2;
    coinPop(enemy.col + centerOffset, enemy.row + centerOffset, enemy.reward);
    sfx("coin");
    setTimeout(() => {
      clearTimeout(enemy.hpHideTimer);
      enemy.remove = true;
      enemy.el?.remove();
      enemyLayoutDirty = true;
    }, GAME_RULES.enemyDeathFadeSeconds * 1000);
  }

  function damageWall(amount) {
    if (state.ended) return;
    const hpBefore = state.wallHp;
    state.wallHp = Math.max(0, state.wallHp - amount);
    state.levelDamageTaken += hpBefore - state.wallHp;
    state.wallSafeTime = 0;
    state.defenseScoreBuffer = 0;
    els.wall.classList.remove("hit");
    void els.wall.offsetWidth;
    els.wall.classList.add("hit");
    setTimeout(() => els.wall.classList.remove("hit"), 330);
    const r = els.wall.getBoundingClientRect();
    screenDamageNumber(r.left + r.width * rand(.25,.75), r.top + 10, amount);
  }

  function damageDefendersInEnemyColumns(enemy) {
    const extraColumns = Math.max(0, enemy.splashColumns - enemy.footprint);
    const firstCol = Math.max(0, enemy.col - Math.floor(extraColumns / 2));
    const lastCol = Math.min(COLS - 1, firstCol + enemy.splashColumns - 1);
    for (let col = firstCol; col <= lastCol; col++) {
      if (state.defenders[col]) damageDefender(col, enemy.defenderDamage);
    }
  }

  function showDefenderHp(defender) {
    const hpbar = defender.el?.querySelector(".defender-hpbar");
    if (!hpbar) return;
    const fill = hpbar.querySelector("i");
    if (fill) fill.style.width = `${Math.max(0, defender.hp / defender.maxHp * 100)}%`;
    clearTimeout(defender.hpHideTimer);
    hpbar.classList.add("is-visible");
    defender.hpHideTimer = setTimeout(() => hpbar.classList.remove("is-visible"), GAME_RULES.hpBarVisibleSeconds * 1000);
  }

  function damageDefender(col, amount) {
    const defender = state.defenders[col];
    if (!defender || defender.dead) return;
    defender.hp = Math.max(0, defender.hp - amount);
    showDefenderHp(defender);
    defender.el.animate([{ filter: "brightness(4) saturate(0)" }, { filter: "none" }], { duration: 260 });
    const r = defender.el.getBoundingClientRect();
    screenDamageNumber(r.left + r.width / 2, r.top, amount);
    if (defender.hp <= 0) {
      defender.dead = true;
      defender.el.classList.add("fallen");
      playUnitDeathAudio(defender.type);
      state.defenders[col] = null;
      if (selectedDefender === col) {
        selectedDefender = null;
        defender.el.classList.remove("selected");
        els.recycle.disabled = true;
        showRange(null);
      }
      const deathDuration = GAME_RULES.defenderDeathFadeSeconds * 1000;
      defender.el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(20px) rotate(-12deg) scale(.55)" }], { duration: deathDuration, fill: "forwards" });
      setTimeout(() => {
        clearTimeout(defender.hpHideTimer);
        defender.el.remove();
      }, deathDuration + 20);
      toast(`${PLAYER_TYPES[defender.type].name}陣亡`);
      syncUI();
      syncSlots();
    }
  }

  function floatingNumber(col, row, amount) {
    const point = gridPoint(col + .5, row + .3);
    const x = point.x * els.board.clientWidth;
    const y = point.y * els.board.clientHeight;
    const n = acquireVisual("number", "damage-number");
    if (!n) return;
    n.textContent = `-${amount}`; n.style.left = `${x}px`; n.style.top = `${y}px`;
    setTimeout(() => releaseVisual("number", n), 900);
  }

  function screenDamageNumber(x, y, amount) {
    const n = acquireVisual("number", "damage-number", "", document.body);
    if (!n) return;
    n.textContent = `-${amount}`; n.style.position = "fixed"; n.style.left = `${x}px`; n.style.top = `${y}px`;
    setTimeout(() => releaseVisual("number", n), 900);
  }

  function coinPop(col, row, amount) {
    const point = gridPoint(col + .25, row + .3);
    const n = acquireVisual("coin", "coin-pop");
    if (!n) return;
    n.textContent = `◆ +${amount}`; n.style.left = `${point.x * 100}%`; n.style.top = `${point.y * 100}%`;
    setTimeout(() => releaseVisual("coin", n), 1050);
  }

  function isUnitUnlocked(type) {
    if (!state || !PLAYER_TYPES[type]) return false;
    return state.debugAllUnitsUnlocked || state.level >= (UNIT_UNLOCK_LEVEL[type] || 1);
  }

  function unitLockLabel(type) {
    const level = UNIT_UNLOCK_LEVEL[type] || 1;
    return `第 ${level} 關開放`;
  }

  function configuredDeploymentLimit(unit, level) {
    const raw = unit?.deploymentLimits?.[String(level)];
    if (raw === undefined || raw === null || raw === "") return Infinity;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Infinity;
  }

  function deployedPlayerCount(type) {
    return state?.defenders?.reduce((count, defender) => count + (defender && !defender.dead && defender.type === type ? 1 : 0), 0) || 0;
  }

  function playerDeploymentLimit(type) {
    if (!state || state.debugAllUnitsUnlocked) return Infinity;
    return configuredDeploymentLimit(PLAYER_TYPES[type], state.level);
  }

  function playerDeploymentLimitReached(type) {
    const limit = playerDeploymentLimit(type);
    return Number.isFinite(limit) && deployedPlayerCount(type) >= limit;
  }

  function enemySpawnLimitReached(type) {
    const limit = configuredDeploymentLimit(ENEMY_TYPES[type], state.level);
    return Number.isFinite(limit) && (state.levelSpawnedByType[type] || 0) >= limit;
  }

  function rejectDeploymentAtLimit(type) {
    if (!playerDeploymentLimitReached(type)) return false;
    sfx("deny");
    toast("該兵種已達佈署上限");
    return true;
  }

  function selectCard(type) {
    if (!state || state.ended) return;
    if (!isUnitUnlocked(type)) {
      sfx("deny");
      return toast(unitLockLabel(type));
    }
    if (rejectDeploymentAtLimit(type)) return;
    selectedCard = selectedCard === type ? null : type;
    selectedDefender = null;
    selectedEnemyId = null;
    selectedWall = false;
    els.recycle.disabled = true;
    document.querySelectorAll(".unit-card").forEach(card => card.classList.toggle("selected", card.dataset.type === selectedCard));
    document.querySelectorAll(".defender").forEach(el => el.classList.remove("selected"));
    document.querySelectorAll(".enemy").forEach(el => el.classList.remove("selected"));
    els.wall.classList.remove("selected");
    els.wall.setAttribute("aria-selected", "false");
    showRange(type);
    sfx("click");
  }

  function quickDeploy(type) {
    if (!state || state.ended || state.paused || !state.running) return;
    let targetCol = null;
    for (let col = 0; col < state.openSlots; col++) {
      if (!state.defenders[col]) {
        targetCol = col;
        break;
      }
    }
    // A full corridor intentionally produces no action or extra notification.
    if (targetCol === null) return;
    deploy(type, targetCol);
  }

  function onSlotClick(col) {
    if (!state) return;
    if (state.ended) { clearCharacterSelection(); return; }
    if (state.defenders[col]) { selectDefender(col); return; }
    if (state.paused) { clearCharacterSelection(); return; }
    if (selectedDefender !== null) {
      if (col >= state.openSlots) return toast("這個塔樓位置尚未開放");
      moveDefender(selectedDefender, col);
      return;
    }
    if (selectedCard) deploy(selectedCard, col);
    else clearCharacterSelection();
  }

  function nearestEmptyCorridorSlot(targetCol) {
    const candidates = [];
    for (let col = 0; col < state.openSlots; col++) {
      if (!state.defenders[col]) candidates.push(col);
    }
    candidates.sort((a, b) => Math.abs(a - targetCol) - Math.abs(b - targetCol) || a - b);
    return candidates[0] ?? null;
  }

  function relocateDefenderForDeployment(fromCol, toCol) {
    const defender = state.defenders[fromCol];
    if (!defender || state.defenders[toCol]) return null;
    const targetSlot = els.corridor.querySelector(`[data-col="${toCol}"]`);
    state.defenders[fromCol] = null;
    state.defenders[toCol] = defender;
    defender.col = toCol;
    defender.el.dataset.col = toCol;
    targetSlot.append(defender.el);
    applySprite(defender.el.querySelector(".defender-body"), defender.type, toCol);
    defender.el.animate(
      [
        { transform: `translateX(${toCol > fromCol ? -38 : 38}px) translateY(10px) scale(.8)`, filter: "brightness(1.8)" },
        { transform: "translateX(0) translateY(0) scale(1)", filter: "none" }
      ],
      { duration: 430, easing: "cubic-bezier(.16,1,.3,1)" }
    );
    return defender;
  }

  function deploy(type, col, options = {}) {
    const base = PLAYER_TYPES[type];
    if (!isUnitUnlocked(type)) { sfx("deny"); return toast(unitLockLabel(type)); }
    if (rejectDeploymentAtLimit(type)) return;
    if (col >= state.openSlots) return toast("這個塔樓位置尚未開放");
    let displacedTo = null;
    if (state.defenders[col]) {
      if (!options.displaceOccupied) return toast("此位置已有守軍");
      displacedTo = nearestEmptyCorridorSlot(col);
      if (displacedTo === null) {
        sfx("deny");
        return toast("該位置已滿無法佈署");
      }
    }
    if (state.coins < base.cost) { sfx("deny"); return toast("金幣不足"); }
    const displacedDefender = displacedTo === null ? null : relocateDefenderForDeployment(col, displacedTo);
    state.coins -= base.cost;
    const slot = els.corridor.querySelector(`[data-col="${col}"]`);
    const el = document.createElement("div");
    el.className = `defender ${type}`;
    el.dataset.col = col;
    el.innerHTML = `<div class="defender-body"><span>${base.glyph}</span></div><div class="defender-hpbar" aria-hidden="true"><i></i></div><div class="unit-name-label" aria-hidden="true">${base.name}</div>`;
    applySprite(el.querySelector(".defender-body"), type, col);
    el.addEventListener("pointerdown", beginDefenderDrag, { passive: false });
    el.addEventListener("touchstart", beginDefenderTouchDrag, { passive: false });
    el.addEventListener("click", e => {
      if (drag?.moved) return;
      e.stopPropagation();
      const clickedCol = Number(e.currentTarget.dataset.col);
      selectDefender(clickedCol);
    });
    slot.append(el);
    state.defenders[col] = { type, col, cooldown: rand(.15, .5), hp: base.hp, maxHp: base.hp, dead: false, hpHideTimer: null, el };
    selectedCard = null;
    selectedDefender = null;
    selectedEnemyId = null;
    selectedWall = false;
    document.querySelectorAll(".unit-card").forEach(card => card.classList.remove("selected"));
    document.querySelectorAll(".defender,.enemy").forEach(unit => unit.classList.remove("selected"));
    els.wall.classList.remove("selected");
    els.wall.setAttribute("aria-selected", "false");
    els.recycle.disabled = true;
    showRange(null);
    if (!playDefenderDeployAudio(type)) sfx("deploy");
    if (displacedDefender) {
      toast(`${base.name}已部署，原守軍自動移至第 ${displacedTo + 1} 格`);
    }
    syncUI(); syncSlots();
  }

  function moveDefender(fromCol, toCol) {
    if (fromCol === toCol) return;
    const defender = state.defenders[fromCol];
    if (!defender) return;
    const other = state.defenders[toCol];
    const fromSlot = els.corridor.querySelector(`[data-col="${fromCol}"]`);
    const targetSlot = els.corridor.querySelector(`[data-col="${toCol}"]`);
    state.defenders[fromCol] = other || null;
    state.defenders[toCol] = defender;
    defender.col = toCol;
    defender.el.dataset.col = toCol;
    targetSlot.append(defender.el);
    const movedElements = [defender.el];
    if (other) {
      other.col = fromCol;
      other.el.dataset.col = fromCol;
      fromSlot.append(other.el);
      movedElements.push(other.el);
    }
    applySprite(defender.el.querySelector(".defender-body"), defender.type, toCol);
    if (other) applySprite(other.el.querySelector(".defender-body"), other.type, fromCol);
    movedElements.forEach((el, index) => el.animate(
      [
        { transform: `translateX(${index ? 32 : -32}px) translateY(12px) scale(.76)`, filter: "brightness(2)" },
        { transform: "translateX(0) translateY(0) scale(1)", filter: "none" }
      ],
      { duration: 460, easing: "cubic-bezier(.16,1,.3,1)" }
    ));
    selectedDefender = toCol;
    selectedEnemyId = null;
    selectedWall = false;
    document.querySelectorAll(".defender").forEach(el => el.classList.toggle("selected", Number(el.dataset.col) === toCol));
    document.querySelectorAll(".enemy").forEach(el => el.classList.remove("selected"));
    els.wall.classList.remove("selected");
    els.wall.setAttribute("aria-selected", "false");
    els.recycle.disabled = false;
    showRange(defender.type);
    toast(other ? `第 ${fromCol + 1}、${toCol + 1} 格守軍已互換` : `守軍已移動到第 ${toCol + 1} 格`);
    if (other) {
      if (!playDefenderSwapAudio(defender.type)) sfx("deploy");
    } else {
      if (!playDefenderMoveAudio(defender.type)) sfx("deploy");
    }
    syncSlots();
  }

  function selectDefender(col) {
    selectedDefender = selectedDefender === col ? null : col;
    selectedEnemyId = null;
    selectedWall = false;
    selectedCard = null;
    document.querySelectorAll(".unit-card").forEach(card => card.classList.remove("selected"));
    document.querySelectorAll(".defender").forEach(el => el.classList.toggle("selected", Number(el.dataset.col) === selectedDefender));
    document.querySelectorAll(".enemy").forEach(el => el.classList.remove("selected"));
    els.wall.classList.remove("selected");
    els.wall.setAttribute("aria-selected", "false");
    els.recycle.disabled = selectedDefender === null;
    showRange(selectedDefender === null ? null : state.defenders[selectedDefender]?.type);
    playAttackSample(UNIT_SELECT_AUDIO);
    sfx("click");
  }

  function selectEnemy(enemyId) {
    const enemy = state?.enemies.find(candidate => candidate.id === enemyId && !candidate.dead && !candidate.remove);
    if (!enemy) return;
    selectedEnemyId = selectedEnemyId === enemyId ? null : enemyId;
    selectedDefender = null;
    selectedWall = false;
    selectedCard = null;
    document.querySelectorAll(".unit-card").forEach(card => card.classList.remove("selected"));
    document.querySelectorAll(".defender").forEach(el => el.classList.remove("selected"));
    document.querySelectorAll(".enemy").forEach(el => el.classList.toggle("selected", Number(el.dataset.id) === selectedEnemyId));
    els.wall.classList.remove("selected");
    els.wall.setAttribute("aria-selected", "false");
    els.recycle.disabled = true;
    showRange(null);
    playAttackSample(UNIT_SELECT_AUDIO);
    sfx("click");
  }

  function selectWall() {
    if (!state) return;
    selectedWall = !selectedWall;
    selectedDefender = null;
    selectedEnemyId = null;
    selectedCard = null;
    document.querySelectorAll(".unit-card,.defender,.enemy").forEach(el => el.classList.remove("selected"));
    els.wall.classList.toggle("selected", selectedWall);
    els.wall.setAttribute("aria-selected", String(selectedWall));
    els.recycle.disabled = true;
    showRange(null);
    sfx("click");
  }

  function clearCharacterSelection() {
    if (selectedDefender === null && selectedEnemyId === null && !selectedWall) return;
    selectedDefender = null;
    selectedEnemyId = null;
    selectedWall = false;
    document.querySelectorAll(".defender.selected,.enemy.selected").forEach(el => el.classList.remove("selected"));
    els.wall.classList.remove("selected");
    els.wall.setAttribute("aria-selected", "false");
    els.recycle.disabled = true;
    showRange(null);
  }

  function recycleSelected() {
    if (selectedDefender === null) return;
    const defender = state.defenders[selectedDefender];
    if (!defender) return;
    clearTimeout(defender.hpHideTimer);
    const refund = Math.floor(PLAYER_TYPES[defender.type].cost * GAME_RULES.recycleRefundRate);
    state.coins += refund;
    defender.el.animate([{ opacity:1, transform:"scale(1)" },{ opacity:0, transform:"scale(.2) translateY(30px)" }],{duration:380,easing:"ease-in",fill:"forwards"});
    setTimeout(() => defender.el.remove(), 390);
    state.defenders[selectedDefender] = null;
    defender.el.classList.remove("selected");
    selectedDefender = null;
    els.recycle.disabled = true;
    toast(`回收成功 ◆ +${refund}`);
    sfx("coin"); syncUI(); syncSlots(); showRange(null);
  }

  function showRange(type, previewCol = null) {
    els.rangeLayer.classList.toggle("active", Boolean(type));
    const activeTiles = new Set();
    if (!type) {
      rangeSurfaceTiles.forEach(tile => tile.classList.remove("is-active"));
      return;
    }
    const def = PLAYER_TYPES[type];
    const fallbackCol = selectedDefender !== null ? selectedDefender : Math.floor(COLS / 2);
    const col = Number.isInteger(previewCol) ? previewCol : fallbackCol;
    const minRow = Math.max(0, ROWS - def.range);
    const splashColumns = def.attack === "slash" ? Math.max(1, def.splashArea?.columns || 1) : 1;
    const leftReach = Math.floor((splashColumns - 1) / 2);
    const rightReach = splashColumns - 1 - leftReach;
    const cols = Array.from(
      { length: splashColumns },
      (_, index) => col - leftReach + index
    ).filter(c => c >= 0 && c < COLS && c <= col + rightReach);
    for (let row = minRow; row < ROWS; row++) for (const c of cols) activeTiles.add(`${c}:${row}`);
    rangeSurfaceTiles.forEach((tile, key) => tile.classList.toggle("is-active", activeTiles.has(key)));
  }

  function beginDefenderDrag(e) {
    if (e.pointerType === "touch") return;
    if (!state || state.ended || state.paused || e.button > 0) return;
    e.stopPropagation();
    const fromCol = Number(e.currentTarget.dataset.col);
    const defender = state.defenders[fromCol];
    if (!defender) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag = { type: defender.type, fromCol, moveExisting: true, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, source: e.currentTarget, ghost: null, previewCol: null };
    const onMove = ev => moveDrag(ev);
    const onUp = ev => endDrag(ev, onMove, onUp);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
  }

  function touchById(touchList, id) {
    return [...(touchList || [])].find(touch => touch.identifier === id) || null;
  }

  function beginDefenderTouchDrag(e) {
    if (!state || state.ended || state.paused || e.touches.length !== 1) return;
    const touch = e.changedTouches[0] || e.touches[0];
    if (!touch) return;
    e.preventDefault();
    e.stopPropagation();

    const fromCol = Number(e.currentTarget.dataset.col);
    const defender = state.defenders[fromCol];
    if (!defender) return;
    const touchId = touch.identifier;
    drag = {
      type: defender.type,
      fromCol,
      moveExisting: true,
      input: "touch",
      id: touchId,
      x: touch.clientX,
      y: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      moved: false,
      source: e.currentTarget,
      ghost: null,
      previewCol: null
    };

    const onTouchMove = ev => {
      const activeTouch = touchById(ev.touches, touchId) || touchById(ev.changedTouches, touchId);
      if (!activeTouch || !drag || drag.input !== "touch" || drag.id !== touchId) return;
      ev.preventDefault();
      moveDrag({
        pointerId: touchId,
        clientX: activeTouch.clientX,
        clientY: activeTouch.clientY,
        cancelable: false,
        preventDefault() {}
      });
    };
    const finishTouch = ev => {
      const endedTouch = touchById(ev.changedTouches, touchId);
      if (!endedTouch && ev.type !== "touchcancel") return;
      ev.preventDefault();
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", finishTouch);
      window.removeEventListener("touchcancel", finishTouch);
      if (!drag || drag.input !== "touch" || drag.id !== touchId) return;
      const wasMoved = drag.moved;
      const canceled = ev.type === "touchcancel";
      const clientX = endedTouch?.clientX ?? drag.lastX;
      const clientY = endedTouch?.clientY ?? drag.lastY;
      finishDragAt(clientX, clientY, !canceled);
      if (!canceled && !wasMoved && state.defenders[fromCol]) selectDefender(fromCol);
    };

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", finishTouch, { passive: false });
    window.addEventListener("touchcancel", finishTouch, { passive: false });
  }

  function beginDrag(e, type) {
    if (!state || state.ended || state.paused || e.button > 0) return;
    if (!isUnitUnlocked(type)) {
      e.preventDefault();
      sfx("deny");
      toast(unitLockLabel(type));
      return;
    }
    if (rejectDeploymentAtLimit(type)) {
      e.preventDefault();
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag = { type, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, source: e.currentTarget, ghost: null, previewCol: null };
    const onMove = ev => moveDrag(ev);
    const onUp = ev => endDrag(ev, onMove, onUp);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
  }

  function canDropDraggedUnit(targetCol) {
    if (!drag || !Number.isInteger(targetCol) || targetCol < 0 || targetCol >= state.openSlots) return false;
    if (drag.moveExisting) return targetCol !== drag.fromCol;
    return !state.defenders[targetCol] || nearestEmptyCorridorSlot(targetCol) !== null;
  }

  function corridorDropTargetAt(clientX, clientY) {
    const slots = [...els.corridor.querySelectorAll(".corridor-slot")];
    if (slots.length !== COLS) return null;
    const firstRect = slots[0].getBoundingClientRect();
    const lastRect = slots[slots.length - 1].getBoundingClientRect();
    const corridorTop = Math.min(...slots.map(slot => slot.getBoundingClientRect().top));
    const corridorBottom = Math.max(...slots.map(slot => slot.getBoundingClientRect().bottom));
    const defenderRects = slots
      .map(slot => slot.querySelector(".defender")?.getBoundingClientRect())
      .filter(Boolean);
    const defenderTop = defenderRects.length ? Math.min(...defenderRects.map(rect => rect.top)) : corridorTop;
    const defenderBottom = defenderRects.length ? Math.max(...defenderRects.map(rect => rect.bottom)) : corridorBottom;
    const boardRect = els.board.getBoundingClientRect();
    const bottomRowTop = boardRect.top + gridPoint(0, ROWS - 1).y * boardRect.height;
    const hitTop = Math.min(corridorTop, bottomRowTop, defenderTop);
    const hitBottom = Math.max(corridorBottom, defenderBottom);
    const hitLeft = firstRect.left;
    const hitRight = lastRect.right;
    if (clientY < hitTop || clientY > hitBottom || clientX < hitLeft || clientX > hitRight) return null;
    const col = Math.min(COLS - 1, Math.floor((clientX - hitLeft) / ((hitRight - hitLeft) / COLS)));
    return slots.find(slot => Number(slot.dataset.col) === col) || null;
  }

  function createDragGhost(type, col = null) {
    const ghost = document.createElement("div");
    ghost.className = `drag-ghost ${type}`;
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.setProperty("--drag-sprite", `url("${dragSpritePath(type, col)}")`);

    const slotWidth = els.corridor.querySelector(".corridor-slot")?.getBoundingClientRect().width || 72;
    const deployedScale = type === "warrior" ? 1.932 : 1.722;
    const size = slotWidth * deployedScale;
    ghost.style.width = `${size}px`;
    ghost.style.height = `${size}px`;
    return ghost;
  }

  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (e.cancelable) e.preventDefault();
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    const distance = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    if (distance < 7 && !drag.moved) return;
    if (!drag.ghost) {
      drag.moved = true;
      drag.ghost = createDragGhost(drag.type);
      document.body.append(drag.ghost);
      showRange(null);
    }
    drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
    document.querySelectorAll(".corridor-slot").forEach(s => s.classList.remove("hover"));
    const target = corridorDropTargetAt(e.clientX, e.clientY);
    let nextPreviewCol = null;
    if (target) {
      const targetCol = Number(target.dataset.col);
      if (canDropDraggedUnit(targetCol)) {
        target.classList.add("hover");
        nextPreviewCol = targetCol;
      }
    }
    if (drag.previewCol !== nextPreviewCol) {
      drag.previewCol = nextPreviewCol;
      drag.ghost.style.setProperty("--drag-sprite", `url("${dragSpritePath(drag.type, nextPreviewCol)}")`);
      if (nextPreviewCol === null) showRange(null);
      else showRange(drag.type, nextPreviewCol);
    }
  }

  function endDrag(e, onMove, onUp) {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    finishDragAt(e.clientX, e.clientY, e.type !== "pointercancel");
  }

  function finishDragAt(clientX, clientY, allowDrop = true) {
    if (!drag) return;
    const wasMoved = drag.moved;
    if (wasMoved && allowDrop) {
      const target = corridorDropTargetAt(clientX, clientY);
      if (target) {
        const toCol = Number(target.dataset.col);
        if (canDropDraggedUnit(toCol)) {
          if (drag.moveExisting) moveDefender(drag.fromCol, toCol);
          else deploy(drag.type, toCol, { displaceOccupied: true });
        } else if (!drag.moveExisting && toCol >= 0 && toCol < state.openSlots && state.defenders[toCol]) {
          sfx("deny");
          toast("該位置已滿無法佈署");
        }
      }
    }
    drag.ghost?.remove();
    document.querySelectorAll(".corridor-slot").forEach(s => s.classList.remove("hover"));
    showRange(null);
    const old = drag;
    drag = { moved: wasMoved };
    setTimeout(() => { if (drag?.moved === old.moved) drag = null; }, 0);
  }

  function repairWall() {
    if (state.ended || state.paused) return;
    if (state.wallHp >= WALL_MAX_HP) return toast("城牆目前不需要維修");
    if (state.coins < WALL_CONFIG.repairCost) { sfx("deny"); return toast(`維修需要 ${WALL_CONFIG.repairCost} 金`); }
    state.coins -= WALL_CONFIG.repairCost;
    state.wallHp = Math.min(WALL_MAX_HP, state.wallHp + WALL_CONFIG.repairAmount);
    els.wall.animate([{ filter:"brightness(2.8) saturate(.3)" },{ filter:"none" }],{duration:560,easing:"ease-out"});
    toast(`城牆修復 +${WALL_CONFIG.repairAmount}`); sfx("repair"); syncUI();
  }

  function renderDeckCoins(amount) {
    if (!els.deckCoinPile) return;
    const wholeCoins = Math.max(0, Math.floor(amount));
    const visibleCoins = Math.min(10, wholeCoins);
    const usesStack = wholeCoins > 10;
    const signature = `${visibleCoins}:${usesStack}`;
    if (els.deckCoinPile.dataset.signature === signature) return;
    els.deckCoinPile.dataset.signature = signature;
    els.deckCoinPile.innerHTML = "";
    for (let index = 0; index < visibleCoins; index++) {
      const isStack = usesStack && index === 9;
      const coin = document.createElement("img");
      coin.className = `deck-coin-icon${isStack ? " is-stack" : ""}`;
      coin.src = isStack ? "assets/processed/UI/coin-stack-4-v1.png?v=20260718" : "assets/processed/UI/coin-single-v1.png";
      coin.alt = "";
      coin.draggable = false;
      coin.style.setProperty("--coin-index", index);
      els.deckCoinPile.append(coin);
    }
  }

  function syncWallWarning() {
    const hpRatio = WALL_MAX_HP > 0 ? state.wallHp / WALL_MAX_HP : 0;
    const redWarning = state.wallHp > 0 && hpRatio < WALL_WARNING_RED_RATIO;
    const yellowWarning = state.wallHp > 0 && !redWarning && hpRatio < WALL_WARNING_YELLOW_RATIO;
    els.wall.classList.toggle("wall-warning-yellow", yellowWarning);
    els.wall.classList.toggle("wall-warning-red", redWarning);
    els.wall.dataset.hpWarning = redWarning ? "critical" : yellowWarning ? "low" : "";
  }

  function syncUI(force = false) {
    if (!state) return;
    const levelConfig = LEVEL_CONFIGS[state.level];
    setTextIfChanged(els.levelLabel, state.defenseTimeReached ? "清除剩餘敵人" : "剩餘時間");
    setTextIfChanged(els.levelProgress, `${state.level} / ${TOTAL_LEVELS}關`);
    setTextIfChanged(els.timer, formatTime(Math.ceil(state.secondsLeft)));
    const scoreValue = Math.max(0, Math.floor(state.score));
    setTextIfChanged(els.score, scoreValue.toLocaleString("zh-TW"));
    const scoreDigits = String(Math.min(8, String(scoreValue).length));
    if (els.score.dataset.digits !== scoreDigits) els.score.dataset.digits = scoreDigits;
    if (els.deckCoinText) {
      const coinValue = Math.max(0, Math.floor(state.coins));
      const coinDigits = String(coinValue).length;
      setTextIfChanged(els.deckCoinText, coinValue);
      const digits = String(Math.min(6, coinDigits));
      if (els.deckCoinText.dataset.digits !== digits) els.deckCoinText.dataset.digits = digits;
    }
    renderDeckCoins(state.coins);
    setStyleIfChanged(els.wallHpFill, "width", `${state.wallHp / WALL_MAX_HP * 100}%`);
    setTextIfChanged(els.wallHpText, `${Math.ceil(state.wallHp)} / ${WALL_MAX_HP}`);
    syncWallWarning();
    if (els.repairAmount) setTextIfChanged(els.repairAmount, `維修 +${WALL_CONFIG.repairAmount}`);
    if (els.repairCost) setTextIfChanged(els.repairCost, WALL_CONFIG.repairCost);
    if (els.recycle) setTextIfChanged(els.recycle, `回收 ${Math.round(GAME_RULES.recycleRefundRate * 100)}%`);
    setTextIfChanged(els.unlock, `已開放 ${state.openSlots} / ${COLS} 格`);
    setStyleIfChanged(els.threat, "width", `${(1 - state.secondsLeft / levelConfig.duration) * 100}%`);
    setTextIfChanged(els.speed, `×${SPEEDS[state.speedIndex]}`);
    els.speedDown.disabled = state.speedIndex <= 0;
    els.speedUp.disabled = state.speedIndex >= SPEEDS.length - 1;
    setTextIfChanged(els.pauseSpeed, `×${SPEEDS[state.speedIndex]}`);
    if (els.pauseSpeedDown) els.pauseSpeedDown.disabled = state.speedIndex <= 0;
    if (els.pauseSpeedUp) els.pauseSpeedUp.disabled = state.speedIndex >= SPEEDS.length - 1;
    setTextIfChanged(els.pause, state.paused ? "▶" : "Ⅱ");
    Object.entries(PLAYER_TYPES).forEach(([type, def]) => {
      const card = unitCardCache.get(type);
      if (!card) return;
      const unlocked = isUnitUnlocked(type);
      const deployed = deployedPlayerCount(type);
      const limit = playerDeploymentLimit(type);
      const limitReached = unlocked && playerDeploymentLimitReached(type);
      const countLabel = card.querySelector("[data-deployment-count]");
      setTextIfChanged(countLabel, `${deployed}/${Number.isFinite(limit) ? limit : "∞"}`);
      card.classList.toggle("unit-locked", !unlocked);
      card.classList.toggle("cant-afford", unlocked && !limitReached && state.coins < def.cost);
      card.classList.toggle("limit-reached", limitReached);
      card.dataset.lockLabel = unlocked ? "" : unitLockLabel(type);
      card.dataset.limitLabel = limitReached ? "已達上限" : "";
      card.setAttribute("aria-disabled", String(!unlocked || limitReached));
    });
    if (els.unlockAllUnits) {
      els.unlockAllUnits.textContent = state.debugAllUnitsUnlocked ? "單位全開 ON" : "全部開放";
      els.unlockAllUnits.setAttribute("aria-pressed", String(state.debugAllUnitsUnlocked));
      els.unlockAllUnits.classList.toggle("is-on", state.debugAllUnitsUnlocked);
      els.unlockAllUnits.classList.toggle("is-off", !state.debugAllUnitsUnlocked);
    }
    syncSlots(force);
  }

  function syncSlots(force = false) {
    if (!state) return;
    const signature = String(state.openSlots);
    if (!force && els.corridor.dataset.slotSignature === signature) return;
    els.corridor.dataset.slotSignature = signature;
    els.corridor.querySelectorAll(".corridor-slot").forEach(slot => {
      const col = Number(slot.dataset.col);
      slot.classList.toggle("locked", col >= state.openSlots);
      slot.disabled = col >= state.openSlots;
    });
  }

  function levelIncludesEnemy(level, enemyType) {
    const config = LEVEL_CONFIGS[level];
    return Number(config?.weight?.[enemyType] || 0) > 0 && Number(config?.unlock?.[enemyType] ?? 2) < 1;
  }

  function chooseIntermissionTip(nextLevel) {
    const wallRatio = WALL_MAX_HP > 0 ? state.wallHp / WALL_MAX_HP : 0;
    const repairTip = INTERMISSION_TIPS.find(tip => tip.lowWallOnly);
    if (wallRatio < .5 && repairTip) return repairTip;

    const eligible = INTERMISSION_TIPS.filter(tip => {
      if (tip.lowWallOnly) return false;
      if (tip.desktopOnly && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return false;
      if (tip.minLevel && nextLevel < tip.minLevel) return false;
      if (tip.enemy && !levelIncludesEnemy(nextLevel, tip.enemy)) return false;
      return true;
    });
    const fresh = eligible.filter(tip => !state.shownTipIds.includes(tip.id));
    const pool = fresh.length ? fresh : eligible;
    const chosen = pool[Math.floor(Math.random() * pool.length)] || INTERMISSION_TIPS[1];
    if (!state.shownTipIds.includes(chosen.id)) state.shownTipIds.push(chosen.id);
    return chosen;
  }

  function hideResultTip() {
    els.result.classList.remove("level-complete");
    els.resultTip.hidden = true;
    els.resultTipText.textContent = "";
  }

  function endGame(won) {
    if (state.ended) return;
    const performance = won ? awardLevelPerformance(state.level) : null;
    state.ended = true; state.running = false;
    hideResultTip();
    resultAction = "restart";
    els.restart.textContent = "再玩一次";
    els.restart.disabled = false;
    els.resultKicker.textContent = won ? "黎明到來" : `第${levelDisplayName(state.level)}關戰線失守`;
    els.resultTitle.textContent = won ? "五關防守成功" : "遊戲失敗";
    els.resultSubtitle.textContent = won
      ? `最終關表現 +${performance.bonus.toLocaleString("zh-TW")}｜總分 ${Math.floor(state.score).toLocaleString("zh-TW")}`
      : `你的堡壘被攻破了｜總分 ${Math.floor(state.score).toLocaleString("zh-TW")}`;
    els.resultKills.textContent = state.kills;
    els.resultTime.textContent = formatTime(Math.floor(state.elapsed));
    setTimeout(() => els.result.classList.add("show"), 300);
    sfx(won ? "victory" : "defeat");
  }

  function completeLevel() {
    const totalLevels = Object.keys(LEVEL_CONFIGS).length;
    if (!state.running || state.level >= totalLevels) return;
    const completedLevel = state.level;
    const nextLevel = completedLevel + 1;
    const performance = awardLevelPerformance(completedLevel);
    const intermissionTip = chooseIntermissionTip(nextLevel);
    state.running = false;
    state.paused = true;
    resultAction = "next-level";
    els.resultKicker.textContent = `第${levelDisplayName(completedLevel)}關完成`;
    els.resultTitle.textContent = `第${levelDisplayName(nextLevel)}關`;
    const durationHint = nextLevel >= 4 ? "｜本關防守時間延長為 05:00" : "｜準備迎接更強的敵軍";
    els.resultSubtitle.textContent = `本關表現 +${performance.bonus.toLocaleString("zh-TW")}${durationHint}`;
    els.resultKills.textContent = state.kills;
    els.resultTime.textContent = formatTime(LEVEL_CONFIGS[completedLevel].duration);
    els.result.classList.add("level-complete");
    els.resultTipTitle.textContent = "守城提示";
    els.resultTipText.textContent = intermissionTip.text;
    els.resultTip.hidden = false;
    els.restart.textContent = "繼續開始";
    els.restart.disabled = false;
    setTimeout(() => els.result.classList.add("show"), 260);
    sfx("victory");
  }

  async function startNextLevel() {
    const totalLevels = Object.keys(LEVEL_CONFIGS).length;
    if (!state || state.level >= totalLevels || resultAction !== "next-level") return;
    const nextLevel = state.level + 1;
    els.restart.disabled = true;
    els.result.classList.remove("show");
    hideResultTip();
    state.enemies.forEach(enemy => {
      clearTimeout(enemy.hpHideTimer);
      enemy.el?.remove();
    });
    state.enemies = [];
    state.livingEnemies = 0;
    state.enemyTypeCounts = Object.create(null);
    state.levelSpawnedByType = Object.create(null);
    resetEnemyIndexes();
    resetVisualEffects();
    state.pendingSpawn = null;
    state.level = nextLevel;
    state.secondsLeft = LEVEL_CONFIGS[nextLevel].duration;
    state.spawnCooldown = 1.2;
    state.levelKills = 0;
    state.levelSpawned = 0;
    state.levelDamageTaken = 0;
    state.wallSafeTime = 0;
    state.defenseScoreBuffer = 0;
    state.defenseTimeReached = false;
    state.clearPhaseElapsed = 0;
    state.paused = false;
    state.ended = false;
    selectedCard = null;
    selectedDefender = null;
    selectedEnemyId = null;
    selectedWall = false;
    els.wall.classList.remove("selected");
    els.wall.setAttribute("aria-selected", "false");
    showRange(null);
    syncUI();
    const countdownLabels = [`第${levelDisplayName(nextLevel)}關`];
    if (nextLevel >= 4) countdownLabels.push("防守時間延長為 05:00");
    countdownLabels.push("3", "2", "1", "繼續防守!");
    await playCountdown(countdownLabels);
    resultAction = "restart";
    els.restart.disabled = false;
    state.running = true;
    syncPageFocus();
    lastFrame = performance.now();
  }

  function awardLevelPerformance(level) {
    if (state.awardedLevels.includes(level)) return state.levelBonuses[level];
    const rule = SCORE_RULES.levelPerformance[level];
    const wallPreservation = Math.max(0, 1 - state.levelDamageTaken / WALL_MAX_HP);
    const clearance = state.levelSpawned > 0 ? Math.min(1, state.levelKills / state.levelSpawned) : 1;
    const parts = {
      clear: rule.clear,
      wall: Math.round(rule.wallPreservation * wallPreservation),
      clearance: Math.round(rule.clearance * clearance),
      flawless: state.levelDamageTaken === 0 ? rule.flawless : 0
    };
    const bonus = parts.clear + parts.wall + parts.clearance + parts.flawless;
    const result = { level, bonus, parts, wallPreservation, clearance };
    state.awardedLevels.push(level);
    state.levelBonuses[level] = result;
    state.performanceScore += bonus;
    state.score += bonus;
    return result;
  }

  function handleResultAction() {
    if (resultAction === "resume") resumePausedGame();
    else if (resultAction === "next-level") startNextLevel();
    else beginGame();
  }

  function currentLevelPerformancePreview() {
    const rule = SCORE_RULES.levelPerformance[state.level];
    const levelConfig = LEVEL_CONFIGS[state.level];
    const progress = state.defenseTimeReached
      ? 1
      : Math.max(0, Math.min(1, 1 - state.secondsLeft / levelConfig.duration));
    const wallPreservation = Math.max(0, 1 - state.levelDamageTaken / WALL_MAX_HP);
    const clearance = state.levelSpawned > 0 ? Math.min(1, state.levelKills / state.levelSpawned) : 1;
    const parts = {
      clear: Math.round(rule.clear * progress),
      wall: Math.round(rule.wallPreservation * wallPreservation * progress),
      clearance: Math.round(rule.clearance * clearance * progress),
      flawless: state.levelDamageTaken === 0 ? Math.round(rule.flawless * progress) : 0
    };
    return { bonus: parts.clear + parts.wall + parts.clearance + parts.flawless, parts, progress, wallPreservation };
  }

  function showPauseMenu() {
    const preview = currentLevelPerformancePreview();
    state.paused = true;
    resultAction = "resume";
    hideResultTip();
    els.resultKicker.textContent = `第${levelDisplayName(state.level)}關防守中`;
    els.resultTitle.textContent = "遊戲暫停";
    els.resultSubtitle.textContent = `當前表現預估 +${preview.bonus.toLocaleString("zh-TW")}｜目前總分 ${Math.floor(state.score).toLocaleString("zh-TW")}`;
    els.resultKills.textContent = state.kills;
    els.resultTime.textContent = formatTime(Math.floor(state.elapsed));
    els.resultTipTitle.textContent = "當前表現";
    els.resultTipText.textContent = `本關進度 ${Math.round(preview.progress * 100)}%｜城牆保存 ${Math.round(preview.wallPreservation * 100)}%｜繼續防守後分數會依戰況更新。`;
    els.resultTip.hidden = false;
    els.restart.textContent = "繼續防守";
    els.restart.disabled = false;
    els.result.classList.add("show", "pause-menu");
    syncUI();
    sfx("click");
  }

  function resumePausedGame() {
    if (!state || state.ended || resultAction !== "resume") return;
    els.result.classList.remove("show", "pause-menu");
    hideResultTip();
    resultAction = "restart";
    state.paused = false;
    syncUI();
    sfx("click");
    toast("繼續防守");
  }

  function togglePause() {
    if (!state || state.ended || !state.running) return;
    if (state.paused && resultAction === "resume") resumePausedGame();
    else if (!state.paused) showPauseMenu();
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isStandaloneDisplay() {
    return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isMobileGameDevice() {
    return window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;
  }

  function isBlockedMobileLandscape() {
    return isMobileGameDevice() && window.innerWidth > window.innerHeight;
  }

  async function tryLockPortrait() {
    if (!screen.orientation?.lock) return;
    try { await screen.orientation.lock("portrait-primary"); }
    catch { /* Browsers may only allow orientation lock in installed/fullscreen mode. */ }
  }

  function syncFullscreenUI() {
    const active = Boolean(fullscreenElement()) || isStandaloneDisplay();
    document.body.classList.toggle("mobile-fullscreen-active", active);
    if (!els.fullscreen) return;
    els.fullscreen.classList.toggle("is-active", active);
    els.fullscreen.setAttribute("aria-pressed", String(active));
    els.fullscreen.setAttribute("aria-label", active ? "退出全螢幕" : "進入全螢幕");
  }

  async function toggleMobileFullscreen() {
    if (fullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) await Promise.resolve(exit.call(document)).catch(() => {});
      try { screen.orientation?.unlock?.(); } catch { /* Orientation unlock is optional. */ }
      return;
    }
    if (isStandaloneDisplay()) {
      toast("目前已是全螢幕模式");
      await tryLockPortrait();
      return;
    }
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) {
      toast("此瀏覽器不支援網頁全螢幕；可加入主畫面後啟動");
      return;
    }
    try {
      await Promise.resolve(request.call(root));
      await tryLockPortrait();
    } catch {
      toast("無法進入全螢幕；請確認瀏覽器允許此功能");
    }
  }

  function syncSystemPause() {
    const shouldPause = orientationPauseActive || focusPauseActive;
    if (shouldPause) {
      if (state?.running && !state.ended && !state.paused) {
        state.paused = true;
        resumeAfterSystemPause = true;
        syncUI();
      }
      els.bgm?.pause();
      stopAttackAudio();
      return;
    }
    if (resumeAfterSystemPause) {
      resumeAfterSystemPause = false;
      if (state?.running && !state.ended) {
        state.paused = false;
        syncUI();
      }
    }
    if (gameHasStarted && bgmEnabled && !muted) startBgm();
  }

  function syncPageFocus() {
    focusPauseActive = document.hidden || !document.hasFocus();
    syncSystemPause();
  }

  function syncOrientationGuard() {
    const blocked = isBlockedMobileLandscape();
    orientationPauseActive = blocked;
    document.body.classList.toggle("orientation-blocked", blocked);
    els.orientationGuard?.setAttribute("aria-hidden", String(!blocked));
    syncSystemPause();
  }

  function setSpeedIndex(nextIndex) {
    if (!state) return;
    nextIndex = Math.max(0, Math.min(SPEEDS.length - 1, nextIndex));
    if (nextIndex === state.speedIndex) return;
    state.speedIndex = nextIndex;
    syncUI(); sfx("click"); toast(`遊戲速度 ×${SPEEDS[state.speedIndex]}`);
  }

  function adjustSpeed(direction) {
    if (!state) return;
    setSpeedIndex(state.speedIndex + direction);
  }

  function resetSpeed() {
    setSpeedIndex(0);
  }

  function toast(message, duration = 1850) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = message; els.toast.append(t); setTimeout(() => t.remove(), duration);
  }

  function ensureAudio() {
    if (audio) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audio = new Ctx();
  }

  function createAttackAudio(path) {
    const sound = new Audio(path);
    sound.preload = "auto";
    return sound;
  }

  function ensureAttackAudioPool(path) {
    if (!attackAudioPools.has(path)) {
      attackAudioPools.set(path, { sounds: [createAttackAudio(path)], cursor: 0 });
    }
    return attackAudioPools.get(path);
  }

  function preloadAttackAudio() {
    const samples = Object.values(UNIT_AUDIO_CONFIGS).flatMap(config => [
      ...(config?.cast?.files || []),
      ...(config?.attack || []),
      ...(config?.impact || []),
      ...(config?.death || []),
      ...(config?.deploy || []),
      ...(config?.move || []),
      ...(config?.swap || [])
    ]);
    new Set([...samples.map(sample => sample.path), UNIT_SELECT_AUDIO.path]).forEach(path => ensureAttackAudioPool(path));
  }

  function playAttackSample(sample) {
    if (muted || !sample) return;
    const now = performance.now();
    const lastPlayed = audioLastPlayedAt.get(sample.path) || -Infinity;
    if (now - lastPlayed < PERFORMANCE.audioRetriggerMs) return;
    const pool = ensureAttackAudioPool(sample.path);
    let sound = pool.sounds.find(candidate => candidate.paused || candidate.ended);
    const maxVoices = lowPowerVisualMode ? 3 : 5;
    if (!sound && pool.sounds.length < maxVoices) {
      sound = createAttackAudio(sample.path);
      pool.sounds.push(sound);
    }
    if (!sound) return;
    audioLastPlayedAt.set(sample.path, now);
    sound.currentTime = 0;
    sound.volume = Math.max(0, Math.min(1, sample.volume ?? 1));
    sound.play()?.catch(() => {});
  }

  function stopAttackAudio() {
    attackAudioPools.forEach(pool => pool.sounds.forEach(sound => {
      sound.pause();
      sound.currentTime = 0;
    }));
  }

  function playRandomAudioSample(samples) {
    if (!samples?.length) return false;
    playAttackSample(samples[Math.floor(Math.random() * samples.length)]);
    return true;
  }

  function playConfiguredAudioChannel(config, channel, fallbackMode = "random") {
    if (!config) return false;
    const samples = channel === "cast" ? config.cast?.files : config[channel];
    if (!samples?.length) return false;
    const configuredMode = channel === "cast" ? config.cast?.mode : config[`${channel}Mode`];
    const mode = configuredMode === "all" || configuredMode === "random" ? configuredMode : fallbackMode;
    if (mode === "all") {
      samples.forEach(playAttackSample);
      return true;
    }
    return playRandomAudioSample(samples);
  }

  function playUnitAttackAudio(type) {
    const config = UNIT_AUDIO_CONFIGS[type];
    if (!config) return false;
    const played = playConfiguredAudioChannel(config, "attack", "random");
    const cast = config.cast;
    if (cast?.files?.length && Math.random() < (cast.chance || 0)) playConfiguredAudioChannel(config, "cast", "random");
    return played;
  }

  function playUnitImpactAudio(type) {
    return playConfiguredAudioChannel(UNIT_AUDIO_CONFIGS[type], "impact", "all");
  }

  function playUnitDeathAudio(type) {
    return playConfiguredAudioChannel(UNIT_AUDIO_CONFIGS[type], "death", "random");
  }

  function playDefenderFireAudio(type) {
    return playUnitAttackAudio(type);
  }

  function playDefenderHitAudio(type) {
    return playUnitImpactAudio(type);
  }

  function playDefenderDeployAudio(type) {
    return playConfiguredAudioChannel(UNIT_AUDIO_CONFIGS[type], "deploy", "random");
  }

  function playDefenderMoveAudio(type) {
    return playConfiguredAudioChannel(UNIT_AUDIO_CONFIGS[type], "move", "random");
  }

  function playDefenderSwapAudio(type) {
    return playConfiguredAudioChannel(UNIT_AUDIO_CONFIGS[type], "swap", "random");
  }

  function showBgmError() {
    if (bgmErrorShown) return;
    bgmErrorShown = true;
    toast("BGM 載入失敗：請確認 assets/audio/幽城深階.mp3");
  }

  function startBgm() {
    if (!bgmEnabled || muted || !els.bgm || document.hidden || !document.hasFocus() || orientationPauseActive) return;
    els.bgm.loop = true;
    els.bgm.volume = .38;
    const playback = els.bgm.play();
    playback?.catch(showBgmError);
  }

  function syncAudioUI() {
    els.mute.textContent = muted ? "×" : "♪";
    els.mute.setAttribute("aria-pressed", String(!muted));
    els.mute.setAttribute("aria-label", muted ? "開啟音樂與音效" : "關閉音樂與音效");
    els.mute.title = muted ? "開啟音樂與音效" : "關閉音樂與音效";
    if (els.pauseMute) {
      els.pauseMute.textContent = muted ? "♪ OFF" : "♪ ON";
      els.pauseMute.setAttribute("aria-pressed", String(!muted));
      els.pauseMute.setAttribute("aria-label", muted ? "開啟音樂與音效" : "關閉音樂與音效");
    }
  }

  function toggleGlobalAudio() {
    ensureAudio();
    muted = !muted;
    if (muted) {
      els.bgm?.pause();
      stopAttackAudio();
    } else {
      if (audio?.state === "suspended") audio.resume().catch(() => {});
      if (gameHasStarted && bgmEnabled) startBgm();
    }
    syncAudioUI();
    toast(muted ? "音樂與音效：OFF" : "音樂與音效：ON");
  }

  function syncBgmUI() {
    els.bgmToggle.textContent = bgmEnabled ? "BGM ON" : "BGM OFF";
    els.bgmToggle.setAttribute("aria-pressed", String(bgmEnabled));
    els.bgmToggle.classList.toggle("is-on", bgmEnabled);
    els.bgmToggle.classList.toggle("is-off", !bgmEnabled);
  }

  function syncCollisionUI() {
    els.unitLayer.classList.toggle("show-collision", showEnemyCollision);
    els.collisionToggle.textContent = showEnemyCollision ? "Collision ON" : "Collision OFF";
    els.collisionToggle.setAttribute("aria-pressed", String(showEnemyCollision));
    els.collisionToggle.classList.toggle("is-on", showEnemyCollision);
    els.collisionToggle.classList.toggle("is-off", !showEnemyCollision);
  }

  function toggleEnemyCollision() {
    showEnemyCollision = !showEnemyCollision;
    syncCollisionUI();
    toast(showEnemyCollision ? "敵方 Collision：ON" : "敵方 Collision：OFF");
  }

  function syncGridUI() {
    els.tileLayer.classList.toggle("hide-grid-lines", !showBoardGrid);
    els.gridToggle.textContent = showBoardGrid ? "Grid ON" : "Grid OFF";
    els.gridToggle.setAttribute("aria-pressed", String(showBoardGrid));
    els.gridToggle.classList.toggle("is-on", showBoardGrid);
    els.gridToggle.classList.toggle("is-off", !showBoardGrid);
  }

  function toggleBoardGrid() {
    showBoardGrid = !showBoardGrid;
    syncGridUI();
    toast(showBoardGrid ? "棋盤格框線：ON" : "棋盤格框線：OFF");
  }

  function toggleAllUnitsDebug() {
    if (!state) return;
    state.debugAllUnitsUnlocked = !state.debugAllUnitsUnlocked;
    if (!state.debugAllUnitsUnlocked && selectedCard && !isUnitUnlocked(selectedCard)) {
      selectedCard = null;
      showRange(null);
    }
    syncUI();
    toast(state.debugAllUnitsUnlocked ? "Debug：所有守軍單位已開放" : "Debug：恢復關卡解鎖限制");
  }

  function setDebugCoins() {
    if (!state) return;
    state.coins = 1000;
    syncUI();
    sfx("coin");
    toast("Debug：金幣已設為 1,000");
  }

  function toggleBgm() {
    bgmEnabled = !bgmEnabled;
    if (bgmEnabled) {
      if (gameHasStarted && !muted) startBgm();
    } else {
      els.bgm.pause();
    }
    syncBgmUI();
    toast(bgmEnabled ? (muted ? "背景音樂：ON（總聲音目前關閉）" : "背景音樂：ON") : "背景音樂：OFF");
  }

  function setDebugMenu(open) {
    els.debugMenu.hidden = !open;
    els.debug.setAttribute("aria-expanded", String(open));
  }

  function placementSpriteVariant(type, col = null) {
    if ((type !== "cannon" && type !== "ballista") || !Number.isInteger(col) || col < 0 || col >= COLS) return type;
    return `${type}-slot${col + 1}`;
  }

  function placementSpritePath(type, col = null) {
    const variant = placementSpriteVariant(type, col);
    return perspectiveSpriteCache.get(variant)
      || PERSPECTIVE_SPRITE_PATHS[variant]
      || spriteCache.get(type)
      || SPRITE_PATHS[type];
  }

  function dragSpritePath(type, col = null) {
    if (Number.isInteger(col) && col >= 0 && col < COLS) return placementSpritePath(type, col);
    return dragNeutralSpriteCache.get(type)
      || DRAG_NEUTRAL_SPRITE_PATHS[type]
      || spriteCache.get(type)
      || SPRITE_PATHS[type];
  }

  function applySprite(target, type, col = null) {
    const path = placementSpritePath(type, col);
    if (!target || !path) return;
    target.classList.add("has-sprite");
    target.style.setProperty("--sprite", `url("${path}")`);
    target.dataset.spriteVariant = placementSpriteVariant(type, col);
    target.dataset.spritePerspective = Number.isInteger(col) && col <= 1 ? "left" : Number.isInteger(col) && col >= COLS - 2 ? "right" : "center";
    const glyph = target.querySelector("span");
    if (glyph) glyph.style.visibility = "hidden";
  }

  function applyIcon(target, type) {
    if (!target || !iconCache.has(type)) return;
    target.classList.add("has-sprite", "has-icon");
    target.style.setProperty("--sprite", `url("${iconCache.get(type)}")`);
    const glyph = target.querySelector("span");
    if (glyph) glyph.style.visibility = "hidden";
  }

  async function loadSprites() {
    const loadSet = (paths, cache) => Object.entries(paths).map(([type, path]) => new Promise(resolve => {
      const image = new Image();
      image.onload = () => { cache.set(type, path); resolve(); };
      image.onerror = resolve;
      image.src = path;
    }));
    const jobs = [
      ...loadSet(SPRITE_PATHS, spriteCache),
      ...loadSet(PERSPECTIVE_SPRITE_PATHS, perspectiveSpriteCache),
      ...loadSet(DRAG_NEUTRAL_SPRITE_PATHS, dragNeutralSpriteCache),
      ...loadSet(ICON_PATHS, iconCache)
    ];
    await Promise.all(jobs);
    document.querySelectorAll(".unit-card").forEach(card => applyIcon(card.querySelector(".card-icon"), card.dataset.type));
    document.querySelectorAll(".game-unit").forEach(el => applySprite(el.querySelector(".body"), el.classList[2]));
    document.querySelectorAll(".defender").forEach(el => applySprite(el.querySelector(".defender-body"), state?.defenders[Number(el.dataset.col)]?.type, Number(el.dataset.col)));
  }

  function tone(freq, duration=.1, type="sine", volume=.05, slide=0) {
    if (!audio || muted) return;
    const o = audio.createOscillator(); const g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), audio.currentTime + duration);
    g.gain.setValueAtTime(0.0001, audio.currentTime); g.gain.exponentialRampToValueAtTime(volume, audio.currentTime + .008); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration + .02);
  }

  function noise(duration=.15, volume=.06) {
    if (!audio || muted) return;
    const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
    const data = buffer.getChannelData(0); for (let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
    const src = audio.createBufferSource(); const g = audio.createGain(); src.buffer=buffer; g.gain.value=volume; src.connect(g).connect(audio.destination); src.start();
  }

  function sfx(kind) {
    if (!audio || muted) return;
    const cooldown = RAPID_SFX.has(kind) ? (kind === "boom" ? 90 : 45) : 0;
    const key = `sfx:${kind}`;
    const now = performance.now();
    if (cooldown && now - (audioLastPlayedAt.get(key) || -Infinity) < cooldown) return;
    if (cooldown) audioLastPlayedAt.set(key, now);
    const table = {
      click:()=>tone(520,.06,"triangle",.035,80), count:()=>tone(240,.16,"square",.055,80), start:()=>{tone(280,.3,"sawtooth",.04,500);setTimeout(()=>tone(560,.32,"triangle",.05,500),100)},
      deploy:()=>{tone(180,.12,"triangle",.05,220);setTimeout(()=>tone(440,.18,"sine",.045,180),70)}, unlock:()=>{[420,560,740].forEach((f,i)=>setTimeout(()=>tone(f,.18,"sine",.04,110),i*80))},
      fireball:()=>tone(180,.22,"sawtooth",.04,420), arrow:()=>tone(980,.07,"triangle",.025,-500), slash:()=>{noise(.12,.025);tone(300,.13,"sawtooth",.03,-180)},
      shell:()=>tone(110,.18,"square",.045,-55), boom:()=>{noise(.34,.09);tone(80,.28,"sawtooth",.06,-35)}, bolt:()=>tone(720,.045,"square",.018,-300),
      hit:()=>tone(150,.045,"square",.018,-45), wall:()=>{noise(.1,.035);tone(95,.12,"square",.035,-35)}, coin:()=>{tone(880,.08,"sine",.035,220);setTimeout(()=>tone(1210,.1,"sine",.03,180),65)},
      repair:()=>{noise(.06,.02);tone(420,.09,"square",.025,90);setTimeout(()=>tone(620,.15,"triangle",.035,180),100)}, deny:()=>tone(110,.13,"sawtooth",.04,-35),
      victory:()=>[330,440,550,660].forEach((f,i)=>setTimeout(()=>tone(f,.4,"triangle",.05,100),i*140)), defeat:()=>{tone(190,.7,"sawtooth",.055,-120);setTimeout(()=>noise(.5,.05),180)}
    };
    table[kind]?.();
  }

  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function rand(a,b){ return a + Math.random() * (b-a); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function weightedChoice(items, getWeight) {
    const total = items.reduce((sum, item) => sum + Math.max(0, getWeight(item) || 0), 0);
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= Math.max(0, getWeight(item) || 0);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }
  function levelDisplayName(level) { return ["零", "一", "二", "三", "四", "五"][level] || String(level); }
  function formatTime(total) { total = Math.max(0, Math.floor(total)); return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }

  function isKeyboardInputTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input,textarea,select,[contenteditable='true']"));
  }

  function clearTransientGameplayFocus() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches(".corridor-slot,.unit-card")) active.blur();
  }

  function selectDefenderByHotkey(col) {
    if (!state || state.ended || state.paused || !state.running || !state.defenders[col]) return false;
    if (selectedDefender !== col) selectDefender(col);
    return true;
  }

  function handleGameHotkeys(e) {
    if (isKeyboardInputTarget(e.target) || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (e.code === "Escape") {
      setDebugMenu(false);
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (!gameHasStarted || !state || state.ended) return;

    const numberMatch = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
    if (numberMatch) {
      clearTransientGameplayFocus();
      if (selectDefenderByHotkey(Number(numberMatch[1]) - 1)) e.preventDefault();
      return;
    }

    if (e.code === "KeyA") {
      e.preventDefault();
      clearTransientGameplayFocus();
      adjustSpeed(-1);
    } else if (e.code === "KeyD") {
      e.preventDefault();
      clearTransientGameplayFocus();
      adjustSpeed(1);
    } else if (e.code === "KeyS") {
      e.preventDefault();
      clearTransientGameplayFocus();
      resetSpeed();
    } else if (e.code === "KeyF") {
      e.preventDefault();
      clearTransientGameplayFocus();
      repairWall();
    } else if (e.code === "KeyZ") {
      const defender = selectedDefender === null ? null : state.defenders[selectedDefender];
      if (!defender || state.paused || !state.running) return;
      e.preventDefault();
      clearTransientGameplayFocus();
      recycleSelected();
    }
  }

  els.continue.addEventListener("click", beginGame);
  els.restart.addEventListener("click", handleResultAction);
  els.repair.addEventListener("click", repairWall);
  els.recycle.addEventListener("click", recycleSelected);
  els.pause.addEventListener("click", togglePause);
  els.fullscreen?.addEventListener("click", toggleMobileFullscreen);
  els.speedDown.addEventListener("click", () => adjustSpeed(-1));
  els.speedUp.addEventListener("click", () => adjustSpeed(1));
  els.mute.addEventListener("click", toggleGlobalAudio);
  els.pauseSpeedDown?.addEventListener("click", () => adjustSpeed(-1));
  els.pauseSpeedUp?.addEventListener("click", () => adjustSpeed(1));
  els.pauseMute?.addEventListener("click", toggleGlobalAudio);
  els.debug.addEventListener("click", e => { e.stopPropagation(); setDebugMenu(els.debugMenu.hidden); });
  els.debugMenu.addEventListener("click", e => e.stopPropagation());
  els.bgmToggle.addEventListener("click", toggleBgm);
  els.collisionToggle.addEventListener("click", toggleEnemyCollision);
  els.gridToggle.addEventListener("click", toggleBoardGrid);
  els.unlockAllUnits.addEventListener("click", toggleAllUnitsDebug);
  els.debugCoins.addEventListener("click", setDebugCoins);
  els.wall.addEventListener("click", e => {
    if (e.target instanceof Element && e.target.closest("button")) return;
    e.stopPropagation();
    selectWall();
  });
  els.wall.addEventListener("keydown", e => {
    if (e.target !== els.wall || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    e.stopPropagation();
    selectWall();
  });
  els.bgm.addEventListener("error", () => { if (gameHasStarted && bgmEnabled && !muted) showBgmError(); });
  document.addEventListener("click", e => {
    setDebugMenu(false);
    if (!(e.target instanceof Element)) return;
    if (e.target.closest("button,.unit-card,.defender,.enemy,.debug-menu")) return;
    clearCharacterSelection();
  });
  window.addEventListener("keydown", handleGameHotkeys);
  document.addEventListener("visibilitychange", syncPageFocus);
  window.addEventListener("blur", syncPageFocus);
  window.addEventListener("focus", syncPageFocus);
  document.addEventListener("fullscreenchange", syncFullscreenUI);
  document.addEventListener("webkitfullscreenchange", syncFullscreenUI);
  window.addEventListener("orientationchange", () => setTimeout(() => { syncOrientationGuard(); detectLowPowerVisualMode(); }, 80));
  window.addEventListener("resize", () => { syncOrientationGuard(); detectLowPowerVisualMode(); }, { passive: true });

  resetGame();
  syncAudioUI();
  syncBgmUI();
  syncCollisionUI();
  syncGridUI();
  syncFullscreenUI();
  syncPageFocus();
  syncOrientationGuard();
  preloadAttackAudio();
  loadSprites();
})();
