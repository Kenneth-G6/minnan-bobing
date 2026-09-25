/**
 * 状元争模式单元测试 —— 回合制、抢位、守擂计数、收官、结算
 *
 * 覆盖项目书 §8.1 的 17 项用例。附带的经典模式回归用例保证
 * 「createGame(names) 不传 mode 时行为与改动前一致」这条守门线。
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_TURN_ROLLS,
  createGame,
  isFinished,
  isNormalPoolEmpty,
  rollOnce,
  takeTurn,
  zhuangyuanPlayer,
  type GameState,
  type TurnOutcome,
} from '../engine';
import { diceSequenceRandom } from '../random';
import { DUEL_MIN_LEVEL, NORMAL_PRIZE_KEYS, ZHUANGYUAN_MIN_LEVEL } from '../types';

// ── 固定骰子序列 ──────────────────────────────────────────────
const NO_PRIZE = [2, 2, 3, 3, 5, 6]; // 无奖
const SIHONG_LOW = [4, 4, 4, 4, 2, 1]; // 四红 tiebreak [2,1]（四红的最小比较键）
const SIHONG_SAME = [4, 4, 4, 4, 1, 2]; // 四红 tiebreak [2,1]（与上面完全相等）
const SIHONG_BIG = [4, 4, 4, 4, 3, 2]; // 四红 tiebreak [3,2]
const WUZI = [5, 5, 5, 5, 5, 2]; // 五子 7（高于四红）
const CHAJINHUA = [4, 4, 4, 4, 1, 1]; // 状元插金花 12

/** 确定性伪随机源（LCG），保证整局模拟可复现 */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 连续执行 count 个回合，返回末态、每回合结论与中间态 */
function turns(state: GameState, seq: number[][], count: number) {
  const random = diceSequenceRandom(seq);
  let s = state;
  const outcomes: TurnOutcome[] = [];
  const sequences: number[][][] = [];
  const states: GameState[] = [];
  for (let i = 0; i < count; i += 1) {
    const r = takeTurn(s, random);
    s = r.state;
    outcomes.push(r.outcome);
    sequences.push(r.sequence);
    states.push(s);
  }
  return { state: s, outcomes, sequences, states };
}

describe('状元争 —— 回合制', () => {
  it('1. 一个回合必然以状元类收尾，过程掷骰全部落在同一个回合里', () => {
    const g = createGame(['A', 'B'], 'zhuangyuan');
    const { state, outcomes, sequences } = turns(g, [NO_PRIZE, NO_PRIZE, SIHONG_LOW], 1);

    expect(outcomes[0].result.type).toBe('zhuangyuan');
    expect(outcomes[0].result.level).toBeGreaterThanOrEqual(ZHUANGYUAN_MIN_LEVEL);
    expect(outcomes[0].rolls).toBe(3);
    expect(sequences[0]).toHaveLength(3);
    expect(sequences[0][2]).toEqual(SIHONG_LOW);
    // 一回合还没走完一整圈，游戏继续
    expect(state.status).toBe('playing');
  });

  it('2. 过程掷骰不进入历史，一回合只追加 1 条回合级记录', () => {
    const g = createGame(['A', 'B'], 'zhuangyuan');
    const seq = [...Array.from({ length: 4 }, () => NO_PRIZE), SIHONG_LOW];
    const { state } = turns(g, seq, 1);

    expect(state.history).toHaveLength(1);
    expect(state.history[0].seq).toBe(1);
    expect(state.history[0].rolls).toBe(5);
    expect(state.history[0].dice).toEqual(SIHONG_LOW);
    // 累计掷骰数含过程掷骰
    expect(state.totalRolls).toBe(5);
  });

  it('3. 状元争不发普通奖：awarded 恒为 null，普通奖池全程纹丝不动', () => {
    const g = createGame(['A', 'B', 'C', 'D'], 'zhuangyuan');
    const before = { ...g.pool };
    const seq = [
      ...Array.from({ length: 2 }, () => NO_PRIZE),
      SIHONG_LOW,
      WUZI,
      CHAJINHUA,
      SIHONG_BIG,
    ];
    const { state, outcomes } = turns(g, seq, 4);

    expect(outcomes).toHaveLength(4);
    for (const h of state.history) {
      expect(h.awarded).toBeNull();
      expect(h.prizeFull).toBe(false);
    }
    for (const key of NORMAL_PRIZE_KEYS) expect(state.pool[key]).toBe(before[key]);
    expect(state.pool.zhuangyuan).toBe(1);
  });
});

describe('状元争 —— 抢位判定', () => {
  it('4. 首个 became、相等 kept、更大 replaced、更小 kept', () => {
    const g = createGame(['A', 'B', 'C', 'D'], 'zhuangyuan');
    const { state, outcomes } = turns(
      g,
      [SIHONG_LOW, SIHONG_SAME, SIHONG_BIG, SIHONG_LOW],
      4,
    );

    expect(outcomes.map((o) => o.change)).toEqual(['became', 'kept', 'replaced', 'kept']);
    expect(state.zhuangyuan?.playerId).toBe(2);
    expect(state.zhuangyuan?.result.tiebreak).toEqual([3, 2]);
    expect(zhuangyuanPlayer(state)?.name).toBe('C');
  });

  it('5. 抢位成功后守擂计数重置为 N−1，未抢位则逐个递减', () => {
    const g = createGame(['A', 'B', 'C', 'D'], 'zhuangyuan');
    expect(g.challengersLeft).toBe(4);

    const { states } = turns(g, [SIHONG_LOW, SIHONG_SAME, SIHONG_BIG, SIHONG_LOW], 4);

    expect(states[0].challengersLeft).toBe(3); // became → 递减
    expect(states[1].challengersLeft).toBe(2); // kept → 递减
    expect(states[2].challengersLeft).toBe(3); // replaced → 重置为 N−1
    expect(states[3].challengersLeft).toBe(2); // kept → 递减
  });

  it('12. 收官时结算：擂主独占状元饼，其余人颗粒无收', () => {
    const g = createGame(['A', 'B', 'C', 'D'], 'zhuangyuan');
    const { state, outcomes } = turns(
      g,
      [WUZI, SIHONG_LOW, SIHONG_LOW, SIHONG_LOW],
      4,
    );

    expect(outcomes[3].finished).toBe(true);
    expect(state.status).toBe('finished');
    expect(state.settled).toBe(true);
    expect(state.players[0].prizes.zhuangyuan).toBe(1);
    for (const p of state.players.slice(1)) expect(p.prizes.zhuangyuan).toBe(0);
    expect(state.pool.zhuangyuan).toBe(0);
    expect(zhuangyuanPlayer(state)?.name).toBe('A');
  });
});

describe('状元争 —— 圈与守擂', () => {
  /** 4 人场景：P2 抢位成为擂主，随后 P3、P4、P1 各博一次均未抢位 → 收官 */
  const SEQUENCE = [SIHONG_LOW, SIHONG_BIG, SIHONG_LOW, SIHONG_LOW, SIHONG_LOW];

  it('6. 一圈博完无人抢位 → 收官并完成结算', () => {
    const g = createGame(['A', 'B', 'C', 'D'], 'zhuangyuan');
    const { state, outcomes } = turns(g, SEQUENCE, SEQUENCE.length);

    expect(state.status).toBe('finished');
    expect(state.settled).toBe(true);
    expect(state.challengersLeft).toBe(0);
    expect(outcomes[SEQUENCE.length - 1].finished).toBe(true);
    // 前四个回合均未触发收官
    for (const o of outcomes.slice(0, -1)) expect(o.finished).toBe(false);
  });

  it('7. 第 1 圈全员参与，第 2 圈起擂主不再掷骰', () => {
    const g = createGame(['A', 'B', 'C', 'D'], 'zhuangyuan');
    const { outcomes } = turns(g, SEQUENCE, SEQUENCE.length);

    // A B C D 各一次后回到 A；擂主 B 从未拿到第二个回合
    expect(outcomes.map((o) => o.playerName)).toEqual(['A', 'B', 'C', 'D', 'A']);
    expect(outcomes.map((o) => o.round)).toEqual([1, 1, 1, 1, 2]);
  });

  it('8. 擂主本人的回合数不再增长', () => {
    const g = createGame(['A', 'B', 'C', 'D'], 'zhuangyuan');
    const { state } = turns(g, SEQUENCE, SEQUENCE.length);

    // B 是擂主，只上场 1 次；A 在第 2 圈仍有回合
    expect(state.players[1].turns).toBe(1);
    expect(state.players[0].turns).toBe(2);
    expect(state.history.filter((h) => h.playerId === 1)).toHaveLength(1);
  });

  it('9. 注入确定性序列：连掷 k 次非状元类后命中，rolls === k + 1', () => {
    const k = 7;
    const seq = [...Array.from({ length: k }, () => NO_PRIZE), CHAJINHUA];
    const { outcomes, sequences } = turns(createGame(['A', 'B'], 'zhuangyuan'), seq, 1);

    expect(outcomes[0].rolls).toBe(k + 1);
    expect(sequences[0]).toHaveLength(k + 1);
    expect(outcomes[0].dice).toEqual(CHAJINHUA);
    expect(outcomes[0].result.prize).toBe('状元插金花');
    expect(outcomes[0].result.level).toBe(12);
  });

  it('13. Player.best 随回合更新，且不会被更小的成绩覆盖', () => {
    // 4 人 8 回合：C 先以比较键 [3,2] 的四红坐上擂主，随后 A 用五子抢走
    const seq = [
      SIHONG_LOW, // A became
      SIHONG_SAME, // B kept（与 A 完全相等）
      SIHONG_BIG, // C replaced
      SIHONG_LOW, // D kept
      WUZI, // A replaced
      SIHONG_LOW, // B kept
      SIHONG_LOW, // C kept（更小的四红，不应覆盖 best）
      SIHONG_LOW, // D kept → 收官
    ];
    const g = createGame(['A', 'B', 'C', 'D'], 'zhuangyuan');
    const { state } = turns(g, seq, seq.length);

    expect(state.status).toBe('finished');
    expect(state.players[0].best?.prize).toBe('五子');
    expect(state.players[0].rolls).toBe(2);
    expect(state.players[0].turns).toBe(2);
    // C 的最好成绩仍是比较键 [3,2] 的四红
    expect(state.players[2].best?.prize).toBe('四红');
    expect(state.players[2].best?.tiebreak).toEqual([3, 2]);
  });

  it('15. 整局中每个回合的结果都不低于四红（状元争只认 7 级）', () => {
    expect(DUEL_MIN_LEVEL).toBe(ZHUANGYUAN_MIN_LEVEL);

    let state = createGame(['A', 'B', 'C', 'D', 'E', 'F'], 'zhuangyuan');
    const random = lcg(20260925);
    while (state.status === 'playing') {
      state = takeTurn(state, random).state;
    }

    expect(state.history.length).toBeGreaterThan(0);
    for (const h of state.history) {
      expect(h.result.type).toBe('zhuangyuan');
      expect(h.result.level).toBeGreaterThanOrEqual(DUEL_MIN_LEVEL);
    }
  });
});

describe('状元争 —— 边界与防御', () => {
  it('10. 单回合掷骰数超过安全上限时抛错', () => {
    // 恒定无奖的随机源：任何一掷都博不出状元类
    const pattern = NO_PRIZE;
    let i = 0;
    const neverHit = () => (pattern[i++ % pattern.length] - 0.5) / 6;

    const g = createGame(['A', 'B'], 'zhuangyuan');
    expect(MAX_TURN_ROLLS).toBe(100000);
    expect(() => takeTurn(g, neverHit)).toThrow(/安全上限/);
  });

  it('11. rollOnce 与 takeTurn 各守其模式，越界调用抛错', () => {
    const duel = createGame(['A', 'B'], 'zhuangyuan');
    expect(() => rollOnce(duel, diceSequenceRandom([SIHONG_LOW]))).toThrow(/takeTurn/);

    const classic = createGame(['A', 'B']);
    expect(() => takeTurn(classic, diceSequenceRandom([SIHONG_LOW]))).toThrow(/经典模式/);
  });

  it('14. 2 人与 12 人边界：整局不变量校验', () => {
    for (const count of [2, 12]) {
      const names = Array.from({ length: count }, (_, i) => `P${i + 1}`);
      let state = createGame(names, 'zhuangyuan');
      const random = lcg(count * 7919 + 13);

      let guard = 0;
      while (state.status === 'playing') {
        state = takeTurn(state, random).state;
        guard += 1;
        expect(guard, `${count} 人局回合数`).toBeLessThanOrEqual(500);
      }

      expect(state.challengersLeft).toBe(0);
      expect(state.settled).toBe(true);
      expect(state.zhuangyuan).not.toBeNull();
      expect(state.history).toHaveLength(guard);

      // 累计掷骰数 = 各回合掷骰数之和
      const sumRolls = state.history.reduce((sum, h) => sum + (h.rolls ?? 0), 0);
      expect(state.totalRolls).toBe(sumRolls);
      expect(state.players.reduce((sum, p) => sum + p.rolls, 0)).toBe(sumRolls);

      // 每人都上过场（第 1 圈全员必博），且只有擂主拿到状元饼
      for (const p of state.players) {
        expect(p.turns, `${p.name} 回合数`).toBeGreaterThanOrEqual(1);
        expect(p.best).not.toBeNull();
      }
      expect(state.players.reduce((sum, p) => sum + p.prizes.zhuangyuan, 0)).toBe(1);

      // 普通奖池全程未被消耗
      for (const key of NORMAL_PRIZE_KEYS) {
        expect(state.pool[key]).toBe(createGame(names).pool[key]);
      }
    }
  });

  it('16. isFinished 按模式分派：经典看奖池，状元争看守擂计数', () => {
    const classic = createGame(['A', 'B']);
    expect(isFinished(classic)).toBe(false);
    const drained = {
      ...classic,
      pool: { ...classic.pool, yixiu: 0, erju: 0, sijin: 0, sanhong: 0, duitang: 0 },
    };
    expect(isFinished(drained)).toBe(true);

    // 状元争：普通奖池清空与收官无关，只看守擂计数
    const duel = createGame(['A', 'B'], 'zhuangyuan');
    const duelDrained = { ...duel, pool: drained.pool };
    expect(isNormalPoolEmpty(duelDrained.pool)).toBe(true);
    expect(isFinished(duelDrained)).toBe(false);
    expect(isFinished({ ...duelDrained, challengersLeft: 0 })).toBe(true);
  });

  it('17. 经典模式回归：单参 createGame 行为与既有版本一致', () => {
    const g = createGame(['A', 'B']);

    expect(g.mode).toBe('classic');
    expect(g.challengersLeft).toBeNull();
    expect(g.totalRolls).toBe(0);
    expect(g.pool).toEqual({
      yixiu: 32,
      erju: 16,
      sijin: 8,
      sanhong: 4,
      duitang: 2,
      zhuangyuan: 1,
    });
    for (const p of g.players) {
      expect(p.best).toBeNull();
      expect(p.rolls).toBe(0);
      expect(p.turns).toBe(0);
      expect(p.prizes).toEqual({
        yixiu: 0,
        erju: 0,
        sijin: 0,
        sanhong: 0,
        duitang: 0,
        zhuangyuan: 0,
      });
    }

    const { state, outcome } = rollOnce(g, diceSequenceRandom([SIHONG_LOW]));
    expect(outcome.zhuangyuanChange).toBe('became');
    expect(state.history).toHaveLength(1);
    expect(state.totalRolls).toBe(1);
    expect(state.players[0].best?.prize).toBe('四红');
    expect(state.players[0].turns).toBe(1);
    expect(state.challengersLeft).toBeNull();
    expect(state.pool.zhuangyuan).toBe(1);
  });
});
