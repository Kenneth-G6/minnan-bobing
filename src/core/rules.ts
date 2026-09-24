/**
 * 博饼核心规则 —— 纯函数，零 UI 依赖
 *
 * 判定策略：从高到低的有序判定链，命中最高奖项后立即停止。
 * 顺序即优先级，顺序错误会导致误判，请勿随意调整。
 */
import {
  DICE_COUNT,
  DICE_FACES,
  ZHUANGYUAN_MIN_LEVEL,
  type PrizeKey,
  type RollResult,
} from './types';

/** 统计各点数出现次数，索引 1–6 */
function countFaces(dice: number[]): Record<number, number> {
  const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const d of dice) c[d] += 1;
  return c;
}

/** 构造判定结果（自动推导类别） */
function make(
  prizeKey: PrizeKey | null,
  prize: string,
  level: number,
  tiebreak: number[],
  desc: string,
): RollResult {
  const type = prizeKey === null ? 'none' : level >= ZHUANGYUAN_MIN_LEVEL ? 'zhuangyuan' : 'normal';
  return { prizeKey, prize, level, type, tiebreak, desc };
}

/** 无奖常量（冻结以避免意外修改） */
const NO_PRIZE: RollResult = Object.freeze({
  prizeKey: null,
  prize: '无奖',
  level: 0,
  type: 'none' as const,
  tiebreak: [] as number[],
  desc: '未掷出任何奖项',
});

/**
 * 判定一次掷骰结果。
 *
 * @param dice 6 颗骰子的点数，每颗 1–6
 * @returns 奖项名、等级、类别、同等级比较键
 *
 * 判定顺序（从高到低）：
 *   12 状元插金花 → 11 六杯红 → 10 遍地锦 → 9 六勃黑 → 8 五王 → 7 五子
 *   → 6 四红 → 5 对堂 → 4 三红 → 3 四进 → 2 二举 → 1 一秀 → 0 无奖
 */
export function judgeRoll(dice: number[]): RollResult {
  if (!Array.isArray(dice) || dice.length !== DICE_COUNT) {
    throw new Error(`judgeRoll 需要 ${DICE_COUNT} 颗骰子，收到 ${dice?.length}`);
  }
  for (const d of dice) {
    if (!Number.isInteger(d) || d < 1 || d > DICE_FACES) {
      throw new Error(`非法骰子点数：${d}（应为 1–${DICE_FACES} 的整数）`);
    }
  }

  const c = countFaces(dice);
  const fours = c[4];

  // ── 等级 12：状元插金花（4 个 4 + 2 个 1）──────────────────────
  // 必须排在四红之前，否则会被误判为四红
  if (fours === 4 && c[1] === 2) {
    return make('zhuangyuan', '状元插金花', 12, [], '4 个 4 + 2 个 1');
  }

  // ── 等级 11：六杯红（6 个 4）────────────────────────────────
  if (fours === DICE_COUNT) {
    return make('zhuangyuan', '六杯红', 11, [], '6 个 4');
  }

  // ── 等级 10：遍地锦（6 个 1）────────────────────────────────
  // 必须排在六勃黑之前，否则会被误判为六勃黑
  if (c[1] === DICE_COUNT) {
    return make('zhuangyuan', '遍地锦', 10, [], '6 个 1');
  }

  // ── 等级 9：六勃黑（6 个 2 / 3 / 5 / 6）─────────────────────
  // 1 已归遍地锦、4 已归六杯红，此处天然只剩 2/3/5/6
  for (const v of [6, 5, 3, 2]) {
    if (c[v] === DICE_COUNT) {
      return make('zhuangyuan', '六勃黑', 9, [v], `6 个 ${v}`);
    }
  }

  // ── 等级 8：五王（5 个 4）──────────────────────────────────
  // 必须排在五子之前（五子排除 4），也必须排在四红之前
  if (fours === 5) {
    const rest = dice.filter((d) => d !== 4)[0];
    return make('zhuangyuan', '五王', 8, [rest], `5 个 4，余骰 ${rest}`);
  }

  // ── 等级 7：五子（5 个同点，且该点不是 4）────────────────────
  // 必须排在四进之前，否则会被误判为四进
  for (const v of [6, 5, 3, 2, 1]) {
    if (c[v] === 5) {
      const rest = dice.filter((d) => d !== v)[0];
      return make('zhuangyuan', '五子', 7, [v, rest], `5 个 ${v}，余骰 ${rest}`);
    }
  }

  // ── 等级 6：四红（4 个 4，且不是状元插金花）──────────────────
  // 插金花已在最前返回，此处 4 个 4 必为四红
  if (fours === 4) {
    const rest = dice.filter((d) => d !== 4).sort((a, b) => b - a);
    return make('zhuangyuan', '四红', 6, rest, `4 个 4，余骰 ${rest.join('、')}`);
  }

  // ── 等级 5：对堂（1、2、3、4、5、6 各一个）───────────────────
  // 必须排在一秀（1 个 4）之前，否则会被误判为一秀
  if ([1, 2, 3, 4, 5, 6].every((v) => c[v] === 1)) {
    return make('duitang', '对堂', 5, [], '1、2、3、4、5、6 各一个');
  }

  // ── 等级 4：三红（3 个 4）──────────────────────────────────
  if (fours === 3) {
    return make('sanhong', '三红', 4, [], '3 个 4');
  }

  // ── 等级 3：四进（4 个同点，且该点不是 4）────────────────────
  for (const v of [6, 5, 3, 2, 1]) {
    if (c[v] === 4) {
      return make('sijin', '四进', 3, [], `4 个 ${v}`);
    }
  }

  // ── 等级 2：二举（2 个 4）──────────────────────────────────
  if (fours === 2) {
    return make('erju', '二举', 2, [], '2 个 4');
  }

  // ── 等级 1：一秀（1 个 4）──────────────────────────────────
  if (fours === 1) {
    return make('yixiu', '一秀', 1, [], '1 个 4');
  }

  // ── 等级 0：无奖 ───────────────────────────────────────────
  return NO_PRIZE;
}

/**
 * 比较两次掷骰的「大小」，用于状元更替判定。
 *
 * 规则：
 *   1. 先比较等级（level），大者胜；
 *   2. 等级相同时，按下标依次比较 tiebreak，数值大者胜；
 *   3. 完全相等返回 0 —— 调用方须按「先到先得」处理，即不替换。
 *
 * @returns > 0 表示 a 更大；< 0 表示 b 更大；0 表示完全相等
 */
export function compareRolls(a: RollResult, b: RollResult): number {
  if (a.level !== b.level) return a.level - b.level;

  const n = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < n; i += 1) {
    const av = a.tiebreak[i] ?? 0;
    const bv = b.tiebreak[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
