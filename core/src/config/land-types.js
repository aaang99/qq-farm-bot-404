const LAND_TYPES = require('../gameConfig/LandTypes.json');

const ALL_FERTILIZER_LAND_TYPES = [...LAND_TYPES].reverse().map(land => land.type);
const FERTILIZER_LAND_TYPE_LABELS = Object.fromEntries(LAND_TYPES.map(land => [land.type, land.name]));
const LEGACY_LAND_TYPES = ALL_FERTILIZER_LAND_TYPES.filter(type => type !== 'blue');

function getLandTypeByLevel(level) {
  const value = Number(level) || 1;
  return LAND_TYPES.find(land => land.level === value)?.type || 'unknown';
}

function getLandTypeNameByLevel(level) {
  return FERTILIZER_LAND_TYPE_LABELS[getLandTypeByLevel(level)] || '未知土地';
}

function normalizeFertilizerLandTypes(raw, fallback = ALL_FERTILIZER_LAND_TYPES, migrateLegacy = false) {
  const input = Array.isArray(raw) ? raw : fallback;
  const result = [...new Set(input.map(value => String(value || '').trim().toLowerCase()))]
    .filter(type => ALL_FERTILIZER_LAND_TYPES.includes(type));
  // Only migrate the old complete selection once. Explicit subsets and empty selections stay intact.
  if (migrateLegacy && result.length === LEGACY_LAND_TYPES.length && LEGACY_LAND_TYPES.every(type => result.includes(type))) {
    result.unshift('blue');
  }
  return result;
}

function filterLandIdsByTypes(landIds, landTypeMap, allowedTypes) {
  const types = new Set(normalizeFertilizerLandTypes(allowedTypes));
  return (Array.isArray(landIds) ? landIds : []).filter(id => types.has(landTypeMap.get(id)));
}

module.exports = {
  LAND_TYPES, ALL_FERTILIZER_LAND_TYPES, FERTILIZER_LAND_TYPE_LABELS,
  getLandTypeByLevel, getLandTypeNameByLevel, normalizeFertilizerLandTypes, filterLandIdsByTypes,
};
