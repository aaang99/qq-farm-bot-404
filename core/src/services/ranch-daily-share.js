/**
 * 牧场每日分享礼包
 *
 * 官方 Share 表：share_id=102 为牧场每日分享，奖励 80021 x5，与农场（share_id=1）彼此独立。
 * 调用链：CheckCanShare → ReportShare(102/2101) → ClaimShareReward
 */
const { sendMsgAsync } = require('../utils/network');
const { types } = require('../utils/proto');
const { log, toNum } = require('../utils/utils');
const { getItemById } = require('../config/gameConfig');

const SHARE_ID = 102;
const DOC_ID = 2101;
/** 记录服务端接受的 ReportShare 字段组合：onlyId=仅 field_1，both=field_1+field_4 */
let shareFieldMode = 'onlyId';
const REWARD_ITEM_ID = 80021;
const EVENT_KEY = 'ranch_daily_share';

// 服务端 share 状态缓存：{ shareCount, claimed, dateKey }
let shareState = null;

function getDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function todayState() {
  const dateKey = getDateKey();
  if (!shareState || shareState.dateKey !== dateKey)
    shareState = { shareCount: '0', claimed: false, dateKey };
  return shareState;
}

/** 吸收服务端回包的 share_infos，保持与官方状态同步 */
function applyShareInfos(infos) {
  if (!infos) return;
  const entry = Object.entries(infos).find(([key]) => String(key) === String(SHARE_ID));
  if (!entry) return;
  const [, info] = entry;
  const dateKey = getDateKey();
  shareState = { shareCount: String(info.share_count ?? '0'), claimed: !!info.is_claimed, dateKey };
}

function getState() {
  const state = todayState();
  return { ...state, shared: BigInt(state.shareCount || '0') > 0n };
}

async function checkCanShare() {
  const req = types.CheckCanShareRequest.encode(types.CheckCanShareRequest.create({})).finish();
  const { body } = await sendMsgAsync('gamepb.sharepb.ShareService', 'CheckCanShare', req);
  return types.CheckCanShareReply.decode(body);
}

async function reportShare() {
  // 服务端对多余字段会整体拒绝（code=1000020），只发送 field_1
  const req = types.ReportShareRequest.encode(
    types.ReportShareRequest.create({ field_1: SHARE_ID })
  ).finish();
  const { body } = await sendMsgAsync('gamepb.sharepb.ShareService', 'ReportShare', req);
  return body;
}

async function claimShareReward() {
  const req = types.ClaimShareRewardRequest.encode(types.ClaimShareRewardRequest.create({ claimed: true })).finish();
  const { body } = await sendMsgAsync('gamepb.sharepb.ShareService', 'ClaimShareReward', req);
  if (!body || !body.length) return { items: [] };
  const reply = types.ClaimShareRewardReply.decode(body);
  return { items: reply.items || [] };
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
 * 领取牧场每日分享礼包
 * @param {{ force?: boolean }} options
 * @returns {Promise<{ claimed: boolean, skipped: boolean, rewards: any[] }>}
 */
async function claimDailyShare(options = {}) {
  const state = getState();
  if (state.claimed && !options.force)
    return { claimed: false, skipped: true, rewards: [] };

  try {
    if (!state.shared) {
      const check = await checkCanShare();
      if (!check.can_share) {
        log('牧场', '当前分享入口不可用', { module: 'ranch', event: EVENT_KEY, result: 'none' });
        return { claimed: false, skipped: true, rewards: [] };
      }
      const reportBody = await reportShare();
      // 回包若携带 share_infos 则同步；不带则乐观置为已分享
      if (reportBody?.length) {
        try {
          const reply = types.ReportShareReply.decode(reportBody);
          if (reply?.share_infos) applyShareInfos(reply.share_infos);
        }
        catch { /* 回包结构差异时忽略，按已分享处理 */ }
      }
      if (!getState().shared) {
        const cur = todayState();
        shareState = { ...cur, shareCount: '1' };
      }
    }

    const before = getState();
    if (before.claimed) return { claimed: false, skipped: true, rewards: [] };

    const { items } = await claimShareReward();
    const cur = todayState();
    shareState = { ...cur, claimed: true };

    log('牧场', `每日首次分享礼包已领取：${rewardText(items) || `物品#${REWARD_ITEM_ID}x5`}`, { module: 'ranch', event: EVENT_KEY, result: 'ok' });
    return { claimed: true, skipped: false, rewards: items };
  }
  catch (err) {
    log('牧场', `每日分享礼包领取失败：${err.message}`, { module: 'ranch', event: EVENT_KEY, result: 'error' });
    throw err;
  }
}

module.exports = {
  SHARE_ID,
  DOC_ID,
  getState,
  applyShareInfos,
  claimDailyShare,
  getShareDailyState: () => ({ key: EVENT_KEY, doneToday: todayState().claimed, claimed: todayState().claimed, shared: getState().shared, shareCount: getState().shareCount }),
};
