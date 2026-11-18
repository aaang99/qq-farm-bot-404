const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('pet');

const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3小时检测一次
const PROTECT_THRESHOLD_SEC = 24 * 3600; // 守护剩余不足24小时补粮
const FOOD_IDS = [90004, 90005, 90006]; // 1天 / 3天 / 5天狗粮
const DOG_FOOD_GIFT_GOODS_ID = 1006; // 商城「狗粮礼包」
const lastCheckMap = new Map(); // accountId -> timestamp

/** 优先吃 1天，其次 3天，再 5天 */
function pickFood(foods) {
  for (const id of FOOD_IDS) {
    const hit = foods.find(f => f.count > 0 && f.id === id);
    if (hit) return hit;
  }
  return null;
}

async function checkAndAutoPet(accountId) {
  if (!accountId) return;

  const now = Date.now();
  const lastCheck = lastCheckMap.get(accountId) || 0;
  if (now - lastCheck < CHECK_INTERVAL_MS) {
    return;
  }

  // 只记录「已尝试」，失败时回滚，避免一次异常吃掉整个检查窗口
  lastCheckMap.set(accountId, now);

  try {
    const store = require('../models/store');
    const autoCfg = store.getAutomation ? store.getAutomation(accountId) : {};
    const autoBuyFood = autoCfg.auto_buy_dog_food === true;
    const autoFeedDog = autoCfg.auto_feed_dog === true;

    if (!autoBuyFood && !autoFeedDog) return;

    const pets = require('./pets');
    const overview = await pets.getPetOverview();
    if (!overview || !overview.deployedId) return;

    const remainingSec = Number(overview.foodSeconds) || 0;
    const remainingHours = Math.floor(remainingSec / 3600);

    // 只在守护时长不足时动作，避免无意义消耗
    if (remainingSec >= PROTECT_THRESHOLD_SEC) return;

    const foods = Array.isArray(overview.foods) ? overview.foods : [];
    const stockFood = pickFood(foods);

    // 背包已有粮但没开自动喂食：不重复采购，交给用户处理
    if (stockFood && !autoFeedDog) return;

    let availableFood = stockFood;

    // 背包无粮 + 开启了自动买粮：先补货（不依赖 autoFeedDog，独立生效）
    if (!availableFood && autoBuyFood) {
      const mall = require('./mall');
      try {
        await mall.purchaseMallGoods(DOG_FOOD_GIFT_GOODS_ID, 1);
        logger.info('背包狗粮已耗尽，已自动在商城购买【狗粮礼包】');
        const nextOverview = await pets.getPetOverview();
        foods = Array.isArray(nextOverview.foods) ? nextOverview.foods : [];
        availableFood = pickFood(foods);
        if (!availableFood) {
          logger.warn('狗粮礼包购买成功但背包仍无可用狗粮，跳过喂食');
        }
      } catch (mallErr) {
        logger.warn(`自动买狗粮失败: ${mallErr.message}`);
      }
    }

    // 喂食：仅当开启了自动喂食且拿到了粮
    if (autoFeedDog && availableFood) {
      await pets.feedDog(availableFood.id, 1);
      logger.info(`守护剩余不足24小时(当前${remainingHours}小时)，已自动喂食【${availableFood.name}】x1`);
    }
  } catch (err) {
    // 失败不占用检查窗口，下个 tick 立即重试
    lastCheckMap.delete(accountId);
    logger.warn(`宠物守护巡查异常(3小时周期): ${err.message}`);
  }
}

module.exports = {
  checkAndAutoPet,
  resetPetPacing: (id) => lastCheckMap.delete(id)
};
