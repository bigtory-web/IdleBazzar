"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const prepPanel = document.getElementById("prepPanel");
const prepTitle = document.getElementById("prepTitle");
const goldText = document.getElementById("goldText");
const shopOffers = document.getElementById("shopOffers");
const shopDetail = document.getElementById("shopDetail");
const unitDetail = document.getElementById("unitDetail");
const stashDock = document.getElementById("stashDock");
const stashTrack = document.getElementById("stashTrack");
const pauseButton = document.getElementById("pauseButton");
const speedButton = document.getElementById("speedButton");
const rerollButton = document.getElementById("rerollButton");
const startWaveButton = document.getElementById("startWaveButton");
const resultPanel = document.getElementById("resultPanel");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const restartButton = document.getElementById("restartButton");
const gameToast = document.getElementById("gameToast");
const battleStatus = document.getElementById("battleStatus");
const sellButton = document.getElementById("sellButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const SLOT_COUNT = 10;
const SLOT_WIDTH = WIDTH / SLOT_COUNT;
const BOARD_Y = 1430;
const BOARD_HEIGHT = HEIGHT - BOARD_Y;
const WALL_Y = 1324;
const MAX_WALL_HP = 40;
const MAX_WALL_SHIELD = 45;
const SHIELD_DECAY_PER_SECOND = 3;
const WALL_RECOVERY_AFTER_WAVE = 8;
const MAX_STATUS_STACK = 12;
const FIRE_TICK_INTERVAL = 0.75;
const FIRE_DURATION = 5;
const FROST_DURATION = 2.4;
const MAX_FROST_STACK = 4;
const FROST_SLOW_PER_STACK = 0.12;
const MAX_FROST_SLOW = 0.45;
const MAX_MULTICAST = 3;
const MULTICAST_POWER_SCALE = 0.7;
const REPEATED_SPLIT_POWER_SCALE = 0.55;
const AMMO_BY_SIZE = [0, 2, 3, 4];
const ENRAGE_TIME = 90;
const STARTING_COINS = 4;
const MAX_WAVES = 8;
const MAX_TIER = 3;

function compactNumber(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
const WAVE_ENEMY_SCALE = [0.22, 0.36, 0.54, 0.7, 0.9, 1.08, 1.22, 1.36];
const FINAL_BOSS_ID = "maou_마왕의검";
const ACTOR_SCALE = 0.7;
const MONSTER_VISUAL_SCALE = 1.2;
const SIZE_LABELS = ["", "S", "M", "L"];
const TIER_NAMES = ["", "브론즈", "실버", "골드"];
const TIER_COLORS = [
  null,
  { fill: "#87563f", stroke: "#d99a6a", glow: "rgba(217, 154, 106, 0.24)" },
  { fill: "#4f718b", stroke: "#a9ddf5", glow: "rgba(169, 221, 245, 0.3)" },
  { fill: "#a67a25", stroke: "#ffe274", glow: "rgba(255, 226, 116, 0.42)" },
];
const STAT_LABELS = { direct: "타격", fire: "화염", frost: "냉기", wind: "바람", shield: "보호막", split: "산탄", pierce: "관통", explode: "폭발", multicast: "다중시전" };
const STAT_ICONS = { direct: "⚔️", fire: "🔥", frost: "❄️", wind: "💨", shield: "🛡️", split: "✦", pierce: "➶", explode: "💥", multicast: "✦" };
const SHOT_LABELS = { straight: "직선탄", homing: "유도탄" };
const FAMILY_COLORS = {
  슬라임: "#73d36b",
  고블린: "#d8ad50",
  오크: "#ef8f4a",
  뱀파이어: "#a86be0",
  드레이크: "#ed6b52",
  거미여왕: "#d65b9d",
  "물의 정령": "#55bfe8",
  마왕: "#7f6a9e",
};
const RANGED_MONSTER_IDS = new Set([
  "slime_점액탄",
  "slime_점액구체",
  "slime_대형점액탄",
  "goblin_단검투척",
  "goblin_독침",
  "goblin_화약탄",
  "orc_화약방패",
  "orc_전쟁도끼",
  "orc_강철방패",
  "vamp_피의채찍",
  "drake_용염",
  "drake_드래곤불꽃",
  "drake_용의숨결",
  "spider_거미송곳",
  "spider_독거미줄",
  "spider_여왕의거미집",
  "water_물방울정령",
  "water_물결채찍",
  "water_파도사역마",
  "water_물의제단",
  "water_해일",
  "maou_마왕의손가락",
  "maou_마왕의불꽃",
  "maou_마왕의저주",
]);

function cardPalette(card) {
  const stats = card.stats;
  if (stats.fire) return ["#ff825c", "#6b2b35"];
  if (stats.frost) return ["#7fd7ff", "#2c5b86"];
  if (stats.wind) return ["#64cce8", "#285277"];
  if (stats.shield) return ["#70aee8", "#344c78"];
  if (stats.explode) return ["#ffba5a", "#74442e"];
  if (stats.pierce) return ["#d6a6ff", "#4a3568"];
  return ["#efc05c", "#4d4934"];
}

function normalizePlayerCard(card) {
  const [color, accent] = cardPalette(card);
  const projectile = card.tags.includes("총")
    ? "gun"
    : card.stats.explode
      ? "cannon"
      : card.stats.fire
      ? "ember"
      : card.stats.frost || card.stats.wind
        ? "arcane"
        : "bolt";
  return {
    ...card,
    short: card.name,
    tag: card.tags.join("/"),
    color,
    accent,
    projectile,
    projectileSpeed: card.tags.includes("총") ? 790 : card.tags.includes("무기") ? 740 : 650,
  };
}

const unitTypes = Object.fromEntries(CARD_CATALOG.map((card) => [card.id, normalizePlayerCard(card)]));

function baseStat(card, key) {
  return card.stats[key]?.[0] || 0;
}

function normalizeMonsterCard(card) {
  const isFinalBoss = card.id === FINAL_BOSS_ID;
  const attackMode = RANGED_MONSTER_IDS.has(card.id) ? "ranged" : "melee";
  const sizeHp = [0, 18, 42, 88][card.size];
  const power = baseStat(card, "direct");
  const attackPower = baseStat(card, "direct");
  const shield = Math.round(baseStat(card, "shield") * 0.7);
  // 문서에는 몬스터 HP·이동 속도·반경이 없으므로 아래 값만 전투용 튜닝으로 계산한다.
  return {
    ...card,
    hp: isFinalBoss ? 500 : sizeHp + power * 1.4,
    speed: isFinalBoss ? 12 : [0, 58, 44, 31][card.size],
    radius: Math.round((isFinalBoss ? 108 : [0, 27, 38, 52][card.size]) * ACTOR_SCALE),
    damage: isFinalBoss ? 6 : Math.max(card.size, Math.ceil(attackPower * 0.22)),
    attackMode,
    attackRange: attackMode === "ranged" ? 220 + card.size * 25 : 0,
    attackInterval: isFinalBoss ? 4.8 : Math.max(2.4, card.cooldown * 0.55),
    projectileSpeed: 420,
    color: FAMILY_COLORS[card.family],
    kind: isFinalBoss ? "boss" : card.family,
    role: isFinalBoss ? "마왕 · 최종 보스" : `${card.family} · ${card.name}`,
    shield,
  };
}

const enemyTypes = Object.fromEntries(
  MONSTER_CARD_CATALOG.map((card) => [card.id, normalizeMonsterCard(card)]),
);

const waveProfiles = [
  { family: "슬라임", entries: [["slime_점액탄", 3], ["slime_끈적한발톱", 3], ["slime_점액구체", 1], ["slime_분열슬라임", 1], ["slime_대형점액탄", 1]] },
  { family: "고블린", entries: [["goblin_단검투척", 3], ["goblin_독침", 3], ["goblin_약탈단검", 1], ["goblin_화약탄", 1], ["goblin_약탈자의검", 1]] },
  { family: "오크", entries: [["orc_전투도끼", 4], ["orc_화약방패", 3], ["orc_전쟁도끼", 1], ["orc_강철방패", 1], ["orc_오크파괴자", 1]] },
  { family: "뱀파이어", entries: [["vamp_흡혈박쥐", 4], ["vamp_뱀파이어송곳니", 4], ["vamp_피의채찍", 1], ["vamp_흡혈군주", 1], ["vamp_피의왕좌", 1]] },
  { family: "드레이크", entries: [["drake_화염비늘", 4], ["drake_용의발톱", 4], ["drake_용염", 2], ["drake_드래곤불꽃", 1], ["drake_용의숨결", 1]] },
  { family: "거미여왕", entries: [["spider_독실거미", 4], ["spider_거미송곳", 4], ["spider_독거미줄", 2], ["spider_거미군단", 2], ["spider_여왕의거미집", 1]] },
  { family: "물의 정령", entries: [["water_물방울정령", 5], ["water_물결채찍", 4], ["water_파도사역마", 2], ["water_물의제단", 2], ["water_해일", 1]] },
  { family: "마왕", entries: [["maou_마왕의손가락", 5], ["maou_절망의칼날", 5], ["maou_마왕의불꽃", 2], ["maou_마왕의저주", 2], [FINAL_BOSS_ID, 1]] },
];

let uidCounter = 1;
let state;
let lastTimestamp = performance.now();
let hoveredBoardUid = null;
let pinnedBoardUid = null;
let messageTimer = null;
let messageHideTimer = null;
let pendingSellUid = null;
let pendingSellTimer = null;
let lastPopoverRefresh = 0;

function createInitialState() {
  const starter = createUnit("dagger", 1, 4);
  starter.isStarter = true;
  return {
    phase: "prep",
    wave: 0,
    coins: STARTING_COINS,
    baseHp: MAX_WALL_HP,
    wallShield: 0,
    wallFlash: 0,
    board: [starter],
    stash: [],
    selected: { location: "board", uid: starter.uid },
    shop: [],
    selectedShopIndex: null,
    shopOutcomes: [],
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    effects: [],
    nextWavePlan: [],
    spawnQueue: [],
    spawnRemaining: 0,
    waveTotalSpawns: 0,
    wavePendingAdds: 0,
    spawnTimer: 0,
    waveStartHp: MAX_WALL_HP,
    waveStartCoins: STARTING_COINS,
    waveWallDamage: 0,
    waveBlockedDamage: 0,
    killGoldMeter: 0,
    lastWaveReport: null,
    elapsed: 0,
    combatTime: 0,
    enraged: false,
    kills: 0,
    paused: false,
    speed: 1,
    hasHiredAny: false,
  };
}

function createUnit(typeId, tier = 1, start = 0) {
  const type = unitTypes[typeId];
  const ammoMax = type.tags.includes("총") ? AMMO_BY_SIZE[type.size] : 0;
  return {
    uid: uidCounter++,
    typeId,
    tier,
    start,
    cooldownLeft: Math.random() * 0.35,
    waveDamage: 0,
    totalDamage: 0,
    combatBonus: {},
    ammo: ammoMax,
    ammoMax,
    windTimer: 0,
    buffFlash: 0,
    buffLabel: "",
    buffLabelTimer: 0,
    attackPulse: 0,
    isStarter: false,
  };
}

function typeFor(unit) {
  return unitTypes[unit.typeId];
}

function objectParticle(word) {
  const lastCode = word.charCodeAt(word.length - 1);
  const hasBatchim = lastCode >= 0xac00 && lastCode <= 0xd7a3 && (lastCode - 0xac00) % 28 !== 0;
  return hasBatchim ? "을" : "를";
}

function unitSize(unit) {
  return typeFor(unit).size;
}

function findFirstFit(units, size, ignoreUid = null) {
  for (let start = 0; start <= SLOT_COUNT - size; start += 1) {
    if (canPlace(units, start, size, ignoreUid)) return start;
  }
  return -1;
}

function canPlace(units, start, size, ignoreUid = null) {
  if (start < 0 || start + size > SLOT_COUNT) return false;
  return units.every((unit) => {
    if (unit.uid === ignoreUid) return true;
    const unitEnd = unit.start + unitSize(unit);
    const desiredEnd = start + size;
    return desiredEnd <= unit.start || start >= unitEnd;
  });
}

function selectedUnit() {
  if (!state.selected) return null;
  const list = state.selected.location === "board" ? state.board : state.stash;
  return list.find((unit) => unit.uid === state.selected.uid) || null;
}

function locationForUnit(unit) {
  if (state.board.includes(unit)) return "board";
  if (state.stash.includes(unit)) return "stash";
  return null;
}

function mergeCandidates(typeId, tier, excludeUid = null) {
  return [
    ...state.board.map((unit) => ({ unit, location: "board" })),
    ...state.stash.map((unit) => ({ unit, location: "stash" })),
  ]
    .filter(({ unit }) => unit.typeId === typeId && unit.tier === tier && unit.uid !== excludeUid)
    .sort((a, b) => (a.location === b.location ? a.unit.uid - b.unit.uid : a.location === "board" ? -1 : 1));
}

function removeOwnedUnit(unit) {
  const list = locationForUnit(unit) === "board" ? state.board : state.stash;
  const index = list.indexOf(unit);
  if (index >= 0) list.splice(index, 1);
}

function mergeOwnedPair(first, second) {
  if (!first || !second || first.typeId !== second.typeId || first.tier !== second.tier || first.tier >= MAX_TIER) {
    return first || null;
  }
  const ordered = [first, second].sort((a, b) => {
    const aLocation = locationForUnit(a);
    const bLocation = locationForUnit(b);
    if (aLocation !== bLocation) return aLocation === "board" ? -1 : 1;
    return a.uid - b.uid;
  });
  const survivor = ordered[0];
  const consumed = ordered[1];
  survivor.tier += 1;
  survivor.waveDamage += consumed.waveDamage;
  survivor.totalDamage += consumed.totalDamage;
  survivor.cooldownLeft = Math.min(survivor.cooldownLeft, consumed.cooldownLeft, 0.25);
  survivor.windTimer = Math.max(survivor.windTimer, consumed.windTimer);
  removeOwnedUnit(consumed);
  return survivor;
}

function mergePurchasedCopy(typeId) {
  const firstMatch = mergeCandidates(typeId, 1)[0]?.unit;
  if (!firstMatch || firstMatch.tier >= MAX_TIER) return null;

  let survivor = firstMatch;
  survivor.tier += 1;
  survivor.isStarter = false;
  survivor.cooldownLeft = Math.min(survivor.cooldownLeft, 0.25);
  while (survivor.tier < MAX_TIER) {
    const nextMatch = mergeCandidates(typeId, survivor.tier, survivor.uid)[0]?.unit;
    if (!nextMatch) break;
    survivor = mergeOwnedPair(survivor, nextMatch);
  }
  return survivor;
}

function hasTag(unit, tag) {
  return !!unit && typeFor(unit).tags.includes(tag);
}

function adjacentUnits(unit) {
  const left = unit.start;
  const right = unit.start + unitSize(unit);
  return state.board.filter((other) => {
    if (other.uid === unit.uid) return false;
    const otherLeft = other.start;
    const otherRight = other.start + unitSize(other);
    return otherRight === left || otherLeft === right;
  });
}

function leftUnit(unit) {
  return state.board.find((other) => other.start + unitSize(other) === unit.start) || null;
}

function nearestOtherUnit(unit) {
  const center = unit.start + unitSize(unit) / 2;
  return state.board
    .filter((other) => other.uid !== unit.uid)
    .sort((a, b) => {
      const aDistance = Math.abs(a.start + unitSize(a) / 2 - center);
      const bDistance = Math.abs(b.start + unitSize(b) / 2 - center);
      return aDistance - bDistance || a.uid - b.uid;
    })[0] || null;
}

function nearestOtherUnits(unit, count = 1, predicate = () => true) {
  const center = unit.start + unitSize(unit) / 2;
  return state.board
    .filter((other) => other.uid !== unit.uid && predicate(other))
    .sort((a, b) => {
      const aDistance = Math.abs(a.start + unitSize(a) / 2 - center);
      const bDistance = Math.abs(b.start + unitSize(b) / 2 - center);
      return aDistance - bDistance || a.uid - b.uid;
    })
    .slice(0, count);
}

function countBoardTag(tag) {
  return state.board.filter((unit) => hasTag(unit, tag)).length;
}

function countOtherBoardTag(unit, tag) {
  return state.board.filter((other) => other.uid !== unit.uid && hasTag(other, tag)).length;
}

function tierChoice(unit, values) {
  return values[Math.max(0, Math.min(values.length - 1, unit.tier - 1))];
}

function tierStatValue(type, key, tier) {
  const [base = 0, add = 0] = type.stats[key] || [];
  return Math.round((base + add * (tier - 1)) * 10) / 10;
}

function statFor(unit, key) {
  return tierStatValue(typeFor(unit), key, unit.tier) + (unit.combatBonus[key] || 0);
}

function statsFor(unit) {
  const type = typeFor(unit);
  const stats = {
    direct: statFor(unit, "direct"),
    fire: statFor(unit, "fire"),
    frost: statFor(unit, "frost"),
    shield: statFor(unit, "shield"),
    wind: statFor(unit, "wind"),
    split: statFor(unit, "split"),
    pierce: statFor(unit, "pierce"),
    explode: statFor(unit, "explode"),
    multicast: statFor(unit, "multicast"),
    cooldown: type.cooldown,
  };
  return {
    ...stats,
    multicast: Math.min(MAX_MULTICAST, stats.multicast),
    casts: Math.max(1, 1 + Math.min(MAX_MULTICAST, stats.multicast)),
  };
}

function oneWayShopLink(wanterId, providerId) {
  const provider = unitTypes[providerId];
  if (!provider || wanterId === providerId) return 0;
  const wanter = unitTypes[wanterId];
  if (wanter.tags.includes("총") && provider.reload) return 1.5;
  if (wanter.tags.includes("사역마") && provider.tags.includes("총")) return 0.35;
  if (wanter.shot && provider.tags.includes("사역마")) return 0.45;
  return wanter.tags.some((tag) => provider.tags.includes(tag)) ? 0.3 : 0;
}

function shopPairSynergy(firstId, secondId) {
  return Math.min(2, oneWayShopLink(firstId, secondId) + oneWayShopLink(secondId, firstId));
}

function weightedOffer(unlocked, excluded, ownedUnits) {
  const candidates = unlocked.filter((id) => !excluded.has(id));
  const ownedIds = new Set(ownedUnits.map((unit) => unit.typeId));
  const ownedTags = new Set(ownedUnits.flatMap((unit) => typeFor(unit).tags));
  const ownedEffects = new Set(ownedUnits.flatMap((unit) => {
    const type = typeFor(unit);
    return Object.keys(type.stats).filter((key) => tierStatValue(type, key, unit.tier) > 0);
  }));
  const weighted = candidates.map((id) => {
    const type = unitTypes[id];
    const hasSharedTag = type.tags.some((tag) => ownedTags.has(tag));
    const hasSharedEffect = Object.keys(type.stats)
      .some((key) => key !== "direct" && tierStatValue(type, key, 1) > 0 && ownedEffects.has(key));
    const linkScore = Math.min(2, ownedUnits.reduce((total, unit) => total + shopPairSynergy(id, unit.typeId), 0));
    const weight = 1
      + (ownedIds.has(id) ? 2.4 : 0)
      + (hasSharedTag ? 0.35 : 0)
      + (hasSharedEffect ? 0.45 : 0)
      + linkScore * 0.9;
    return { id, weight };
  });
  let roll = Math.random() * weighted.reduce((total, entry) => total + entry.weight, 0);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return weighted[weighted.length - 1]?.id || candidates[0];
}

function weightedPlanForWave(wave) {
  const profile = waveProfiles[wave - 1];
  const plan = [];
  for (const [typeId, count] of profile.entries) {
    for (let i = 0; i < count; i += 1) {
      plan.push({ typeId, lane: typeId === FINAL_BOSS_ID ? 4 : Math.floor(Math.random() * SLOT_COUNT) });
    }
  }
  const boss = plan.find((entry) => entry.typeId === FINAL_BOSS_ID);
  const regular = plan.filter((entry) => entry.typeId !== FINAL_BOSS_ID);
  for (let i = regular.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [regular[i], regular[j]] = [regular[j], regular[i]];
  }
  return boss ? [...regular, boss] : regular;
}

function rollShop() {
  if (state.wave === 0 && state.shop.length === 0) {
    state.shop = ["fire_sword", "fire_gun", "wind_sprite"];
    state.selectedShopIndex = null;
    state.shopOutcomes = [];
    renderPrep();
    return;
  }
  const maxSize = state.wave < 1 ? 1 : state.wave < 4 ? 2 : 3;
  const unlocked = Object.keys(unitTypes).filter((id) => unitTypes[id].size <= maxSize);
  const ownedUnits = [...state.board, ...state.stash].filter((unit) => !unit.isStarter);
  const offers = [];
  while (offers.length < 3) {
    const id = weightedOffer(unlocked, new Set(offers), ownedUnits);
    if (id) offers.push(id);
  }
  state.shop = offers;
  state.selectedShopIndex = null;
  state.shopOutcomes = [];
  renderPrep();
}

function setMessage(message, tone = "info") {
  if (!gameToast || !message) return;
  if (messageTimer) clearTimeout(messageTimer);
  if (messageHideTimer) clearTimeout(messageHideTimer);
  gameToast.textContent = message;
  gameToast.dataset.tone = tone;
  gameToast.hidden = false;
  gameToast.classList?.remove("show");
  void gameToast.offsetWidth;
  gameToast.classList?.add("show");
  messageTimer = setTimeout(() => {
    gameToast.classList?.remove("show");
    messageHideTimer = setTimeout(() => {
      gameToast.hidden = true;
    }, 180);
    messageHideTimer?.unref?.();
  }, 1800);
  messageTimer?.unref?.();
}

function resetPendingSale() {
  if (pendingSellTimer) clearTimeout(pendingSellTimer);
  pendingSellUid = null;
  pendingSellTimer = null;
}

function refreshBattleStatus(prefix = "") {
  const remaining = state.enemies.length + state.spawnRemaining + state.wavePendingAdds;
  const summary = state.phase === "combat"
    ? `웨이브 ${state.wave}, 성벽 HP ${compactNumber(state.baseHp)}/${MAX_WALL_HP}, 보호막 ${Math.ceil(state.wallShield)}, 남은 적 ${remaining}`
    : `성벽 HP ${compactNumber(state.baseHp)}/${MAX_WALL_HP}`;
  canvas.setAttribute("aria-label", `전투 화면. ${summary}`);
  if (battleStatus && prefix) battleStatus.textContent = `${prefix}. ${summary}`;
}

function sellRefund(unit) {
  const copyValue = 2 ** Math.max(0, unit.tier - 1);
  return Math.floor(typeFor(unit).cost * copyValue * 0.5);
}

function refreshStashControls() {
  const locked = state.phase !== "prep";
  stashDock.classList?.toggle("is-locked", locked);
  const unit = selectedUnit();
  if (locked || !unit || pendingSellUid !== null && pendingSellUid !== unit.uid) resetPendingSale();
  if (sellButton) {
    const refund = unit ? sellRefund(unit) : 0;
    const armed = !!unit && pendingSellUid === unit.uid;
    const label = locked
      ? "전투 중에는 판매할 수 없습니다"
      : !unit
        ? "판매할 캐릭터를 선택하세요"
        : armed
          ? `${typeFor(unit).name} 판매 확정`
          : refund > 0
            ? `${typeFor(unit).name} 판매, ${refund}골드 획득`
            : `${typeFor(unit).name} 폐기`;
    sellButton.disabled = locked || !unit;
    sellButton.classList.toggle("is-armed", armed);
    sellButton.setAttribute("aria-label", label);
    sellButton.title = label;
  }
}

function sellSelectedUnit() {
  if (state.phase !== "prep") return;
  const unit = selectedUnit();
  if (!unit) {
    setMessage("판매할 캐릭터를 먼저 선택하세요.", "bad");
    return;
  }
  const type = typeFor(unit);
  const refund = sellRefund(unit);
  if (pendingSellUid !== unit.uid) {
    resetPendingSale();
    pendingSellUid = unit.uid;
    setMessage(`${type.name}${objectParticle(type.name)} 판매하려면 한 번 더 누르세요.`, "bad");
    pendingSellTimer = setTimeout(() => {
      resetPendingSale();
      refreshStashControls();
    }, 2500);
    pendingSellTimer?.unref?.();
    refreshStashControls();
    return;
  }
  resetPendingSale();
  removeOwnedUnit(unit);
  state.coins += refund;
  state.selected = null;
  pinnedBoardUid = null;
  hoveredBoardUid = null;
  refreshUnitPopover();
  setMessage(refund > 0 ? `${type.name} 판매: +${refund}G` : `${type.name}을 폐기했습니다.`, refund > 0 ? "good" : "info");
  renderPrep();
}

function buyUnit(typeId, offerIndex) {
  if (state.phase !== "prep" || state.shop[offerIndex] !== typeId) return;
  const type = unitTypes[typeId];
  if (state.coins < type.cost) {
    setMessage("골드가 부족합니다.", "bad");
    return;
  }

  if (mergeCandidates(typeId, 1).length > 0) {
    state.coins -= type.cost;
    const mergedUnit = mergePurchasedCopy(typeId);
    const location = locationForUnit(mergedUnit);
    state.selected = { location, uid: mergedUnit.uid };
    state.shopOutcomes[offerIndex] = { kind: "upgrade", typeId, tier: mergedUnit.tier };
    state.shop[offerIndex] = null;
    state.selectedShopIndex = null;
    state.hasHiredAny = true;
    setMessage(`${type.name} 두 장을 ${mergedUnit.tier}등급으로 합성했습니다.`, "good");
    renderPrep();
    return;
  }

  let destination = state.board;
  let start = findFirstFit(destination, type.size);
  let location = "board";
  if (start < 0) {
    destination = state.stash;
    start = findFirstFit(destination, type.size);
    location = "stash";
  }

  if (start < 0) {
    setMessage("전투판과 창고에 연속된 빈칸이 없습니다.", "bad");
    return;
  }

  state.coins -= type.cost;
  const unit = createUnit(typeId, 1, start);
  destination.push(unit);
  state.selected = { location, uid: unit.uid };
  state.shopOutcomes[offerIndex] = { kind: "hired", typeId, tier: 1 };
  state.shop[offerIndex] = null;
  state.selectedShopIndex = null;
  state.hasHiredAny = true;
  setMessage(`${type.name}${objectParticle(type.name)} ${location === "board" ? "전투판" : "창고"}에 영입했습니다.`, "good");
  renderPrep();
}

function moveSelectedOnBoard(slot) {
  const unit = selectedUnit();
  if (!unit || state.phase !== "prep") return;

  if (state.selected.location === "board") {
    if (!canPlace(state.board, slot, unitSize(unit), unit.uid)) {
      const clicked = state.board.find((candidate) => slot >= candidate.start && slot < candidate.start + unitSize(candidate));
      if (clicked && clicked.uid !== unit.uid) {
        const others = state.board.filter((candidate) => candidate.uid !== unit.uid && candidate.uid !== clicked.uid);
        const selectedStart = unit.start;
        const clickedStart = clicked.start;
        const swappedRangesDoNotOverlap =
          clickedStart + unitSize(unit) <= selectedStart || selectedStart + unitSize(clicked) <= clickedStart;
        if (
          swappedRangesDoNotOverlap &&
          canPlace(others, clickedStart, unitSize(unit)) &&
          canPlace(others, selectedStart, unitSize(clicked))
        ) {
          unit.start = clickedStart;
          clicked.start = selectedStart;
          setMessage(`${typeFor(unit).name}과 ${typeFor(clicked).name}의 위치를 교환했습니다.`, "good");
          renderPrep();
        } else {
          state.selected = { location: "board", uid: clicked.uid };
          setMessage("크기가 달라 바로 교환할 수 없어 다른 카드를 선택했습니다.");
          renderPrep();
        }
      } else {
        setMessage("해당 위치에는 배치할 수 없습니다.", "bad");
      }
      return;
    }
    unit.start = slot;
    setMessage(`${typeFor(unit).name}의 전투 위치를 변경했습니다.`, "good");
  } else {
    if (!canPlace(state.board, slot, unitSize(unit))) {
      const clicked = state.board.find((candidate) => slot >= candidate.start && slot < candidate.start + unitSize(candidate));
      if (clicked) state.selected = { location: "board", uid: clicked.uid };
      else setMessage("해당 위치에는 배치할 수 없습니다.", "bad");
      renderPrep();
      return;
    }
    state.stash.splice(state.stash.indexOf(unit), 1);
    unit.start = slot;
    state.board.push(unit);
    state.selected = { location: "board", uid: unit.uid };
    setMessage(`${typeFor(unit).name}${objectParticle(typeFor(unit).name)} 전투판에 배치했습니다.`, "good");
  }
  renderPrep();
}

function moveSelectedOnStash(slot) {
  const unit = selectedUnit();
  if (!unit || state.phase !== "prep") return;

  if (state.selected.location === "stash") {
    if (!canPlace(state.stash, slot, unitSize(unit), unit.uid)) return;
    unit.start = slot;
  } else {
    if (!canPlace(state.stash, slot, unitSize(unit))) return;
    state.board.splice(state.board.indexOf(unit), 1);
    unit.start = slot;
    state.stash.push(unit);
    state.selected = { location: "stash", uid: unit.uid };
  }
  renderPrep();
}

function startWave() {
  if (state.wave === 0 && !state.hasHiredAny) {
    setMessage("첫 용병을 하나 이상 영입하세요.", "bad");
    return;
  }
  if (state.board.length === 0) {
    setMessage("전투판에 카드 캐릭터가 한 장 이상 필요합니다.", "bad");
    return;
  }
  state.wave += 1;
  state.phase = "combat";
  state.paused = false;
  hoveredBoardUid = null;
  pinnedBoardUid = null;
  refreshUnitPopover();
  pauseButton.textContent = "Ⅱ";
  state.selected = null;
  state.enemies.length = 0;
  state.projectiles.length = 0;
  state.enemyProjectiles.length = 0;
  state.effects.length = 0;
  state.spawnQueue = state.nextWavePlan.map((entry) => ({ ...entry }));
  state.spawnRemaining = state.spawnQueue.length;
  state.wavePendingAdds = state.spawnQueue.some((entry) => entry.typeId === FINAL_BOSS_ID) ? 8 : 0;
  state.waveTotalSpawns = state.spawnQueue.length + state.wavePendingAdds;
  state.spawnTimer = 0.35;
  state.waveStartHp = state.baseHp;
  state.waveStartCoins = state.coins;
  state.waveWallDamage = 0;
  state.waveBlockedDamage = 0;
  state.wallShield = 0;
  state.wallFlash = 0;
  state.combatTime = 0;
  state.enraged = false;
  for (const unit of state.board) {
    unit.cooldownLeft = 0.25 + Math.random() * 0.4;
    unit.waveDamage = 0;
    unit.combatBonus = {};
    unit.windTimer = 0;
    unit.buffFlash = 0;
    unit.buffLabel = "";
    unit.buffLabelTimer = 0;
    unit.attackPulse = 0;
    if (hasTag(unit, "총")) unit.ammo = unit.ammoMax;
  }
  prepPanel.hidden = true;
  stashDock.hidden = false;
  refreshStashControls();
  refreshBattleStatus(`웨이브 ${state.wave} 시작`);
}

function finishWave() {
  const damageTaken = state.waveWallDamage;
  const perfectBonus = damageTaken === 0 ? 1 : 0;
  const clearReward = 4 + perfectBonus;
  state.coins += clearReward;
  const waveReward = state.coins - state.waveStartCoins;
  const ranking = [...state.board]
    .map((unit) => ({ uid: unit.uid, name: typeFor(unit).name, damage: Math.round(unit.waveDamage) }))
    .sort((a, b) => b.damage - a.damage || a.uid - b.uid);
  state.lastWaveReport = { damageTaken, perfectBonus, clearReward, waveReward, ranking };
  if (state.wave >= MAX_WAVES) {
    endRun(true);
    return;
  }
  const recoveredHp = Math.min(WALL_RECOVERY_AFTER_WAVE, MAX_WALL_HP - state.baseHp);
  state.baseHp += recoveredHp;
  state.wallShield = 0;
  for (const unit of state.board) {
    unit.combatBonus = {};
    unit.windTimer = 0;
    unit.buffFlash = 0;
    unit.buffLabel = "";
    unit.buffLabelTimer = 0;
    unit.attackPulse = 0;
  }
  state.phase = "prep";
  hoveredBoardUid = null;
  pinnedBoardUid = null;
  refreshUnitPopover();
  state.nextWavePlan = weightedPlanForWave(state.wave + 1);
  prepTitle.textContent = `웨이브 ${state.wave + 1}`;
  setMessage(`웨이브 ${state.wave} 돌파 · +${clearReward}G${recoveredHp > 0 ? ` · HP +${Math.ceil(recoveredHp)}` : ""}${perfectBonus ? " · 무피격 +1G" : ""}`, "good");
  rollShop();
  prepPanel.hidden = false;
  stashDock.hidden = false;
  refreshBattleStatus(`웨이브 ${state.wave} 돌파`);
}

function endRun(victory) {
  state.phase = victory ? "victory" : "defeat";
  hoveredBoardUid = null;
  pinnedBoardUid = null;
  refreshUnitPopover();
  resultTitle.textContent = victory ? "바자르 방어 성공!" : "성벽이 무너졌습니다";
  const leader = [...state.board].sort((a, b) => b.totalDamage - a.totalDamage || a.uid - b.uid)[0];
  const leaderText = leader ? ` 최고 딜러는 ${typeFor(leader).name}(${Math.round(leader.totalDamage)})입니다.` : "";
  resultText.textContent = victory
    ? `${MAX_WAVES}개 웨이브를 돌파하고 공중 몬스터 ${state.kills}마리를 처치했습니다. 성벽 ${state.baseHp}/${MAX_WALL_HP}.${leaderText}`
    : `웨이브 ${state.wave}에서 패배했습니다. 배치와 시너지 조합을 바꿔 다시 도전해보세요.`;
  resultPanel.hidden = false;
  stashDock.hidden = false;
  refreshStashControls();
  refreshBattleStatus(victory ? "승리" : "패배");
}

function restart() {
  resetPendingSale();
  uidCounter = 1;
  state = createInitialState();
  hoveredBoardUid = null;
  pinnedBoardUid = null;
  refreshUnitPopover();
  resultPanel.hidden = true;
  prepPanel.hidden = false;
  stashDock.hidden = false;
  pauseButton.textContent = "Ⅱ";
  speedButton.textContent = "×1";
  prepTitle.textContent = "웨이브 1";
  setMessage("직선탄과 유도탄의 궤적을 보고, 총과 보급 정령을 인접 배치하세요.");
  state.nextWavePlan = weightedPlanForWave(1);
  rollShop();
  refreshBattleStatus("새 게임");
}

function spawnEnemy() {
  const entry = state.spawnQueue.shift();
  if (!entry) return;
  const type = enemyTypes[entry.typeId];
  const x = entry.lane * SLOT_WIDTH + SLOT_WIDTH / 2;
  state.enemies.push(createEnemy(type, x, entry.typeId === FINAL_BOSS_ID ? 245 : 200));
  state.spawnRemaining = state.spawnQueue.length;
  state.spawnTimer = Math.max(0.34, 0.92 - state.wave * 0.055) * (0.78 + Math.random() * 0.42);
}

function createEnemy(type, x, y) {
  const waveScale = type.kind === "boss" ? 1 : WAVE_ENEMY_SCALE[state.wave - 1] || 1;
  const scaledShield = (type.shield || 0) * waveScale;
  return {
    type,
    x,
    y,
    hp: type.hp * waveScale,
    maxHp: type.hp * waveScale,
    radius: type.radius,
    baseX: x,
    shield: scaledShield,
    maxShield: scaledShield,
    fireStack: 0,
    frostStack: 0,
    fireTimer: FIRE_TICK_INTERVAL,
    fireDuration: 0,
    frostTimer: 0,
    fireSources: {},
    frostSources: {},
    bossPhase: 0,
    flash: 0,
    attackCooldown: 0.45 + Math.random() * 0.35,
    reachedAttackRange: false,
    attackPulse: 0,
  };
}

function grantWind(target, seconds) {
  if (!target || !seconds) return false;
  const next = Math.max(target.windTimer || 0, seconds);
  if (next <= (target.windTimer || 0)) return false;
  target.windTimer = next;
  target.buffFlash = 0.45;
  target.buffLabel = "💨 가속";
  target.buffLabelTimer = 0.75;
  return true;
}

function reloadAdjacentGun(unit) {
  if (!typeFor(unit).reload) return null;
  const target = adjacentUnits(unit)
    .filter((other) => hasTag(other, "총") && other.ammo < other.ammoMax)
    .sort((a, b) => a.ammo - b.ammo || a.start - b.start)[0];
  if (!target) return null;
  target.ammo = Math.min(target.ammoMax, target.ammo + 1);
  target.buffFlash = 0.45;
  target.buffLabel = "🔫 +1";
  target.buffLabelTimer = 0.75;
  return target;
}

function targetForUnit(unit) {
  const sourceX = (unit.start + unitSize(unit) / 2) * SLOT_WIDTH;
  const living = state.enemies
    .filter((enemy) => enemy.hp > 0)
    .sort((a, b) => b.y - a.y || Math.abs(a.x - sourceX) - Math.abs(b.x - sourceX));
  if (living.length === 0) return null;
  const stats = statsFor(unit);
  if (typeFor(unit).shot !== "straight" || stats.pierce <= 1) return living[0];

  const sourceY = WALL_Y - 18;
  const pierceLimit = Math.max(1, Math.round(stats.pierce));
  return living
    .map((candidate) => {
      const dx = candidate.x - sourceX;
      const dy = candidate.y - sourceY;
      const length = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / length;
      const uy = dy / length;
      const hits = living.filter((enemy) => {
        const ex = enemy.x - sourceX;
        const ey = enemy.y - sourceY;
        const projection = ex * ux + ey * uy;
        if (projection <= 0) return false;
        const perpendicular = Math.abs(ex * uy - ey * ux);
        return perpendicular <= enemy.radius + 7;
      }).length;
      return { candidate, score: Math.min(pierceLimit, hits) };
    })
    .sort((a, b) => b.score - a.score
      || b.candidate.y - a.candidate.y
      || Math.abs(a.candidate.x - sourceX) - Math.abs(b.candidate.x - sourceX))[0].candidate;
}

function targetForProjectile(projectile) {
  const target = projectile.target;
  if (!target) return null;
  const bossPhasePending = target.type.kind === "boss" && target.bossPhase < 2;
  if (state.enemies.includes(target) && (target.hp > 0 || bossPhasePending)) {
    return { x: target.x, y: target.y, targetLost: false };
  }
  if (!projectile.targetDeathPoint) {
    projectile.targetDeathPoint = { x: target.x, y: target.y };
  }
  return { ...projectile.targetDeathPoint, targetLost: true };
}

function targetsForSplit(unit, primary, count) {
  const sourceX = (unit.start + unitSize(unit) / 2) * SLOT_WIDTH;
  const others = state.enemies
    .filter((enemy) => enemy !== primary && enemy.hp > 0)
    .sort((a, b) => Math.hypot(a.x - primary.x, a.y - primary.y) - Math.hypot(b.x - primary.x, b.y - primary.y)
      || Math.abs(a.x - sourceX) - Math.abs(b.x - sourceX));
  return [primary, ...others].slice(0, Math.max(1, count));
}

function createProjectile(unit, type, stats, target, delay = 0, spreadIndex = 0, spreadCount = 1, powerScale = 1) {
  const x = (unit.start + unitSize(unit) / 2) * SLOT_WIDTH;
  const y = WALL_Y - 18;
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const sideAngle = (spreadIndex - (spreadCount - 1) / 2) * 0.11;
  const baseAngle = Math.atan2(dy, dx) + sideAngle;
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    vx: Math.cos(baseAngle) * type.projectileSpeed,
    vy: Math.sin(baseAngle) * type.projectileSpeed,
    speed: type.projectileSpeed,
    damage: stats.direct * powerScale,
    fire: stats.fire * powerScale,
    frost: stats.frost * powerScale,
    pierceLeft: Math.max(1, Math.round(stats.pierce || 1)),
    explode: Math.max(0, stats.explode || 0),
    radius: type.projectile === "cannon" ? 11 : 7,
    color: type.color,
    kind: type.projectile,
    shot: type.shot,
    sourceUid: unit.uid,
    target,
    firstTarget: target,
    aimAssist: type.shot === "straight" ? 0.28 : 0,
    angle: baseAngle,
    delay,
    hitIds: new Set(),
  };
}

function fireUnit(unit) {
  const type = typeFor(unit);
  const stats = statsFor(unit);
  const target = targetForUnit(unit);
  const offensive = stats.direct > 0;
  if (!target) return;
  if (hasTag(unit, "총") && unit.ammo <= 0) {
    unit.cooldownLeft = Math.min(1.2, stats.cooldown * 0.25);
    unit.buffLabel = "탄약 없음";
    unit.buffLabelTimer = 0.75;
    return;
  }
  if (hasTag(unit, "총")) unit.ammo -= 1;
  if (stats.shield > 0) state.wallShield = Math.min(MAX_WALL_SHIELD, state.wallShield + stats.shield);
  if (stats.wind > 0) {
    for (const targetUnit of [unit, ...adjacentUnits(unit)]) grantWind(targetUnit, stats.wind);
  }
  reloadAdjacentGun(unit);
  if (offensive && target) {
    const splitTargets = targetsForSplit(unit, target, Math.max(1, Math.round(stats.split || 1)));
    const desiredShots = Math.max(1, Math.round(stats.split || 1));
    const shotTargets = splitTargets.map((splitTarget) => ({ target: splitTarget, powerScale: 1 }));
    while (shotTargets.length < desiredShots) {
      shotTargets.push({ target, powerScale: REPEATED_SPLIT_POWER_SCALE });
    }
    for (let cast = 0; cast < stats.casts; cast += 1) {
      const castScale = cast === 0 ? 1 : MULTICAST_POWER_SCALE;
      shotTargets.forEach((shot, index) => {
        state.projectiles.push(createProjectile(
          unit,
          type,
          stats,
          shot.target,
          cast * 0.14,
          index,
          shotTargets.length,
          shot.powerScale * castScale,
        ));
      });
    }
  }
  unit.cooldownLeft = stats.cooldown;
  unit.attackPulse = 0.24;
  state.effects.push({
    x: (unit.start + unitSize(unit) / 2) * SLOT_WIDTH,
    y: WALL_Y - 14,
    life: 0.3,
    maxLife: 0.3,
    color: type.color,
    radius: 32 + unitSize(unit) * 10,
  });
}

function creditDamage(sourceUid, amount) {
  const source = state.board.find((unit) => unit.uid === sourceUid);
  if (!source || amount <= 0) return;
  source.waveDamage += amount;
  source.totalDamage += amount;
}

function applyDamage(enemy, amount, sourceUid) {
  let remainingDamage = Math.max(0, amount);
  let appliedDamage = 0;
  if (enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, remainingDamage);
    enemy.shield -= absorbed;
    remainingDamage -= absorbed;
    appliedDamage += absorbed;
  }
  const actualDamage = Math.min(enemy.hp, Math.max(0, remainingDamage));
  enemy.hp -= actualDamage;
  appliedDamage += actualDamage;
  creditDamage(sourceUid, appliedDamage);
  return appliedDamage;
}

function canReceiveStatus(enemy) {
  return enemy.hp > 0 || (enemy.type.kind === "boss" && enemy.bossPhase < 2);
}

function addEnemyStack(enemy, key, amount, sourceUid) {
  if (amount <= 0 || !canReceiveStatus(enemy)) return 0;
  const stackKey = `${key}Stack`;
  const cap = key === "frost"
    ? MAX_FROST_STACK
    : enemy.type.kind === "boss" ? MAX_STATUS_STACK + 15 : MAX_STATUS_STACK;
  const applied = Math.min(amount, Math.max(0, cap - enemy[stackKey]));
  if (applied <= 0) return 0;
  enemy[stackKey] += applied;
  const sources = enemy[`${key}Sources`];
  sources[sourceUid] = (sources[sourceUid] || 0) + applied;
  return applied;
}

function applyStatus(enemy, key, amount, sourceUid) {
  if (amount > 0 && canReceiveStatus(enemy)) {
    if (key === "fire") enemy.fireDuration = FIRE_DURATION;
    if (key === "frost") enemy.frostTimer = FROST_DURATION;
  }
  const applied = addEnemyStack(enemy, key, amount, sourceUid);
  if (applied <= 0) return 0;
  state.effects.push({
    x: enemy.x,
    y: enemy.y,
    life: 0.2,
    maxLife: 0.2,
    color: key === "fire" ? "#ff8b52" : "#86dcff",
    radius: 20,
  });
  return applied;
}

function explodeAt(enemy, projectile) {
  const radius = SLOT_WIDTH * (1.1 + projectile.explode * 0.28);
  for (const nearby of state.enemies) {
    if (nearby === enemy || nearby.hp <= 0) continue;
    if (Math.hypot(nearby.x - enemy.x, nearby.y - enemy.y) > radius + nearby.radius) continue;
    applyDamage(nearby, projectile.damage * 0.6, projectile.sourceUid);
    if (projectile.fire > 0) applyStatus(nearby, "fire", Math.max(1, Math.floor(projectile.fire * 0.6)), projectile.sourceUid);
    if (projectile.frost > 0) applyStatus(nearby, "frost", Math.max(1, Math.floor(projectile.frost * 0.6)), projectile.sourceUid);
    nearby.flash = 0.1;
  }
  state.effects.push({ x: enemy.x, y: enemy.y, life: 0.38, maxLife: 0.38, color: "#ffbd5c", radius: radius * 0.72 });
}

function damageEnemy(enemy, amount, projectile) {
  applyDamage(enemy, amount, projectile.sourceUid);
  enemy.flash = 0.08;
  if (projectile.fire > 0) applyStatus(enemy, "fire", projectile.fire, projectile.sourceUid);
  if (projectile.frost > 0) applyStatus(enemy, "frost", projectile.frost, projectile.sourceUid);
  if (projectile.explode > 0) explodeAt(enemy, projectile);
  state.effects.push({ x: enemy.x, y: enemy.y, life: 0.24, maxLife: 0.24, color: projectile.color, radius: 26 });
}

function killEnemy(enemy) {
  const index = state.enemies.indexOf(enemy);
  if (index < 0) return;
  state.enemies.splice(index, 1);
  if (enemy.type.kind === "boss") {
    if (state.wavePendingAdds > 0) {
      state.waveTotalSpawns -= state.wavePendingAdds;
      state.wavePendingAdds = 0;
    }
    state.coins += 3;
  } else {
    state.killGoldMeter += 1;
    if (state.killGoldMeter >= 8) {
      state.killGoldMeter -= 8;
      state.coins += 1;
    }
  }
  goldText.textContent = state.coins;
  state.kills += 1;
  for (let i = 0; i < 8; i += 1) {
    state.effects.push({
      x: enemy.x + (Math.random() - 0.5) * enemy.radius,
      y: enemy.y + (Math.random() - 0.5) * enemy.radius,
      life: 0.38 + Math.random() * 0.2,
      maxLife: 0.58,
      color: enemy.type.color,
      radius: 14 + Math.random() * 16,
    });
  }
}

function triggerBossPhase(enemy, phase) {
  enemy.bossPhase = phase;
  const phaseFloor = phase === 1 ? enemy.maxHp * 0.34 : enemy.maxHp * 0.12;
  enemy.hp = Math.max(enemy.hp, phaseFloor);
  enemy.shield += phase === 1 ? 40 : 60;
  enemy.maxShield = Math.max(enemy.maxShield, enemy.shield);
  const lanes = phase === 1 ? [1, 4, 7] : [0, 2, 5, 7, 9];
  const addType = phase === 1 ? enemyTypes["maou_마왕의손가락"] : enemyTypes["maou_절망의칼날"];
  state.wavePendingAdds = Math.max(0, state.wavePendingAdds - lanes.length);
  for (const lane of lanes) {
    state.enemies.push(createEnemy(addType, lane * SLOT_WIDTH + SLOT_WIDTH / 2, 300));
  }
  state.effects.push({ x: enemy.x, y: enemy.y, life: 0.8, maxLife: 0.8, color: "#71d8ff", radius: 150 });
}

function damageWall(amount) {
  let remaining = Math.max(0, amount);
  state.wallFlash = 0.22;
  if (state.wallShield > 0) {
    const absorbed = Math.min(state.wallShield, remaining);
    state.wallShield -= absorbed;
    remaining -= absorbed;
    state.waveBlockedDamage += absorbed;
  }
  const actualDamage = Math.min(state.baseHp, remaining);
  state.baseHp -= actualDamage;
  state.waveWallDamage += actualDamage;
  if (amount > 0) refreshBattleStatus(actualDamage > 0 ? `성벽 피해 ${compactNumber(actualDamage)}` : "보호막 방어");
  return actualDamage;
}

function attackWall(enemy) {
  const frostSlow = Math.min(MAX_FROST_SLOW, enemy.frostStack * FROST_SLOW_PER_STACK);
  const damage = Math.max(0.5, enemy.type.damage * (state.enraged ? 1.5 : 1));
  enemy.attackPulse = 0.22;
  enemy.attackCooldown = enemy.type.attackInterval * (1 + frostSlow) / (state.enraged ? 1.35 : 1);
  if (enemy.type.attackMode === "ranged") {
    state.enemyProjectiles.push({
      x: enemy.x,
      y: enemy.y + enemy.radius * 0.45,
      targetX: enemy.baseX,
      targetY: WALL_Y - 2,
      speed: enemy.type.projectileSpeed,
      damage,
      color: enemy.type.color,
      radius: Math.max(7, Math.round(enemy.radius * 0.24)),
    });
    return;
  }
  damageWall(damage);
  state.effects.push({ x: enemy.x, y: WALL_Y - 4, life: 0.38, maxLife: 0.38, color: "#ff745f", radius: 64 });
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function update(dt) {
  if (state.phase !== "combat" || state.paused) return;
  const scaledDt = dt * state.speed;
  state.elapsed += scaledDt;
  state.combatTime += scaledDt;
  if (!state.enraged && state.combatTime >= ENRAGE_TIME) {
    state.enraged = true;
    setMessage("적이 격노했습니다! 이동과 공격이 빨라집니다.", "bad");
  }

  state.spawnTimer -= scaledDt;
  if (state.spawnRemaining > 0 && state.spawnTimer <= 0) spawnEnemy();

  state.wallShield = Math.max(0, state.wallShield - SHIELD_DECAY_PER_SECOND * scaledDt);
  state.wallFlash = Math.max(0, state.wallFlash - scaledDt);

  for (const unit of state.board) {
    const cooldownRate = unit.windTimer > 0 ? 2 : 1;
    unit.cooldownLeft -= scaledDt * cooldownRate;
    unit.windTimer = Math.max(0, unit.windTimer - scaledDt);
    unit.buffFlash = Math.max(0, unit.buffFlash - scaledDt);
    unit.buffLabelTimer = Math.max(0, unit.buffLabelTimer - scaledDt);
    unit.attackPulse = Math.max(0, unit.attackPulse - scaledDt);
    if (unit.cooldownLeft <= 0) fireUnit(unit);
  }

  for (const projectile of [...state.projectiles]) {
    if (projectile.delay > 0) {
      projectile.delay -= scaledDt;
      continue;
    }
    projectile.prevX = projectile.x;
    projectile.prevY = projectile.y;
    let homingTargetLost = false;
    if (projectile.shot === "homing") {
      const target = targetForProjectile(projectile);
      if (!target) {
        state.projectiles.splice(state.projectiles.indexOf(projectile), 1);
        continue;
      }
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      projectile.vx = (dx / length) * projectile.speed;
      projectile.vy = (dy / length) * projectile.speed;
      homingTargetLost = target.targetLost;
      if (homingTargetLost && length <= projectile.speed * scaledDt + projectile.radius) {
        projectile.x = target.x;
        projectile.y = target.y;
        state.effects.push({
          x: target.x,
          y: target.y,
          life: 0.16,
          maxLife: 0.16,
          color: projectile.color,
          radius: Math.max(12, projectile.radius * 1.8),
        });
        state.projectiles.splice(state.projectiles.indexOf(projectile), 1);
        continue;
      }
    } else if (projectile.aimAssist > 0 && projectile.firstTarget?.hp > 0) {
      projectile.aimAssist -= scaledDt;
      const dx = projectile.firstTarget.x - projectile.x;
      const dy = projectile.firstTarget.y - projectile.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      projectile.vx = (dx / length) * projectile.speed;
      projectile.vy = (dy / length) * projectile.speed;
    }
    projectile.x += projectile.vx * scaledDt;
    projectile.y += projectile.vy * scaledDt;
    projectile.angle = Math.atan2(projectile.vy, projectile.vx);
    if (homingTargetLost) continue;
    const hits = state.enemies
      .filter((enemy) => enemy.hp > 0 && !projectile.hitIds.has(enemy))
      .map((enemy) => ({ enemy, distance: pointToSegmentDistance(enemy.x, enemy.y, projectile.prevX, projectile.prevY, projectile.x, projectile.y) }))
      .filter(({ enemy, distance }) => distance <= enemy.radius + projectile.radius)
      .sort((a, b) => a.distance - b.distance);
    for (const { enemy } of hits) {
      projectile.hitIds.add(enemy);
      damageEnemy(enemy, projectile.damage, projectile);
      projectile.pierceLeft -= 1;
      if (projectile.pierceLeft <= 0 || projectile.explode > 0) break;
    }
    if (projectile.pierceLeft <= 0 || projectile.explode > 0 && hits.length > 0
      || projectile.y < -80 || projectile.y > HEIGHT + 80 || projectile.x < -80 || projectile.x > WIDTH + 80) {
      state.projectiles.splice(state.projectiles.indexOf(projectile), 1);
    }
  }

  for (const enemy of [...state.enemies]) {
    enemy.x = enemy.baseX;
    enemy.flash = Math.max(0, enemy.flash - scaledDt);
    enemy.attackPulse = Math.max(0, enemy.attackPulse - scaledDt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - scaledDt);
    if (enemy.fireStack > 0) {
      enemy.fireDuration = Math.max(0, enemy.fireDuration - scaledDt);
      enemy.fireTimer -= scaledDt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer += FIRE_TICK_INTERVAL;
        for (const [sourceUid, damage] of Object.entries(enemy.fireSources)) {
          applyDamage(enemy, damage, Number(sourceUid));
        }
      }
      if (enemy.fireDuration <= 0) {
        enemy.fireStack = 0;
        enemy.fireSources = {};
        enemy.fireTimer = FIRE_TICK_INTERVAL;
      }
    }
    if (enemy.frostTimer > 0) {
      enemy.frostTimer = Math.max(0, enemy.frostTimer - scaledDt);
      if (enemy.frostTimer <= 0) enemy.frostStack = 0;
    }
    if (enemy.type.kind === "boss") {
      const ratio = enemy.hp / enemy.maxHp;
      if (ratio <= 0.66 && enemy.bossPhase === 0) triggerBossPhase(enemy, 1);
      else if (ratio <= 0.33 && enemy.bossPhase === 1) triggerBossPhase(enemy, 2);
    }
    if (enemy.hp <= 0) {
      killEnemy(enemy);
      continue;
    }

    const attackStopY = WALL_Y - enemy.radius - enemy.type.attackRange;
    let movementStopY = attackStopY;
    for (const blocker of state.enemies) {
      if (blocker === enemy || blocker.hp <= 0 || blocker.baseX !== enemy.baseX || blocker.y <= enemy.y) continue;
      movementStopY = Math.min(movementStopY, blocker.y - blocker.radius - enemy.radius - 12);
    }
    if (enemy.y < movementStopY) {
      const frostSlow = Math.min(MAX_FROST_SLOW, enemy.frostStack * FROST_SLOW_PER_STACK);
      const movement = enemy.type.speed * (1 - frostSlow) * (1 + (state.wave - 1) * 0.035) * (state.enraged ? 1.55 : 1) * scaledDt;
      enemy.y = Math.min(movementStopY, enemy.y + movement);
    }
    if (!enemy.reachedAttackRange && enemy.y >= attackStopY - 0.5) {
      enemy.reachedAttackRange = true;
    }
    if (enemy.y >= attackStopY - 0.5 && enemy.attackCooldown <= 0) {
      attackWall(enemy);
      if (state.baseHp <= 0) {
        state.baseHp = 0;
        endRun(false);
        return;
      }
    }
  }

  for (const projectile of [...state.enemyProjectiles]) {
    const dx = projectile.targetX - projectile.x;
    const dy = projectile.targetY - projectile.y;
    const distance = Math.hypot(dx, dy);
    const travel = projectile.speed * scaledDt;
    if (distance <= projectile.radius + travel) {
      state.enemyProjectiles.splice(state.enemyProjectiles.indexOf(projectile), 1);
      damageWall(projectile.damage);
      state.effects.push({ x: projectile.targetX, y: WALL_Y - 4, life: 0.42, maxLife: 0.42, color: projectile.color, radius: 58 });
      if (state.baseHp <= 0) {
        state.baseHp = 0;
        endRun(false);
        return;
      }
      continue;
    }
    projectile.x += (dx / distance) * travel;
    projectile.y += (dy / distance) * travel;
  }

  for (const effect of [...state.effects]) {
    effect.life -= scaledDt;
    if (effect.life <= 0) state.effects.splice(state.effects.indexOf(effect), 1);
  }

  if (
    state.phase === "combat"
    && state.spawnRemaining === 0
    && state.enemies.length === 0
    && state.enemyProjectiles.length === 0
    && state.wavePendingAdds === 0
  ) finishWave();
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#42bff5");
  gradient.addColorStop(0.62, "#a9e9ff");
  gradient.addColorStop(1, "#d9f4ef");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.68)";
  for (const cloud of [
    [70, 460, 95],
    [910, 500, 115],
    [150, 930, 78],
    [850, 890, 88],
  ]) {
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(cloud[0] + i * cloud[2] * 0.45, cloud[1] + Math.abs(i) * 12, cloud[2] * (0.58 - Math.abs(i) * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "#4d91ae";
  ctx.fillRect(0, 1210, WIDTH, 220);
  ctx.fillStyle = "#397c99";
  for (let x = 0; x < WIDTH; x += 165) {
    ctx.fillRect(x, 1130, 110, 300);
    ctx.fillRect(x + 22, 1092, 25, 45);
    ctx.fillRect(x + 63, 1092, 25, 45);
    ctx.fillStyle = "#32728d";
    ctx.beginPath();
    ctx.moveTo(x + 55, 1035);
    ctx.lineTo(x + 90, 1092);
    ctx.lineTo(x + 20, 1092);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4d91ae";
  }
}

function drawWall() {
  const wallBottom = BOARD_Y - 12;
  const wallHeight = wallBottom - WALL_Y;
  const hpRatio = Math.max(0, Math.min(1, state.baseHp / MAX_WALL_HP));
  const shieldRatio = Math.max(0, Math.min(1, state.wallShield / MAX_WALL_SHIELD));
  ctx.save();

  ctx.shadowBlur = state.wallFlash > 0 ? 28 : 12;
  ctx.shadowColor = state.wallFlash > 0 ? "#ff7a62" : "rgba(30, 48, 58, 0.45)";
  const stoneGradient = ctx.createLinearGradient(0, WALL_Y, 0, wallBottom);
  stoneGradient.addColorStop(0, state.wallFlash > 0 ? "#d99b7f" : "#a8bcc4");
  stoneGradient.addColorStop(1, "#647985");
  ctx.fillStyle = stoneGradient;
  ctx.strokeStyle = "#2b3942";
  ctx.lineWidth = 7;
  roundedRect(8, WALL_Y + 22, WIDTH - 16, wallHeight - 14, 12);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  const merlonWidth = 58;
  const merlonGap = 34;
  for (let x = 14; x < WIDTH - 14; x += merlonWidth + merlonGap) {
    ctx.fillStyle = state.wallFlash > 0 ? "#d99b7f" : "#a8bcc4";
    ctx.strokeStyle = "#2b3942";
    ctx.lineWidth = 7;
    roundedRect(x, WALL_Y, merlonWidth, 52, 8);
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(44, 59, 67, 0.52)";
  ctx.lineWidth = 4;
  for (let x = 86; x < WIDTH; x += 124) {
    ctx.beginPath();
    ctx.moveTo(x, WALL_Y + 28);
    ctx.lineTo(x - 12, wallBottom);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(12, WALL_Y + 71);
  ctx.lineTo(WIDTH - 12, WALL_Y + 71);
  ctx.stroke();

  if (state.baseHp <= MAX_WALL_HP * 0.6) {
    ctx.strokeStyle = "#46545c";
    ctx.lineWidth = 5;
    for (const crackX of state.baseHp <= MAX_WALL_HP * 0.3 ? [180, 520, 825] : [330, 735]) {
      ctx.beginPath();
      ctx.moveTo(crackX, WALL_Y + 26);
      ctx.lineTo(crackX - 13, WALL_Y + 48);
      ctx.lineTo(crackX + 8, WALL_Y + 65);
      ctx.lineTo(crackX - 5, wallBottom - 8);
      ctx.stroke();
    }
  }

  const gaugeX = 10;
  const gaugeY = wallBottom - 19;
  const gaugeWidth = WIDTH - gaugeX * 2;
  ctx.fillStyle = "rgba(18, 30, 27, 0.92)";
  roundedRect(gaugeX, gaugeY, gaugeWidth, 18, 9);
  ctx.fill();
  if (hpRatio > 0) {
    ctx.fillStyle = "#48df72";
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(72, 223, 114, 0.72)";
    roundedRect(gaugeX + 4, gaugeY + 4, (gaugeWidth - 8) * hpRatio, 10, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (shieldRatio > 0) {
    ctx.fillStyle = "rgba(18, 42, 58, 0.9)";
    roundedRect(gaugeX, gaugeY - 13, gaugeWidth, 7, 4);
    ctx.fill();
    ctx.fillStyle = "#63dcff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(99, 220, 255, 0.8)";
    roundedRect(gaugeX + 2, gaugeY - 11, (gaugeWidth - 4) * shieldRatio, 3, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.font = "900 18px system-ui";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f2fff3";
  ctx.textAlign = "right";
  ctx.fillText(`HP ${compactNumber(state.baseHp)}`, WIDTH - 18, gaugeY - 25);
  if (state.wallShield > 0) {
    ctx.fillStyle = "#c9f5ff";
    ctx.textAlign = "left";
    ctx.fillText(`🛡 ${Math.ceil(state.wallShield)}`, 18, gaugeY - 25);
  }
  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#33261e";
  ctx.fillStyle = "rgba(32, 27, 24, 0.9)";
  roundedRect(735, 28, 235, 54, 25);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff5d5";
  ctx.font = "800 27px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const displayedWave = state.phase === "prep" ? Math.min(MAX_WAVES, state.wave + 1) : Math.max(1, state.wave);
  ctx.fillText(`⚔ ${displayedWave}/${MAX_WAVES}`, 852, 55);
  if (state.phase === "combat") {
    const progress = waveCompletion();
    const remaining = state.spawnRemaining + state.enemies.length + state.wavePendingAdds;
    ctx.fillStyle = "rgba(32, 27, 24, 0.9)";
    ctx.strokeStyle = "#33261e";
    ctx.lineWidth = 6;
    roundedRect(270, 31, 420, 46, 22);
    ctx.fill();
    ctx.stroke();
    if (progress > 0) {
      ctx.fillStyle = state.enraged ? "#ff765f" : "#f1bd45";
      roundedRect(278, 39, 404 * progress, 30, 15);
      ctx.fill();
    }
    ctx.fillStyle = "#fff5d5";
    ctx.font = "900 20px system-ui";
    ctx.fillText(state.enraged ? `격노 · 적 ${remaining}` : `남은 적 ${remaining}`, 480, 54);
  }
  ctx.restore();
}

function waveCompletion() {
  const total = Math.max(1, state.waveTotalSpawns);
  const remaining = state.spawnRemaining + state.enemies.length + state.wavePendingAdds;
  return Math.max(0, Math.min(1, 1 - remaining / Math.max(1, total)));
}

function unitUsesAdjacentPartner(unit, partner) {
  const type = typeFor(unit);
  return (type.reload && hasTag(partner, "총"))
    || (hasTag(unit, "총") && typeFor(partner).reload)
    || (type.stats.wind && partner !== unit);
}

function activeSynergyBetween(left, right) {
  return unitUsesAdjacentPartner(left, right) || unitUsesAdjacentPartner(right, left);
}

function drawBoard() {
  ctx.save();
  ctx.fillStyle = "#4e5b67";
  ctx.fillRect(0, BOARD_Y, WIDTH, BOARD_HEIGHT);
  ctx.fillStyle = "#34414b";
  ctx.fillRect(0, BOARD_Y + 95, WIDTH, BOARD_HEIGHT - 95);

  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const occupant = state.board.find((unit) => i >= unit.start && i < unit.start + unitSize(unit));
    const selected = state.selected && state.selected.location === "board" && (() => {
      const unit = selectedUnit();
      return unit && i >= unit.start && i < unit.start + unitSize(unit);
    })();
    const tierColor = occupant ? TIER_COLORS[Math.min(MAX_TIER, occupant.tier)] : null;
    ctx.fillStyle = tierColor?.fill || (i % 2 ? "#778590" : "#84939e");
    ctx.strokeStyle = selected ? "#fff2a6" : tierColor?.stroke || "#26323b";
    ctx.lineWidth = selected ? 9 : 6;
    ctx.shadowBlur = occupant?.tier === MAX_TIER ? 18 : 0;
    ctx.shadowColor = tierColor?.glow || "transparent";
    roundedRect(i * SLOT_WIDTH + 3, BOARD_Y + 3, SLOT_WIDTH - 6, 92, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const sorted = [...state.board].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const left = sorted[i];
    const right = sorted[i + 1];
    const activeSynergy = activeSynergyBetween(left, right);
    if (left.start + unitSize(left) === right.start && activeSynergy) {
      const linkX = right.start * SLOT_WIDTH;
      ctx.strokeStyle = typeFor(left).color;
      ctx.lineWidth = 11;
      ctx.shadowBlur = 24;
      ctx.shadowColor = typeFor(left).color;
      ctx.beginPath();
      ctx.moveTo(linkX - 26, BOARD_Y + 18);
      ctx.lineTo(linkX + 26, BOARD_Y + 18);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
  for (const unit of sorted) drawUnit(unit);
  ctx.restore();
}

function drawUnit(unit) {
  const type = typeFor(unit);
  const size = type.size;
  const centerX = (unit.start + size / 2) * SLOT_WIDTH;
  const width = size * SLOT_WIDTH;
  const baseY = BOARD_Y + 56;
  const scale = (0.78 + size * 0.13) * ACTOR_SCALE;
  ctx.save();
  ctx.translate(centerX, baseY);
  ctx.scale(scale, scale);

  if (state.phase === "combat" && (unit.attackPulse > 0 || unit.buffFlash > 0)) {
    ctx.strokeStyle = unit.buffFlash > 0 ? "rgba(255, 226, 116, 0.95)" : "rgba(255,255,255,0.88)";
    ctx.lineWidth = 8;
    ctx.shadowBlur = 28;
    ctx.shadowColor = unit.buffFlash > 0 ? "#ffe274" : type.color;
    ctx.beginPath();
    ctx.arc(0, -48, 55 + size * 10 + (unit.attackPulse > 0 ? 10 : 0), 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (state.phase === "combat" && unit.windTimer > 0) {
    ctx.strokeStyle = "rgba(109, 226, 255, 0.9)";
    ctx.lineWidth = 8;
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#65dcff";
    ctx.beginPath();
    ctx.arc(0, -48, 62 + size * 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 32, width * 0.31, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 7;
  ctx.strokeStyle = "#2a211d";
  ctx.fillStyle = type.accent;
  roundedRect(-36 - size * 7, -48 - size * 14, 72 + size * 14, 86 + size * 16, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = type.color;
  ctx.beginPath();
  ctx.arc(0, -62 - size * 11, 31 + size * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff0c5";
  ctx.beginPath();
  ctx.arc(-10, -66 - size * 11, 5, 0, Math.PI * 2);
  ctx.arc(10, -66 - size * 11, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `${28 + size * 5}px "Segoe UI Emoji", system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(type.emoji, 0, -62 - size * 11);

  ctx.strokeStyle = "#2a211d";
  ctx.lineCap = "round";
  ctx.lineWidth = 11 + size * 2;
  if (type.projectile === "arrow" || type.projectile === "bolt") {
    ctx.beginPath();
    ctx.moveTo(20, -34);
    ctx.lineTo(20, -110 - size * 15);
    ctx.stroke();
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(20, -34);
    ctx.lineTo(20, -110 - size * 15);
    ctx.stroke();
  } else if (type.projectile === "heavy" || type.projectile === "cannon") {
    ctx.fillStyle = "#2f3d49";
    ctx.strokeStyle = "#211b18";
    ctx.lineWidth = 7;
    roundedRect(-27 - size * 8, -135 - size * 8, 54 + size * 16, 105 + size * 10, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111820";
    ctx.beginPath();
    ctx.ellipse(0, -142 - size * 8, 26 + size * 8, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#3d3028";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(22, -24);
    ctx.lineTo(22, -116 - size * 12);
    ctx.stroke();
    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.arc(22, -125 - size * 12, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  if (state.phase === "combat") {
    const stats = statsFor(unit);
    const readyRatio = Math.max(0, Math.min(1, 1 - unit.cooldownLeft / Math.max(0.01, stats.cooldown)));
    const barX = unit.start * SLOT_WIDTH + 10;
    const barWidth = size * SLOT_WIDTH - 20;
    ctx.fillStyle = "rgba(23, 30, 37, 0.88)";
    roundedRect(barX, BOARD_Y + 78, barWidth, 8, 4);
    ctx.fill();
    if (readyRatio > 0) {
      ctx.fillStyle = unit.windTimer > 0 ? "#65dcff" : type.color;
      roundedRect(barX, BOARD_Y + 78, barWidth * readyRatio, 8, 4);
      ctx.fill();
    }
    if (unit.windTimer > 0 || hasTag(unit, "총")) {
      ctx.font = "900 15px system-ui";
      ctx.fillStyle = unit.windTimer > 0 ? "#bdf5ff" : unit.ammo > 0 ? "#ffe899" : "#ff8d86";
      const runtime = unit.windTimer > 0 ? `💨 ${unit.windTimer.toFixed(1)}` : `🔫 ${unit.ammo}/${unit.ammoMax}`;
      ctx.fillText(runtime, centerX, BOARD_Y + 111);
    }
    if (unit.buffLabelTimer > 0 && unit.buffLabel) {
      const progress = 1 - unit.buffLabelTimer / 0.75;
      ctx.globalAlpha = Math.min(1, unit.buffLabelTimer / 0.2);
      ctx.font = "900 17px system-ui";
      ctx.fillStyle = "#fff2a8";
      ctx.strokeStyle = "rgba(31, 23, 17, 0.92)";
      ctx.lineWidth = 5;
      const labelY = BOARD_Y - 134 - progress * 18;
      ctx.strokeText(unit.buffLabel, centerX, labelY);
      ctx.fillText(unit.buffLabel, centerX, labelY);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawMonsterEye(x, y, radius, pupilShift = 0) {
  ctx.save();
  ctx.lineWidth = Math.max(1.5, radius * 0.2);
  ctx.strokeStyle = "#2b2022";
  ctx.fillStyle = "#fff7cf";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#211a22";
  ctx.beginPath();
  ctx.arc(x + pupilShift, y, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRegularMonster(type, radius, bodyColor) {
  const r = radius;
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = "#2b2022";

  if (type.family === "슬라임") {
    ctx.beginPath();
    ctx.moveTo(-0.95 * r, 0.52 * r);
    ctx.bezierCurveTo(-1.05 * r, 0.02 * r, -0.7 * r, -0.78 * r, -0.18 * r, -0.7 * r);
    ctx.bezierCurveTo(0.08 * r, -1.02 * r, 0.3 * r, -0.72 * r, 0.48 * r, -0.62 * r);
    ctx.bezierCurveTo(1.02 * r, -0.35 * r, 1.05 * r, 0.28 * r, 0.82 * r, 0.58 * r);
    ctx.quadraticCurveTo(0, 0.88 * r, -0.95 * r, 0.52 * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawMonsterEye(-0.27 * r, -0.1 * r, 0.16 * r);
    drawMonsterEye(0.31 * r, -0.08 * r, 0.13 * r);
    ctx.beginPath();
    ctx.arc(0.04 * r, 0.25 * r, 0.23 * r, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
    return;
  }

  if (type.family === "고블린") {
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(direction * 0.52 * r, -0.2 * r);
      ctx.lineTo(direction * 1.18 * r, -0.48 * r);
      ctx.lineTo(direction * 0.73 * r, 0.26 * r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.73 * r, 0.82 * r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawMonsterEye(-0.25 * r, -0.12 * r, 0.17 * r, 0.03 * r);
    drawMonsterEye(0.25 * r, -0.12 * r, 0.17 * r, -0.03 * r);
    ctx.fillStyle = "#fff3cf";
    ctx.beginPath();
    ctx.moveTo(-0.25 * r, 0.38 * r);
    ctx.lineTo(-0.08 * r, 0.65 * r);
    ctx.lineTo(0.02 * r, 0.35 * r);
    ctx.lineTo(0.16 * r, 0.65 * r);
    ctx.lineTo(0.28 * r, 0.36 * r);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (type.family === "트랩퍼") {
    ctx.fillStyle = "rgba(242, 220, 151, 0.78)";
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(direction * 0.45 * r, -0.32 * r);
      ctx.lineTo(direction * 1.18 * r, -0.72 * r);
      ctx.lineTo(direction * 0.96 * r, 0.18 * r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, -0.88 * r);
    ctx.lineTo(0.72 * r, -0.4 * r);
    ctx.lineTo(0.74 * r, 0.42 * r);
    ctx.lineTo(0, 0.88 * r);
    ctx.lineTo(-0.74 * r, 0.42 * r);
    ctx.lineTo(-0.72 * r, -0.4 * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawMonsterEye(0, -0.08 * r, 0.25 * r);
    ctx.beginPath();
    ctx.moveTo(-0.3 * r, 0.48 * r);
    ctx.lineTo(0.3 * r, 0.48 * r);
    ctx.stroke();
    return;
  }

  if (type.family === "뱀파이어") {
    ctx.fillStyle = bodyColor;
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(direction * 0.4 * r, -0.35 * r);
      ctx.lineTo(direction * 1.3 * r, -0.82 * r);
      ctx.lineTo(direction * 1.05 * r, 0.08 * r);
      ctx.lineTo(direction * 0.78 * r, -0.06 * r);
      ctx.lineTo(direction * 0.58 * r, 0.58 * r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 0.66 * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawMonsterEye(-0.23 * r, -0.12 * r, 0.14 * r);
    drawMonsterEye(0.23 * r, -0.12 * r, 0.14 * r);
    ctx.fillStyle = "#fff4da";
    ctx.beginPath();
    ctx.moveTo(-0.16 * r, 0.26 * r);
    ctx.lineTo(-0.02 * r, 0.57 * r);
    ctx.lineTo(0.08 * r, 0.25 * r);
    ctx.lineTo(0.2 * r, 0.56 * r);
    ctx.lineTo(0.28 * r, 0.22 * r);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (type.family === "드레이크") {
    ctx.fillStyle = "rgba(255, 218, 160, 0.68)";
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(direction * 0.42 * r, -0.12 * r);
      ctx.lineTo(direction * 1.18 * r, -0.56 * r);
      ctx.lineTo(direction * 0.9 * r, 0.42 * r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0.08 * r, 0.66 * r, 0.82 * r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f7e6c7";
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(direction * 0.34 * r, -0.62 * r);
      ctx.lineTo(direction * 0.52 * r, -1.08 * r);
      ctx.lineTo(direction * 0.04 * r, -0.7 * r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    drawMonsterEye(-0.22 * r, -0.15 * r, 0.14 * r);
    drawMonsterEye(0.22 * r, -0.15 * r, 0.14 * r);
    ctx.fillStyle = "rgba(43, 32, 34, 0.42)";
    ctx.beginPath();
    ctx.ellipse(0, 0.38 * r, 0.34 * r, 0.22 * r, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (type.family === "거미여왕") {
    ctx.strokeStyle = "#2b2022";
    ctx.lineWidth *= 0.72;
    for (const direction of [-1, 1]) {
      for (let leg = 0; leg < 4; leg += 1) {
        const y = (-0.45 + leg * 0.3) * r;
        ctx.beginPath();
        ctx.moveTo(direction * 0.38 * r, y);
        ctx.lineTo(direction * (0.85 + leg * 0.08) * r, y - 0.22 * r);
        ctx.lineTo(direction * 1.18 * r, y + (leg - 1.5) * 0.13 * r);
        ctx.stroke();
      }
    }
    ctx.lineWidth /= 0.72;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0.18 * r, 0.58 * r, 0.68 * r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -0.42 * r, 0.42 * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const x of [-0.22, 0, 0.22]) drawMonsterEye(x * r, -0.48 * r, 0.09 * r);
    return;
  }

  if (type.family === "물의 정령") {
    ctx.beginPath();
    ctx.moveTo(0, -1.05 * r);
    ctx.bezierCurveTo(0.35 * r, -0.52 * r, 0.82 * r, -0.08 * r, 0.75 * r, 0.42 * r);
    ctx.bezierCurveTo(0.65 * r, 1.03 * r, -0.66 * r, 1.03 * r, -0.75 * r, 0.42 * r);
    ctx.bezierCurveTo(-0.82 * r, -0.08 * r, -0.35 * r, -0.52 * r, 0, -1.05 * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(230, 251, 255, 0.78)";
    ctx.lineWidth *= 0.5;
    ctx.beginPath();
    ctx.arc(0, 0.2 * r, 0.34 * r, 0.2 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.lineWidth *= 2;
    drawMonsterEye(-0.22 * r, -0.18 * r, 0.12 * r);
    drawMonsterEye(0.22 * r, -0.18 * r, 0.12 * r);
    return;
  }

  ctx.fillStyle = bodyColor;
  for (const direction of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(direction * 0.34 * r, -0.62 * r);
    ctx.lineTo(direction * 0.7 * r, -1.08 * r);
    ctx.lineTo(direction * 0.05 * r, -0.78 * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 0.76 * r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawMonsterEye(-0.25 * r, -0.12 * r, 0.14 * r);
  drawMonsterEye(0.25 * r, -0.12 * r, 0.14 * r);
}

function drawEnemy(enemy) {
  const { type, radius } = enemy;
  const visualRadius = radius * MONSTER_VISUAL_SCALE;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const attackScale = 1 + Math.min(0.16, enemy.attackPulse * 0.7);
  ctx.scale(attackScale, attackScale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(visualRadius * (type.kind === "boss" ? 1.85 : 1.72))}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.shadowBlur = enemy.flash > 0 ? 30 : 16;
  ctx.shadowColor = enemy.flash > 0 ? "#fff7c9" : type.color;
  ctx.fillText(type.emoji, 0, 0);
  ctx.restore();

  if (enemy.shield > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(99, 220, 255, 0.88)";
    ctx.lineWidth = type.kind === "boss" ? 10 : 6;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#63dcff";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, visualRadius + (type.kind === "boss" ? 22 : 10), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  const barWidth = type.kind === "boss" ? 230 : visualRadius * 1.9;
  ctx.fillStyle = "rgba(30, 22, 24, 0.8)";
  roundedRect(enemy.x - barWidth / 2, enemy.y - visualRadius - 18, barWidth, 10, 5);
  ctx.fill();
  ctx.fillStyle = type.kind === "boss" ? "#ff5f57" : "#88e064";
  roundedRect(enemy.x - barWidth / 2, enemy.y - visualRadius - 18, barWidth * Math.max(0, enemy.hp / enemy.maxHp), 10, 5);
  ctx.fill();
  if (enemy.fireStack > 0 || enemy.frostStack > 0) {
    const statuses = [
      enemy.fireStack > 0 ? `🔥${Math.ceil(enemy.fireStack)}` : "",
      enemy.frostStack > 0 ? `❄️${Math.ceil(enemy.frostStack)}` : "",
    ].filter(Boolean).join("  ");
    ctx.fillStyle = "#fff5dc";
    ctx.strokeStyle = "rgba(31, 22, 24, 0.9)";
    ctx.lineWidth = 4;
    ctx.font = `900 ${type.kind === "boss" ? 22 : 14}px system-ui`;
    ctx.textAlign = "center";
    ctx.strokeText(statuses, enemy.x, enemy.y + visualRadius + 22);
    ctx.fillText(statuses, enemy.x, enemy.y + visualRadius + 22);
  }
  ctx.restore();
}

function drawProjectile(projectile) {
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate((projectile.angle ?? -Math.PI / 2) + Math.PI / 2);
  ctx.strokeStyle = "rgba(255,255,255,0.76)";
  ctx.fillStyle = projectile.color;
  ctx.lineWidth = 4;
  if (projectile.kind === "arrow" || projectile.kind === "bolt") {
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(0, -25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -29);
    ctx.lineTo(-8, -15);
    ctx.lineTo(8, -15);
    ctx.closePath();
    ctx.fill();
  } else if (projectile.kind === "heavy" || projectile.kind === "cannon") {
    ctx.fillStyle = "#30343b";
    ctx.strokeStyle = "#15181c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffb347";
    ctx.fillRect(-6, 10, 12, 30);
  } else if (projectile.kind === "gun") {
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff0a6";
    ctx.fillRect(-4, 7, 8, 16);
  } else {
    ctx.shadowBlur = 22;
    ctx.shadowColor = projectile.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-3, 8, 6, 35);
  }
  ctx.restore();
}

function drawEnemyProjectile(projectile) {
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.shadowBlur = 20;
  ctx.shadowColor = projectile.color;
  ctx.strokeStyle = "rgba(255, 244, 214, 0.9)";
  ctx.fillStyle = projectile.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(0, 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 14, projectile.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawEffects() {
  ctx.save();
  for (const effect of state.effects) {
    const alpha = Math.max(0, effect.life / effect.maxLife);
    ctx.globalAlpha = alpha * 0.72;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.radius * (1 - alpha * 0.45), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  drawBackground();
  drawHud();
  for (const enemy of state.enemies) drawEnemy(enemy);
  for (const projectile of state.projectiles) drawProjectile(projectile);
  for (const projectile of state.enemyProjectiles) drawEnemyProjectile(projectile);
  drawEffects();
  drawWall();
  drawBoard();

  if (state.phase === "combat" && state.paused) {
    ctx.fillStyle = "rgba(11, 16, 24, 0.45)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#fff7d2";
    ctx.font = "900 72px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("일시정지", WIDTH / 2, HEIGHT / 2);
  }
}

function currentStatText(type, tier = 1) {
  return ["frost", "wind", "shield", "split", "pierce", "explode", "multicast"]
    .filter((key) => tierStatValue(type, key, tier) > 0)
    .map((key) => {
      const value = tierStatValue(type, key, tier);
      const display = Number.isInteger(value) ? value : value.toFixed(1);
      if (key === "wind") return `${STAT_ICONS[key]} ${STAT_LABELS[key]} ${display}초`;
      if (key === "explode") return `${STAT_ICONS[key]} ${STAT_LABELS[key]} 반경 ${compactNumber(1.1 + value * 0.28)}칸`;
      return `${STAT_ICONS[key]} ${STAT_LABELS[key]} ${display}`;
    })
    .join(" · ");
}

function unitEffectText(type) {
  return type.desc || "가장 가까운 적 자동 공격";
}

function detailMetaHtml(type) {
  const labels = [...type.tags, type.shot ? SHOT_LABELS[type.shot] : null].filter(Boolean);
  const tags = labels.map((tag) => `<span class="tag-chip">${tag}</span>`).join("");
  return `<span class="size-chip">${SIZE_LABELS[type.size]}</span>${tags}`;
}

function popoverStatValue(type, key, tier = 1, unit = null) {
  return unit ? statsFor(unit)[key] : tierStatValue(type, key, tier);
}

function detailStatsHtml(type, tier = 1, unit = null) {
  const direct = popoverStatValue(type, "direct", tier, unit);
  const fire = popoverStatValue(type, "fire", tier, unit);
  const ammoCurrent = unit ? unit.ammo : AMMO_BY_SIZE[type.size];
  const ammoMax = unit ? unit.ammoMax : AMMO_BY_SIZE[type.size];
  const stats = [
    { key: "cooldown", icon: "⏱️", value: compactNumber(type.cooldown), label: `쿨타임 ${compactNumber(type.cooldown)}초` },
    type.tags.includes("총")
      ? { key: "ammo", icon: "🔫", value: `${ammoCurrent}/${ammoMax}`, label: `탄약 ${ammoCurrent}/${ammoMax}` }
      : null,
    direct > 0
      ? { key: "direct", icon: STAT_ICONS.direct, value: compactNumber(direct), label: `타격 ${compactNumber(direct)}` }
      : null,
    fire > 0
      ? { key: "fire", icon: STAT_ICONS.fire, value: compactNumber(fire), label: `화염 ${compactNumber(fire)}` }
      : null,
  ].filter(Boolean);

  return stats.map((stat) => `
    <span class="detail-stat detail-stat-${stat.key}" aria-label="${stat.label}">
      <span class="detail-stat-icon" aria-hidden="true">${stat.icon}</span>
      <strong class="detail-stat-value">${stat.value}</strong>
    </span>
  `).join("");
}

function detailEffectHtml(effect) {
  return `
    <div class="current-effect">
      ${effect.value ? `<strong class="effect-value">${effect.value}</strong>` : ""}
      ${effect.condition ? `<span class="effect-condition">${effect.condition}</span>` : ""}
    </div>
  `;
}

function resolveTierValues(text, tier = 1) {
  return text.replace(/[+]?\d+(?:\/[+]?\d+){2,3}/g, (match) => {
    const values = match.split("/");
    return values[Math.max(0, Math.min(values.length - 1, tier - 1))];
  });
}

function currentEffectData(type, tier = 1) {
  return {
    value: currentStatText(type, tier),
    condition: resolveTierValues(unitEffectText(type), tier),
  };
}

function currentStatsText(unit, stats = statsFor(unit)) {
  const keys = ["frost", "wind", "shield", "split", "pierce", "explode"]
    .filter((key) => stats[key] > 0);
  const values = keys.map((key) => {
    const statValue = stats[key];
    const display = Number.isInteger(statValue) ? statValue : statValue.toFixed(1);
    if (key === "wind") return `${STAT_ICONS[key]} ${STAT_LABELS[key]} ${display}초`;
    if (key === "explode") return `${STAT_ICONS[key]} ${STAT_LABELS[key]} 반경 ${compactNumber(1.1 + statValue * 0.28)}칸`;
    return `${STAT_ICONS[key]} ${STAT_LABELS[key]} ${display}`;
  });
  if (stats.casts > 1) values.push(`✦ ${stats.casts}회 시전(추가 ${Math.round(MULTICAST_POWER_SCALE * 100)}%)`);
  return values.join(" · ");
}

function activeSynergyCount(unit) {
  return adjacentUnits(unit).filter((other) => {
    const [left, right] = unit.start < other.start ? [unit, other] : [other, unit];
    return activeSynergyBetween(left, right);
  }).length;
}

function boardWindProducerActive(unit) {
  return typeFor(unit).stats.wind && adjacentUnits(unit).length > 0;
}

function globalSynergyCount(unit) {
  return boardWindProducerActive(unit) ? 1 : 0;
}

function currentPlacedEffectData(unit) {
  const type = typeFor(unit);
  const stats = statsFor(unit);
  const links = activeSynergyCount(unit);
  const globalLinks = globalSynergyCount(unit);
  const placementParts = [];
  if (links > 0) placementParts.push(`인접 시너지 ${links}개`);
  if (globalLinks > 0) placementParts.push(`전역 조건 ${globalLinks}개`);
  const effect = currentEffectData(type, unit.tier);
  return {
    value: currentStatsText(unit, stats),
    condition: [placementParts.length ? `${placementParts.join(" · ")} 활성` : "", effect.condition]
      .filter(Boolean)
      .join(" · "),
  };
}

function currentUnitEffectData(unit) {
  const type = typeFor(unit);
  const stats = statsFor(unit);
  const runtime = [];
  if (unit.windTimer > 0) runtime.push(`바람 ${unit.windTimer.toFixed(1)}초`);
  runtime.push(resolveTierValues(unitEffectText(type), unit.tier));
  return { value: currentStatsText(unit, stats), condition: runtime.join(" · ") };
}

function showShopPopover(offerIndex) {
  const typeId = state.shop[offerIndex];
  if (!typeId) {
    shopDetail.hidden = true;
    return;
  }
  const type = unitTypes[typeId];
  const effect = currentEffectData(type, 1);
  shopDetail.style.setProperty("--unit-color", type.color);
  shopDetail.innerHTML = `
    ${detailStatsHtml(type)}
    <div class="detail-head">
      <strong class="detail-title">${type.emoji} ${type.name}</strong>
      <span class="detail-meta">${detailMetaHtml(type)}</span>
    </div>
    ${detailEffectHtml(effect)}
  `;
  shopDetail.hidden = false;
}

function hideShopPopover() {
  shopDetail.hidden = true;
  shopDetail.innerHTML = "";
}

function boardUnitByUid(uid) {
  return state.board.find((unit) => unit.uid === uid) || null;
}

function boardUnitAtPoint(point) {
  if (point.y < BOARD_Y - 220 || point.y > HEIGHT) return null;
  return state.board.find((unit) => {
    const left = unit.start * SLOT_WIDTH;
    const right = (unit.start + unitSize(unit)) * SLOT_WIDTH;
    return point.x >= left && point.x <= right;
  }) || null;
}

function showUnitPopover(unit) {
  if (!unit) {
    unitDetail.hidden = true;
    return;
  }
  const type = typeFor(unit);
  const location = locationForUnit(unit);
  let effect;
  if (location === "stash") {
    effect = currentEffectData(type, unit.tier);
  } else {
    effect = state.phase === "combat" ? currentUnitEffectData(unit) : currentPlacedEffectData(unit);
  }
  const centerPercent = ((unit.start + unitSize(unit) / 2) / SLOT_COUNT) * 100;
  unitDetail.className = `unit-popover tier-${Math.min(MAX_TIER, unit.tier)}`;
  unitDetail.style.setProperty("--unit-color", type.color);
  unitDetail.style.setProperty("--popover-x", `${Math.max(18, Math.min(82, centerPercent))}%`);
  unitDetail.innerHTML = `
    ${detailStatsHtml(type, unit.tier, unit)}
    <div class="detail-head">
      <strong class="detail-title">${type.emoji} ${type.name}</strong>
      <span class="detail-meta">${detailMetaHtml(type)}</span>
    </div>
    ${detailEffectHtml(effect)}
  `;
  unitDetail.hidden = false;
}

function refreshUnitPopover() {
  const unit = boardUnitByUid(hoveredBoardUid) || boardUnitByUid(pinnedBoardUid);
  if (unit) showUnitPopover(unit);
  else {
    unitDetail.hidden = true;
    unitDetail.innerHTML = "";
  }
}

function renderPrep() {
  goldText.textContent = state.coins;
  rerollButton.disabled = state.phase !== "prep" || state.coins < 2;
  stashDock.hidden = false;

  const selectedOfferIndex =
    Number.isInteger(state.selectedShopIndex) && state.shop[state.selectedShopIndex]
      ? state.selectedShopIndex
      : null;
  state.selectedShopIndex = selectedOfferIndex;

  shopOffers.innerHTML = "";
  state.shop.forEach((typeId, offerIndex) => {
    if (!typeId) {
      const outcome = state.shopOutcomes[offerIndex];
      const upgraded = outcome?.kind === "upgrade";
      const resultTier = Math.max(1, Math.min(MAX_TIER, outcome?.tier || 1));
      const soldCard = document.createElement("article");
      soldCard.className = `offer-card sold${upgraded ? ` upgrade-result tier-${resultTier}` : ""}`;
      soldCard.innerHTML = `<span class="sold-label">${upgraded ? `⬆ ${TIER_NAMES[resultTier]} 승급!` : "영입 완료"}</span>`;
      shopOffers.appendChild(soldCard);
      return;
    }
    const type = unitTypes[typeId];
    const card = document.createElement("article");
    const selected = selectedOfferIndex === offerIndex;
    const boardFit = findFirstFit(state.board, type.size) >= 0;
    const stashFit = findFirstFit(state.stash, type.size) >= 0;
    const mergeFit = mergeCandidates(typeId, 1).length > 0;
    const canHire = state.phase === "prep" && state.coins >= type.cost && (mergeFit || boardFit || stashFit);
    card.className = `offer-card tier-1${selected ? " selected" : ""}${mergeFit ? " merge-ready" : ""}`;
    card.style.setProperty("--unit-color", type.color);
    card.dataset.offerIndex = String(offerIndex);
    card.innerHTML = `
      <span class="size-chip" aria-label="크기 ${SIZE_LABELS[type.size]}">${SIZE_LABELS[type.size]}</span>
      <strong class="offer-name">${type.name}</strong>
      ${mergeFit ? '<span class="upgrade-badge" aria-label="합성 가능">↑</span>' : ""}
      <button class="offer-info-button" type="button" aria-label="${type.name}, ${SIZE_LABELS[type.size]}, 정보 보기" aria-expanded="${selected}" aria-controls="shopDetail">
        <span class="offer-icon" aria-hidden="true">${type.emoji}</span>
      </button>
      <div class="offer-divider" aria-hidden="true"></div>
      <button class="offer-buy-button" type="button" aria-label="${type.name} ${mergeFit ? "업그레이드" : "구매"}, ${type.cost}골드" ${canHire ? "" : "disabled"}>
        ${mergeFit ? "↑ 업그레이드" : `${type.cost}G 구매`}
      </button>
    `;
    card.addEventListener("mouseenter", () => showShopPopover(offerIndex));
    card.addEventListener("mouseleave", () => {
      if (Number.isInteger(state.selectedShopIndex) && state.shop[state.selectedShopIndex]) {
        showShopPopover(state.selectedShopIndex);
      } else {
        hideShopPopover();
      }
    });
    card.addEventListener("focusin", () => showShopPopover(offerIndex));
    card.addEventListener("focusout", (event) => {
      if (card.contains(event.relatedTarget)) return;
      if (Number.isInteger(state.selectedShopIndex) && state.shop[state.selectedShopIndex]) {
        showShopPopover(state.selectedShopIndex);
      } else {
        hideShopPopover();
      }
    });
    card.querySelector(".offer-info-button").addEventListener("click", () => {
      state.selectedShopIndex = state.selectedShopIndex === offerIndex ? null : offerIndex;
      renderPrep();
    });
    card.querySelector(".offer-buy-button").addEventListener("click", () => buyUnit(typeId, offerIndex));
    shopOffers.appendChild(card);
  });

  if (selectedOfferIndex === null) {
    hideShopPopover();
  } else {
    showShopPopover(selectedOfferIndex);
  }

  stashTrack.innerHTML = "";
  for (const unit of state.stash) {
    const type = typeFor(unit);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `stash-unit ${state.selected?.location === "stash" && state.selected.uid === unit.uid ? "selected" : ""}`;
    button.style.left = `${unit.start * 10}%`;
    button.style.width = `${type.size * 10}%`;
    button.style.setProperty("--unit-color", type.color);
    button.style.setProperty("--unit-accent", type.accent);
    button.classList.add(`tier-${Math.min(MAX_TIER, unit.tier)}`);
    button.dataset.uid = String(unit.uid);
    button.dataset.size = String(type.size);
    button.setAttribute("aria-disabled", state.phase === "prep" ? "false" : "true");
    button.setAttribute("aria-label", `${type.name}, ${SIZE_LABELS[type.size]}, ${TIER_NAMES[unit.tier]}${state.phase === "prep" ? " 선택" : " 정보 보기"}`);
    button.innerHTML = `
      <span class="stash-figure" aria-hidden="true">
        <span class="stash-shadow"></span>
        <span class="stash-body"></span>
        <span class="stash-head"><span class="stash-emoji">${type.emoji}</span></span>
        <span class="stash-weapon projectile-${type.projectile}"></span>
      </span>
    `;
    button.addEventListener("mouseenter", () => showUnitPopover(unit));
    button.addEventListener("mouseleave", refreshUnitPopover);
    button.addEventListener("focus", () => showUnitPopover(unit));
    button.addEventListener("blur", refreshUnitPopover);
    button.addEventListener("click", () => {
      if (state.phase !== "prep") {
        showUnitPopover(unit);
        return;
      }
      if (state.selected?.location === "stash" && state.selected.uid === unit.uid) return;
      state.selected = { location: "stash", uid: unit.uid };
      renderPrep();
    });
    stashTrack.appendChild(button);
  }

  const needsFirstHire = state.wave === 0 && !state.hasHiredAny;
  startWaveButton.disabled = state.board.length === 0 || needsFirstHire;
  startWaveButton.textContent = needsFirstHire ? "용병을 선택하세요" : "웨이브 시작";
  refreshStashControls();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

canvas.addEventListener("pointermove", (event) => {
  const unit = boardUnitAtPoint(canvasPoint(event));
  const nextUid = unit?.uid || null;
  if (hoveredBoardUid === nextUid) return;
  hoveredBoardUid = nextUid;
  refreshUnitPopover();
});

canvas.addEventListener("pointerleave", () => {
  hoveredBoardUid = null;
  refreshUnitPopover();
});

canvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  const inspectedUnit = boardUnitAtPoint(point);
  if (state.phase === "combat") {
    pinnedBoardUid = inspectedUnit && pinnedBoardUid !== inspectedUnit.uid ? inspectedUnit.uid : null;
    hoveredBoardUid = event.pointerType === "mouse" ? inspectedUnit?.uid || null : null;
    refreshUnitPopover();
    return;
  }
  if (state.phase !== "prep") return;
  if (event.pointerType !== "mouse") {
    pinnedBoardUid = inspectedUnit && pinnedBoardUid !== inspectedUnit.uid ? inspectedUnit.uid : null;
    refreshUnitPopover();
  }
  if (point.y < BOARD_Y) return;
  const slot = Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(point.x / SLOT_WIDTH)));
  const clicked = state.board.find((unit) => slot >= unit.start && slot < unit.start + unitSize(unit));
  const current = selectedUnit();
  if (clicked && (!current || current.uid !== clicked.uid || state.selected?.location !== "board")) {
    state.selected = { location: "board", uid: clicked.uid };
    pinnedBoardUid = clicked.uid;
    refreshUnitPopover();
    renderPrep();
    return;
  }
  if (!state.selected) return;
  moveSelectedOnBoard(slot);
});

stashTrack.addEventListener("pointerdown", (event) => {
  const unitButton = event.target.closest(".stash-unit");
  if (unitButton) {
    const unit = state.stash.find((candidate) => candidate.uid === Number(unitButton.dataset.uid));
    if (unit) showUnitPopover(unit);
    if (state.phase !== "prep") return;
    state.selected = { location: "stash", uid: Number(unitButton.dataset.uid) };
    renderPrep();
    return;
  }
  if (state.phase !== "prep") return;
  const rect = stashTrack.getBoundingClientRect();
  const slot = Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(((event.clientX - rect.left) / rect.width) * SLOT_COUNT)));
  moveSelectedOnStash(slot);
});

pauseButton.addEventListener("click", () => {
  if (state.phase !== "combat") return;
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
});

speedButton.addEventListener("click", () => {
  state.speed = state.speed === 1 ? 2 : 1;
  speedButton.textContent = `×${state.speed}`;
});

rerollButton.addEventListener("click", () => {
  if (state.phase !== "prep" || state.coins < 2) return;
  state.coins -= 2;
  setMessage("상점 목록을 새로고침했습니다.");
  rollShop();
});

startWaveButton.addEventListener("click", startWave);
restartButton.addEventListener("click", restart);
sellButton.addEventListener("click", sellSelectedUnit);

function frame(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  update(dt);
  if (state.phase === "combat" && timestamp - lastPopoverRefresh >= 200 && (hoveredBoardUid || pinnedBoardUid)) {
    lastPopoverRefresh = timestamp;
    refreshUnitPopover();
  }
  draw();
  requestAnimationFrame(frame);
}

restart();
requestAnimationFrame(frame);
