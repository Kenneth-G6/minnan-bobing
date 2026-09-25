/**
 * 博饼核心类型定义与常量
 *
 * 本文件所有常量均为「厦门常见规则」的写死默认值，
 * 不提供任何地方差异配置，修改规则请直接改这里 + rules.ts。
 */

/** 奖项机器键（状元为结算时发放的总奖） */
export type PrizeKey =
  | 'yixiu' // 一秀
  | 'erju' // 二举
  | 'sijin' // 四进
  | 'sanhong' // 三红
  | 'duitang' // 对堂
  | 'zhuangyuan'; // 状元

/** 奖项类别：普通奖 / 状元类 / 无奖 */
export type PrizeType = 'normal' | 'zhuangyuan' | 'none';

/** 单次掷骰的判定结果 */
export interface RollResult {
  /** 奖项机器键；无奖时为 null */
  prizeKey: PrizeKey | null;
  /** 奖项显示名，如「状元插金花」 */
  prize: string;
  /** 奖项等级，越大越高；无奖为 0 */
  level: number;
  /** 奖项类别 */
  type: PrizeType;
  /**
   * 同等级比较键（用于状元更替判定）。
   * 语义：按数组下标依次比较，数值大者胜；完全相等则先到先得。
   * 唯一奖项（插金花 / 六杯红 / 遍地锦）为空数组。
   */
  tiebreak: number[];
  /** 人类可读说明 */
  desc: string;
}

/**
 * 状元类奖项的最低等级。
 * 等级 >= 6 即四红及以上，均为状元类（参与「当前状元」争夺）。
 * 注意：对堂(5)、三红(4) 虽等级高，但属于普通奖。
 */
export const ZHUANGYUAN_MIN_LEVEL = 6;

/** 普通奖机器键（由低到高） */
export const NORMAL_PRIZE_KEYS: PrizeKey[] = [
  'yixiu',
  'erju',
  'sijin',
  'sanhong',
  'duitang',
];

/** 全部奖项元数据：显示名、等级、初始数量 */
export const PRIZE_META: Record<
  PrizeKey,
  { name: string; level: number; count: number; desc: string; type: PrizeType }
> = {
  yixiu: { name: '一秀', level: 1, count: 32, desc: '1 个 4', type: 'normal' },
  erju: { name: '二举', level: 2, count: 16, desc: '2 个 4', type: 'normal' },
  sijin: { name: '四进', level: 3, count: 8, desc: '4 个同点（该点不是 4）', type: 'normal' },
  sanhong: { name: '三红', level: 4, count: 4, desc: '3 个 4', type: 'normal' },
  duitang: { name: '对堂', level: 5, count: 2, desc: '1、2、3、4、5、6 各一个', type: 'normal' },
  zhuangyuan: { name: '状元', level: 12, count: 1, desc: '状元类奖项中最高者', type: 'zhuangyuan' },
};

/* ============================================================
   玩法模式
   ============================================================ */

/**
 * 玩法模式。
 *   - classic     经典博饼：博全套奖品，五个普通奖发完收官
 *   - zhuangyuan  状元争：只争状元，每个回合连掷到博出状元类为止，
 *                 一圈之内无人超越当前擂主即收官
 */
export type GameMode = 'classic' | 'zhuangyuan';

/** 模式元数据（界面展示用） */
export const MODE_META: Record<GameMode, { name: string; tagline: string }> = {
  classic: {
    name: '经典博饼',
    tagline: '博全套奖品，五个普通奖发完收官',
  },
  zhuangyuan: {
    name: '状元争',
    tagline: '只争状元，一圈无人超越即夺冠',
  },
};

/** 状元争认可的最低等级 —— 四红及以上 7 级 */
export const DUEL_MIN_LEVEL = ZHUANGYUAN_MIN_LEVEL;

/**
 * 状元争认可的 7 级奖项（由高到低）。
 * 组合数由穷举 6⁶ = 46656 组精确算得，合计 561 组 / 1.2024%，仅用于界面展示。
 */
export const ZHUANGYUAN_TIERS: ReadonlyArray<{
  level: number;
  name: string;
  combo: string;
  combos: number;
  rate: string;
}> = [
  { level: 12, name: '状元插金花', combo: '4 个 4 + 2 个 1', combos: 15, rate: '0.0321%' },
  { level: 11, name: '六杯红', combo: '6 个 4', combos: 1, rate: '0.0021%' },
  { level: 10, name: '遍地锦', combo: '6 个 1', combos: 1, rate: '0.0021%' },
  { level: 9, name: '六勃黑', combo: '6 个 2 / 3 / 5 / 6', combos: 4, rate: '0.0086%' },
  { level: 8, name: '五王', combo: '5 个 4', combos: 30, rate: '0.0643%' },
  { level: 7, name: '五子', combo: '5 个同点（非 4）', combos: 150, rate: '0.3215%' },
  { level: 6, name: '四红', combo: '4 个 4', combos: 360, rate: '0.7716%' },
];

/** 状元争的合计命中率（7 级 / 6⁶） */
export const DUEL_HIT_RATE = '1.2024%';

/** 骰子数量 */
export const DICE_COUNT = 6;

/** 骰子面数 */
export const DICE_FACES = 6;

/** 默认玩家数 */
export const DEFAULT_PLAYER_COUNT = 6;

/** 允许的玩家数范围 */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;

/** 初始奖池（深拷贝，避免共享引用） */
export function createInitialPool(): Record<PrizeKey, number> {
  return {
    yixiu: PRIZE_META.yixiu.count,
    erju: PRIZE_META.erju.count,
    sijin: PRIZE_META.sijin.count,
    sanhong: PRIZE_META.sanhong.count,
    duitang: PRIZE_META.duitang.count,
    zhuangyuan: PRIZE_META.zhuangyuan.count,
  };
}

/** 空奖项计数 */
export function createEmptyPrizeCount(): Record<PrizeKey, number> {
  return {
    yixiu: 0,
    erju: 0,
    sijin: 0,
    sanhong: 0,
    duitang: 0,
    zhuangyuan: 0,
  };
}
