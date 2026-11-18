/**
 * 牧场每日福利
 *
 * 官方商城：slot_type=6（牧场福利槽），商品 2001 为牧场每日免费福利，价格 0 且受每日限购。
 * 调用链：GetMallListBySlotType(6, scene 2) → Purchase(2001, count 1)
 */
const { sendMsgAsync } = require('../utils/network');
const { types } = require('../utils/proto');
const { log, toNum } = require('../utils/utils');
const { getItemById } = require('../config/gameConfig');

const SLOT_TYPE = 6;
const GLOBAL_SCENE_ID = 2;
const GOODS_ID = 2001;
const EVENT_KEY = 'ranch_daily_benefit';

let doneDateKey = '';
let lastAt = 0;

function getDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function bytesToBuffer(value) {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return Buffer.from(value);
  if (typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
  return null;
}

/** 解析 mallpb.PurchaseLimit: 1=limit_type, 2=bought_count, 3=limit_count */
function parsePurchaseLimit(raw) {
  const empty = { limitType: 0, boughtCount: 0, limitCount: 0 };
  const buf = bytesToBuffer(raw);
  if (!buf?.length) return empty;
  try {
    const reader = require('protobufjs').Reader.create(buf);
    const out = { ...empty };
    while (reader.pos < reader.len) {
      const tag = reader.uint32();
      const field = tag >>> 3;
      if (field === 1) out.limitType = reader.int32();
      else if (field === 2) out.boughtCount = toNum(reader.int64());
      else if (field === 3) out.limitCount = toNum(reader.int64());
      else reader.skipType(tag & 7);
    }
    return out;
  }
  catch {
    return empty;
  }
}

async function getMallList() {
  const req = types.GetMallListBySlotTypeRequest.encode(types.GetMallListBySlotTypeRequest.create({
    slot_type: SLOT_TYPE,
    is_manual_open: true,
    global_scene_id: GLOBAL_SCENE_ID,
  })).finish();
  const { body } = await sendMsgAsync('gamepb.mallpb.MallService', 'GetMallListBySlotType', req);
  return types.GetMallListBySlotTypeResponse.decode(body);
}

async function purchase(goodsId, count = 1) {
  const req = types.PurchaseRequest.encode(types.PurchaseRequest.create({ goods_id: Number(goodsId), count: Number(count) })).finish();
  const { body } = await sendMsgAsync('gamepb.mallpb.MallService', 'Purchase', req);
  return types.PurchaseResponse.decode(body);
}

/** 读取 2001 当前的可领状态 */
async function readBenefitGoods() {
  const reply = await getMallList();
  const list = Array.isArray(reply?.goods_list) ? reply.goods_list : [];
  for (const raw of list) {
    let good;
    try {
      good = types.MallGoods.decode(raw);
    }
    catch {
      continue;
    }
    if (String(good.goods_id) !== String(GOODS_ID)) continue;
    const limit = parsePurchaseLimit(good.purchase_limit);
    const remaining = limit.limitCount > 0 ? limit.limitCount - limit.boughtCount : null;
    return { good, limit, remaining, claimable: remaining === null ? true : remaining > 0 };
  }
  return null;
}

function rewardText(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map((item) => {
    const id = toNum(item.id);
    const count = toNum(item.count);
    if (count <= 0) return '';
    const info = getItemById(id);
    return `${info?.name || `物品#${id}`}x${count}`;
  }).filter(Boolean).join('/');
}

/**
 * 领取牧场每日福利
 * @param {{ force?: boolean }} options
 */
async function claimDailyBenefit(options = {}) {
  if (!options.force && doneDateKey === getDateKey())
    return { claimed: false, skipped: true, rewards: [] };

  try {
    const found = await readBenefitGoods();
    if (!found) {
      log('牧场', '商城未上架每日福利', { module: 'ranch', event: EVENT_KEY, result: 'none' });
      doneDateKey = getDateKey();
      return { claimed: false, skipped: true, rewards: [] };
    }
    if (!found.claimable) {
      doneDateKey = getDateKey();
      log('牧场', '每日福利今日已领取', { module: 'ranch', event: EVENT_KEY, result: 'none' });
      return { claimed: false, skipped: true, rewards: [] };
    }

    const reply = await purchase(GOODS_ID, 1);
    const ok = reply?.success === true || (reply?.reward_items?.length || 0) > 0;
    if (!ok) throw new Error('福利购买回包未确认成功');

    doneDateKey = getDateKey();
    lastAt = Date.now();
    const rewards = reply.reward_items || [];
    log('牧场', `每日福利已领取：${rewardText(rewards) || '已到账'}`, { module: 'ranch', event: EVENT_KEY, result: 'ok' });
    return { claimed: true, skipped: false, rewards };
  }
  catch (err) {
    log('牧场', `每日福利领取失败：${err.message}`, { module: 'ranch', event: EVENT_KEY, result: 'error' });
    throw err;
  }
}

module.exports = {
  GOODS_ID,
  SLOT_TYPE,
  readBenefitGoods,
  claimDailyBenefit,
  getBenefitDailyState: () => ({ key: EVENT_KEY, doneToday: doneDateKey === getDateKey(), lastAt }),
};
