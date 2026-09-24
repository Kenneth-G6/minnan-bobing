/**
 * 随机源 —— 可注入，方便单元测试构造确定性场景
 */
import { DICE_COUNT, DICE_FACES } from './types';

/** 均匀返回 [0, 1) 的随机函数 */
export type RandomFn = () => number;

/** 默认随机源 */
export const defaultRandom: RandomFn = () => Math.random();

/**
 * 掷 6 颗骰子。
 * 第 d 点数由 Math.floor(random() * 6) + 1 得出，各点数概率相等。
 */
export function rollDice(random: RandomFn = defaultRandom): number[] {
  const dice: number[] = [];
  for (let i = 0; i < DICE_COUNT; i += 1) {
    const value = Math.floor(random() * DICE_FACES) + 1;
    // 防御：随机源返回越界值（如 1.0）时兜底钳制
    dice.push(Math.min(DICE_FACES, Math.max(1, value)));
  }
  return dice;
}

/**
 * 测试辅助：用「预设骰子序列」构造确定性随机源。
 *
 * 每次 rollDice 会连续消费 6 个随机值，本函数把预设点数反算成对应的随机值，
 * 使得 `Math.floor(random() * 6) + 1` 恰好得到预设点数。
 *
 * @example
 *   const random = diceSequenceRandom([[4,4,4,4,1,1]]);
 *   rollDice(random); // => [4,4,4,4,1,1]
 */
export function diceSequenceRandom(sequence: number[][]): RandomFn {
  let rollIndex = 0;
  let dieIndex = 0;

  return () => {
    const roll = sequence[rollIndex];
    if (!roll) {
      throw new Error(`diceSequenceRandom：预设骰子序列已耗尽（已用 ${rollIndex} 次掷骰）`);
    }
    const die = roll[dieIndex];
    if (die === undefined) {
      throw new Error(`diceSequenceRandom：第 ${rollIndex + 1} 次掷骰只预设了 ${roll.length} 颗骰子`);
    }

    dieIndex += 1;
    if (dieIndex >= roll.length) {
      dieIndex = 0;
      rollIndex += 1;
    }
    // 让 floor(v * 6) + 1 === die
    return (die - 0.5) / DICE_FACES;
  };
}
