const levels = require('../gameConfig/LandLevel.json');
const upgradeCosts = require('../gameConfig/LandLevelNeed.json');
const { getItemById, getItemImageById } = require('../config/gameConfig');

const number = value => Number(value?.toString?.() ?? value) || 0;
const amount = value => (/^\d+$/.test(String(value)) ? String(value) : '0');

function levelInfo(level, buff) {
  const config = levels.find(entry => number(entry.id) === number(level));
  if (!config)
    return null;
  return {
    level: number(level),
    name: config.level_name,
    image: `/game-config/land_images/land_valid${level}.png`,
    yieldBonus: number(buff?.plant_yield_bonus ?? config.plant_yield_bonus) / 100,
    growthReduction: number(buff?.planting_time_reduction ?? config.planting_time_reduction) / 100,
    expBonus: number(buff?.plant_exp_bonus ?? config.plant_exp_bonus) / 100,
    mutantMultiplier: number(config.plant_mutant_bonus) / 10000,
    resonanceBonus: number(config.plant_mutant_exp_bonus) / 100,
  };
}

function costs(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => number(item.id) > 0 && number(item.count) > 0)
    .map(item => ({
      id: String(item.id),
      count: amount(item.count),
      name: getItemById(number(item.id))?.name || `物品 ${item.id}`,
      image: getItemImageById(number(item.id)) || '',
    }));
}

function parseConfigItems(value) {
  return String(value || '')
    .split(';')
    .filter(Boolean)
    .map((part) => {
      const [itemId, count] = part.split(':');
      return { id: itemId, count };
    });
}

function buildLandUpgradeDetail(land, landsMap = new Map()) {
  const id = number(land?.id);
  const level = number(land?.level);
  const maxLevel = number(land?.max_level);
  const current = land?.unlocked ? levelInfo(level, land?.buff) : null;

  if (!land?.unlocked) {
    const condition = land?.unlock_condition;
    const precedingId = number(condition?.preceding_land_id);
    return {
      mode: 'unlock',
      current,
      next: levelInfo(1),
      serverAllowed: !!land?.could_unlock,
      needLevel: condition ? number(condition.need_level) || null : null,
      prerequisite: precedingId
        ? { landId: precedingId, met: !!landsMap.get(precedingId)?.unlocked }
        : null,
      costs: costs([{ id: 1001, count: condition?.need_gold }]),
      unknown: !condition,
    };
  }

  if (maxLevel > 0 && level >= maxLevel)
    return { mode: 'max', current, next: null, costs: [], unknown: !current };

  const next = levelInfo(level + 1);
  const condition = land?.upgrade_condition;
  const config = upgradeCosts.find(entry => number(entry.land_id) === id && number(entry.level) === level + 1);
  const configItems = parseConfigItems(config?.items_need);
  const precedingCount = condition ? number(condition.preceeding_lands_count_need) || 1 : 0;
  const precedingOwned = landsMap.size > 0
    ? [...landsMap.values()].filter(entry => entry.unlocked && number(entry.level) >= level).length
    : null;

  return {
    mode: 'upgrade',
    current,
    next,
    serverAllowed: !!land?.could_upgrade,
    needLevel: condition ? number(condition.level_need) || null : (config?.level_need ?? null),
    prerequisite: null,
    precedingLands: precedingCount > 0
      ? {
          name: current?.name || `等级${level}土地`,
          required: precedingCount,
          owned: precedingOwned,
          met: precedingOwned === null ? null : precedingOwned >= precedingCount,
        }
      : null,
    costs: costs(condition ? (condition.items_need || []) : configItems),
    unknown: !next || (condition ? !number(condition.level_need) || precedingOwned === null : !config),
  };
}

module.exports = { buildLandUpgradeDetail, levelInfo };