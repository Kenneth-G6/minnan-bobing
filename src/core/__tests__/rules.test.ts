/**
 * 核心规则单元测试 —— 判定表 + 同等级比较
 */
import { describe, expect, it } from 'vitest';
import { compareRolls, judgeRoll } from '../rules';

/** 断言奖项名与等级 */
function expectPrize(dice: number[], prize: string, level: number) {
  const r = judgeRoll(dice);
  expect(r.prize, `骰子 ${dice.join(',')} 的奖项`).toBe(prize);
  expect(r.level, `骰子 ${dice.join(',')} 的等级`).toBe(level);
  return r;
}

describe('judgeRoll —— 题目指定用例', () => {
  it('[4,4,4,4,1,1] => 状元插金花', () => {
    const r = expectPrize([4, 4, 4, 4, 1, 1], '状元插金花', 12);
    expect(r.type).toBe('zhuangyuan');
    expect(r.prizeKey).toBe('zhuangyuan');
    // 唯一奖项，无比较键
    expect(r.tiebreak).toEqual([]);
  });

  it('[4,4,4,4,4,4] => 六杯红', () => {
    const r = expectPrize([4, 4, 4, 4, 4, 4], '六杯红', 11);
    expect(r.type).toBe('zhuangyuan');
    expect(r.tiebreak).toEqual([]);
    // 六杯红不是五王
    expect(r.prize).not.toBe('五王');
  });

  it('[1,1,1,1,1,1] => 遍地锦', () => {
    const r = expectPrize([1, 1, 1, 1, 1, 1], '遍地锦', 10);
    expect(r.type).toBe('zhuangyuan');
    // 六个 1 是遍地锦，不是六勃黑
    expect(r.prize).not.toBe('六勃黑');
  });

  it('[6,6,6,6,6,6] => 六勃黑-6', () => {
    const r = expectPrize([6, 6, 6, 6, 6, 6], '六勃黑', 9);
    expect(r.type).toBe('zhuangyuan');
    expect(r.tiebreak).toEqual([6]);
  });

  it('[4,4,4,4,4,2] => 五王', () => {
    const r = expectPrize([4, 4, 4, 4, 4, 2], '五王', 8);
    expect(r.type).toBe('zhuangyuan');
    // 比较键为剩余一颗骰子的点数
    expect(r.tiebreak).toEqual([2]);
  });

  it('[5,5,5,5,5,2] => 五子-5', () => {
    const r = expectPrize([5, 5, 5, 5, 5, 2], '五子', 7);
    expect(r.type).toBe('zhuangyuan');
    // 先比五点，再比余骰
    expect(r.tiebreak).toEqual([5, 2]);
    // 五子是五子，不是四进
    expect(r.prize).not.toBe('四进');
  });

  it('[4,4,4,4,2,3] => 四红', () => {
    const r = expectPrize([4, 4, 4, 4, 2, 3], '四红', 6);
    expect(r.type).toBe('zhuangyuan');
    // 余两骰按降序
    expect(r.tiebreak).toEqual([3, 2]);
  });

  it('[1,2,3,4,5,6] => 对堂', () => {
    const r = expectPrize([1, 2, 3, 4, 5, 6], '对堂', 5);
    expect(r.type).toBe('normal');
    expect(r.prizeKey).toBe('duitang');
    // 对堂不是一秀
    expect(r.prize).not.toBe('一秀');
  });

  it('[4,4,4,2,2,2] => 三红', () => {
    const r = expectPrize([4, 4, 4, 2, 2, 2], '三红', 4);
    expect(r.type).toBe('normal');
    expect(r.prizeKey).toBe('sanhong');
  });

  it('[1,1,1,1,4,4] => 四进-1', () => {
    const r = expectPrize([1, 1, 1, 1, 4, 4], '四进', 3);
    expect(r.type).toBe('normal');
    expect(r.prizeKey).toBe('sijin');
    // 四进排除四个 4（此处是四个 1）
    expect(r.prize).not.toBe('四红');
  });

  it('[4,4,5,5,5,6] => 二举', () => {
    const r = expectPrize([4, 4, 5, 5, 5, 6], '二举', 2);
    expect(r.type).toBe('normal');
    expect(r.prizeKey).toBe('erju');
  });

  it('[4,2,2,3,5,6] => 一秀', () => {
    const r = expectPrize([4, 2, 2, 3, 5, 6], '一秀', 1);
    expect(r.type).toBe('normal');
    expect(r.prizeKey).toBe('yixiu');
  });

  it('[2,2,3,3,5,6] => 无奖', () => {
    const r = expectPrize([2, 2, 3, 3, 5, 6], '无奖', 0);
    expect(r.type).toBe('none');
    expect(r.prizeKey).toBeNull();
  });
});

describe('judgeRoll —— 边界与易误判场景', () => {
  it('遍地点数为 2 的六勃黑', () => {
    const r = expectPrize([2, 2, 2, 2, 2, 2], '六勃黑', 9);
    expect(r.tiebreak).toEqual([2]);
  });

  it('六勃黑 3', () => {
    expectPrize([3, 3, 3, 3, 3, 3], '六勃黑', 9);
  });

  it('六勃黑 5', () => {
    expectPrize([5, 5, 5, 5, 5, 5], '六勃黑', 9);
  });

  it('[6,6,6,6,6,5] => 五子-6', () => {
    const r = expectPrize([6, 6, 6, 6, 6, 5], '五子', 7);
    expect(r.tiebreak).toEqual([6, 5]);
  });

  it('[4,4,4,4,1,2] => 四红（不是插金花）', () => {
    const r = expectPrize([4, 4, 4, 4, 1, 2], '四红', 6);
    // 只有一个 1，不满足「2 个 1」
    expect(r.tiebreak).toEqual([2, 1]);
  });

  it('插金花必须恰好 2 个 1', () => {
    // 4 个 4 + 1 个 1 + 1 个 6
    expectPrize([4, 4, 4, 4, 1, 6], '四红', 6);
    // 4 个 4 + 2 个 1 才是插金花
    expectPrize([4, 4, 4, 4, 1, 1], '状元插金花', 12);
  });

  it('五王不是四红，也不是五子', () => {
    const r = expectPrize([4, 4, 4, 4, 4, 6], '五王', 8);
    expect(r.tiebreak).toEqual([6]);
  });

  it('五子排除五个 4（五个 4 是五王）', () => {
    expectPrize([4, 4, 4, 4, 4, 3], '五王', 8);
    // 五个 1 是五子
    expectPrize([1, 1, 1, 1, 1, 6], '五子', 7);
  });

  it('四进排除四个 4（四个 4 是四红）', () => {
    expectPrize([4, 4, 4, 4, 5, 6], '四红', 6);
    // 四个 5 才是四进
    expectPrize([5, 5, 5, 5, 1, 2], '四进', 3);
  });

  it('[1,1,1,1,2,2] 不是对堂（是四进）', () => {
    const r = judgeRoll([1, 1, 1, 1, 2, 2]);
    expect(r.prize).toBe('四进');
    expect(r.prize).not.toBe('对堂');
  });

  it('对堂的各种排列都应识别', () => {
    for (const dice of [
      [1, 2, 3, 4, 5, 6],
      [6, 5, 4, 3, 2, 1],
      [3, 1, 5, 2, 6, 4],
      [4, 1, 6, 3, 2, 5],
    ]) {
      expectPrize(dice, '对堂', 5);
    }
  });

  it('二举与一秀的区分', () => {
    expectPrize([4, 4, 1, 2, 3, 6], '二举', 2);
    expectPrize([4, 1, 2, 3, 5, 5], '一秀', 1);
    // 两个 4 同时还有三个 5，仍按等级 2 判二举（二举 > 一秀 的兜底）
    expectPrize([4, 4, 5, 5, 5, 1], '二举', 2);
  });

  it('无奖的几种情形', () => {
    for (const dice of [
      [2, 2, 3, 3, 5, 6],
      [1, 1, 2, 3, 5, 6],
      [1, 3, 5, 5, 6, 6],
      [2, 2, 2, 3, 3, 5],
    ]) {
      expectPrize(dice, '无奖', 0);
    }
  });

  it('状元类与普通奖的类别划分', () => {
    // 等级 >= 6 为状元类
    expect(judgeRoll([4, 4, 4, 4, 1, 2]).type).toBe('zhuangyuan'); // 四红 6
    expect(judgeRoll([5, 5, 5, 5, 5, 2]).type).toBe('zhuangyuan'); // 五子 7
    // 对堂(5)、三红(4) 是普通奖
    expect(judgeRoll([1, 2, 3, 4, 5, 6]).type).toBe('normal');
    expect(judgeRoll([4, 4, 4, 2, 2, 2]).type).toBe('normal');
  });

  it('非法输入应抛错', () => {
    expect(() => judgeRoll([1, 2, 3, 4, 5])).toThrow();
    expect(() => judgeRoll([1, 2, 3, 4, 5, 6, 7])).toThrow();
    expect(() => judgeRoll([1, 2, 3, 4, 5, 7])).toThrow();
    expect(() => judgeRoll([1, 2, 3, 4, 5, 0])).toThrow();
    expect(() => judgeRoll([1, 2, 3, 4, 5, 1.5])).toThrow();
  });
});

describe('compareRolls —— 同等级比较', () => {
  const r = (dice: number[]) => judgeRoll(dice);

  it('等级不同时，等级大者胜', () => {
    expect(compareRolls(r([4, 4, 4, 4, 2, 3]), r([5, 5, 5, 5, 5, 2]))).toBeLessThan(0); // 四红 < 五子
    expect(compareRolls(r([4, 4, 4, 4, 1, 1]), r([4, 4, 4, 4, 4, 4]))).toBeGreaterThan(0); // 插金花 > 六杯红
  });

  it('六勃黑比较六同点的点数：6 > 5 > 3 > 2', () => {
    const six = r([6, 6, 6, 6, 6, 6]);
    const five = r([5, 5, 5, 5, 5, 5]);
    const three = r([3, 3, 3, 3, 3, 3]);
    const two = r([2, 2, 2, 2, 2, 2]);

    expect(compareRolls(six, five)).toBeGreaterThan(0);
    expect(compareRolls(five, three)).toBeGreaterThan(0);
    expect(compareRolls(three, two)).toBeGreaterThan(0);
    expect(compareRolls(two, six)).toBeLessThan(0);
    // 同点数完全相等
    expect(compareRolls(two, r([2, 2, 2, 2, 2, 2]))).toBe(0);
  });

  it('五王比较剩余一颗骰子的点数', () => {
    const withSix = r([4, 4, 4, 4, 4, 6]);
    const withTwo = r([4, 4, 4, 4, 4, 2]);
    expect(compareRolls(withSix, withTwo)).toBeGreaterThan(0);
    expect(compareRolls(withTwo, withSix)).toBeLessThan(0);
    expect(compareRolls(withTwo, r([4, 4, 4, 4, 4, 2]))).toBe(0);
  });

  it('五子先比五同点，再比剩余骰子', () => {
    const five6_one2 = r([6, 6, 6, 6, 6, 2]);
    const five6_one1 = r([6, 6, 6, 6, 6, 1]);
    const five5_one6 = r([5, 5, 5, 5, 5, 6]);

    // 五点相同，比余骰
    expect(compareRolls(five6_one2, five6_one1)).toBeGreaterThan(0);
    // 五点大的整体更大（即使余骰更小）
    expect(compareRolls(five6_one1, five5_one6)).toBeGreaterThan(0);
  });

  it('四红比较剩余两骰的降序序列（字典序）：[6,5] > [6,3] > [5,5]', () => {
    const a = r([4, 4, 4, 4, 6, 5]); // [6,5]
    const b = r([4, 4, 4, 4, 6, 3]); // [6,3]
    const c = r([4, 4, 4, 4, 5, 5]); // [5,5]

    expect(a.tiebreak).toEqual([6, 5]);
    expect(b.tiebreak).toEqual([6, 3]);
    expect(c.tiebreak).toEqual([5, 5]);

    expect(compareRolls(a, b)).toBeGreaterThan(0);
    expect(compareRolls(b, c)).toBeGreaterThan(0);
    expect(compareRolls(c, a)).toBeLessThan(0);
  });

  it('四红的剩余两骰不可能含 4（否则成为五王）', () => {
    // 4,4,4,4,6,4 实际是五个 4 —— 属五王
    const r5 = judgeRoll([4, 4, 4, 4, 6, 4]);
    expect(r5.prize).toBe('五王');
    expect(r5.tiebreak).toEqual([6]);
  });

  it('四红余两骰顺序不影响结果', () => {
    expect(compareRolls(r([4, 4, 4, 4, 5, 6]), r([4, 4, 4, 4, 6, 5]))).toBe(0);
  });

  it('唯一状元奖项完全相等返回 0（先到先得）', () => {
    for (const dice of [
      [4, 4, 4, 4, 1, 1], // 插金花
      [4, 4, 4, 4, 4, 4], // 六杯红
      [1, 1, 1, 1, 1, 1], // 遍地锦
    ]) {
      expect(compareRolls(judgeRoll(dice), judgeRoll(dice))).toBe(0);
    }
  });

  it('跨类别比较不影响正确性（对堂与大状元）', () => {
    expect(compareRolls(r([1, 2, 3, 4, 5, 6]), r([4, 4, 4, 4, 1, 2]))).toBeLessThan(0);
  });
});
