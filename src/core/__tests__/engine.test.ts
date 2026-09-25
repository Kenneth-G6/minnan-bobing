/**
 * 游戏状态机单元测试 —— 发奖、奖池耗尽、状元更替、结束条件、结算
 */
import { describe, expect, it } from 'vitest';
import {
  countPrizes,
  createGame,
  currentPlayer,
  isNormalPoolEmpty,
  rollOnce,
  summarizePrizes,
  zhuangyuanPlayer,
  type GameState,
} from '../engine';
import { diceSequenceRandom } from '../random';
import { NORMAL_PRIZE_KEYS, PRIZE_META, type PrizeKey } from '../types';

// ── 固定骰子序列 ──────────────────────────────────────────────
const NO_PRIZE = [2, 2, 3, 3, 5, 6]; // 无奖
const DUITANG = [1, 2, 3, 4, 5, 6]; // 对堂 5
const SANHONG = [4, 4, 4, 2, 2, 2]; // 三红 4
const SIHONG_LOW = [4, 4, 4, 4, 2, 1]; // 四红 tiebreak [2,1]
const SIHONG_MID = [4, 4, 4, 4, 2, 3]; // 四红 tiebreak [3,2]
const SIHONG_SAME = [4, 4, 4, 4, 3, 2]; // 四红 tiebreak [3,2]（与上面完全相等）
const WUZI5 = [5, 5, 5, 5, 5, 2]; // 五子 7
const CHAJINHUA = [4, 4, 4, 4, 1, 1]; // 状元插金花 12

/** 批量执行掷骰（不检查中间是否结束） */
function play(state: GameState, rolls: number[][]) {
  const random = diceSequenceRandom(rolls);
  let s = state;
  const outcomes = [];
  for (let i = 0; i < rolls.length; i += 1) {
    const { state: next, outcome } = rollOnce(s, random);
    s = next;
    outcomes.push(outcome);
  }
  return { state: s, outcomes };
}

/** 篡改奖池，构造边界场景 */
function withPool(state: GameState, patch: Partial<Record<PrizeKey, number>>): GameState {
  return { ...state, pool: { ...state.pool, ...patch } };
}

/** 把普通奖池清空，仅保留指定奖项若干 */
function onlyNormal(state: GameState, key: PrizeKey | null, count = 1): GameState {
  const patch: Partial<Record<PrizeKey, number>> = {};
  for (const k of NORMAL_PRIZE_KEYS) patch[k] = 0;
  if (key) patch[key] = count;
  return withPool(state, patch);
}

const names6 = ['玩家1', '玩家2', '玩家3', '玩家4', '玩家5', '玩家6'];

describe('createGame —— 初始化', () => {
  it('按厦门常见规则初始化玩家、奖池与状态', () => {
    const g = createGame(names6);
    expect(g.players).toHaveLength(6);
    expect(g.players.map((p) => p.name)).toEqual(names6);
    expect(g.pool).toEqual({
      yixiu: 32,
      erju: 16,
      sijin: 8,
      sanhong: 4,
      duitang: 2,
      zhuangyuan: 1,
    });
    expect(g.round).toBe(1);
    expect(g.currentIndex).toBe(0);
    expect(g.zhuangyuan).toBeNull();
    expect(g.history).toEqual([]);
    expect(g.status).toBe('playing');
    // 所有玩家初始零奖品
    for (const p of g.players) expect(countPrizes(p)).toBe(0);
  });

  it('玩家数支持 2–12，越界抛错', () => {
    expect(createGame(['A', 'B']).players).toHaveLength(2);
    expect(createGame(Array.from({ length: 12 }, (_, i) => `P${i}`)).players).toHaveLength(12);
    expect(() => createGame(['A'])).toThrow();
    expect(() => createGame(Array.from({ length: 13 }, (_, i) => `P${i}`))).toThrow();
  });

  it('姓名为空时回退默认名，并去除首尾空格', () => {
    const g = createGame(['  阿明  ', '', '   ']);
    expect(g.players[0].name).toBe('阿明');
    expect(g.players[1].name).toBe('玩家2');
    expect(g.players[2].name).toBe('玩家3');
  });
});

describe('普通奖发放', () => {
  it('先到先得，奖池逐次递减', () => {
    const g = createGame(['阿明', '阿花']);
    const { state, outcomes } = play(g, [DUITANG, DUITANG]);

    expect(outcomes[0].awarded).toBe('duitang');
    expect(outcomes[0].prizeFull).toBe(false);
    expect(state.pool.duitang).toBe(0);

    expect(outcomes[1].awarded).toBe('duitang');
    expect(state.pool.duitang).toBe(0);

    expect(state.players[0].prizes.duitang).toBe(1);
    expect(state.players[1].prizes.duitang).toBe(1);
  });

  it('奖池已满时记为「已满，无奖」，且不向下顺延', () => {
    // 只清空对堂池，其他奖项仍有货 —— 用于验证「不顺延」
    const g = withPool(createGame(['阿明', '阿花']), { duitang: 0 });
    const { state, outcomes } = play(g, [DUITANG, DUITANG]);

    // 对堂掷出但池空 → 落空
    expect(outcomes[0].prizeFull).toBe(true);
    expect(outcomes[0].awarded).toBeNull();
    expect(outcomes[0].result.prize).toBe('对堂');
    // 绝不顺延拿三红
    expect(state.players[0].prizes.sanhong).toBe(0);
    expect(state.players[0].prizes.duitang).toBe(0);
    expect(countPrizes(state.players[0])).toBe(0);
    expect(state.pool.duitang).toBe(0);
    // 其他奖池未被消耗，游戏也未结束
    expect(state.pool.sanhong).toBe(4);
    expect(state.status).toBe('playing');
  });

  it('对堂发完后掷出对堂不会改拿三红（三红池仍有货）', () => {
    // 三红池留货，对堂池清空
    let g = createGame(['阿明', '阿花']);
    g = withPool(g, { duitang: 0, sanhong: 4 });
    const { state, outcomes } = play(g, [DUITANG]);

    expect(outcomes[0].prizeFull).toBe(true);
    expect(outcomes[0].awarded).toBeNull();
    expect(state.pool.sanhong).toBe(4); // 三红池未被消耗
    expect(state.players[0].prizes.sanhong).toBe(0);
  });

  it('无奖不消耗任何奖池', () => {
    const g = createGame(['阿明', '阿花']);
    const { state, outcomes } = play(g, [NO_PRIZE]);
    expect(outcomes[0].result.prize).toBe('无奖');
    expect(outcomes[0].awarded).toBeNull();
    expect(outcomes[0].prizeFull).toBe(false);
    expect(state.pool).toEqual(createGame(['A', 'B']).pool);
  });
});

describe('状元比较与更替', () => {
  it('首个状元类奖项成为当前状元', () => {
    const g = createGame(['阿明', '阿花']);
    const { state, outcomes } = play(g, [SIHONG_MID]);

    expect(outcomes[0].zhuangyuanChange).toBe('became');
    expect(state.zhuangyuan?.playerId).toBe(0);
    expect(zhuangyuanPlayer(state)?.name).toBe('阿明');
  });

  it('更大的状元类奖项替换当前状元', () => {
    const g = createGame(['阿明', '阿花']);
    const { state, outcomes } = play(g, [SIHONG_MID, WUZI5]);

    expect(outcomes[1].zhuangyuanChange).toBe('replaced');
    expect(state.zhuangyuan?.playerId).toBe(1);
    expect(zhuangyuanPlayer(state)?.name).toBe('阿花');
  });

  it('完全相等时先到先得，不替换', () => {
    const g = createGame(['阿明', '阿花']);
    const { state, outcomes } = play(g, [SIHONG_MID, SIHONG_SAME]);

    expect(outcomes[1].zhuangyuanChange).toBe('kept');
    expect(state.zhuangyuan?.playerId).toBe(0);
  });

  it('更小的状元类奖项不替换', () => {
    const g = createGame(['阿明', '阿花']);
    const { state, outcomes } = play(g, [SIHONG_MID, SIHONG_LOW]);

    expect(outcomes[1].zhuangyuanChange).toBe('kept');
    expect(state.zhuangyuan?.playerId).toBe(0);
  });

  it('状元插金花压过一切，且不再被超越', () => {
    const g = createGame(['阿明', '阿花']);
    const { state, outcomes } = play(g, [CHAJINHUA, WUZI5]);
    expect(outcomes[0].zhuangyuanChange).toBe('became');
    expect(outcomes[1].zhuangyuanChange).toBe('kept');
    expect(state.zhuangyuan?.playerId).toBe(0);
  });

  it('状元类奖项不消耗普通奖池', () => {
    const g = createGame(['阿明', '阿花']);
    const before = { ...g.pool };
    const { state } = play(g, [CHAJINHUA, WUZI5, SIHONG_MID]);
    for (const k of NORMAL_PRIZE_KEYS) expect(state.pool[k]).toBe(before[k]);
  });

  it('普通奖不影响当前状元', () => {
    const g = createGame(['阿明', '阿花']);
    const { state } = play(g, [SIHONG_MID, DUITANG]);
    expect(state.zhuangyuan?.playerId).toBe(0);
  });
});

describe('轮次与玩家顺序', () => {
  it('按顺序轮流，走完一圈进入下一轮', () => {
    const g = createGame(['A', 'B', 'C']);
    expect(currentPlayer(g).name).toBe('A');

    const { state, outcomes } = play(g, [NO_PRIZE, NO_PRIZE, NO_PRIZE]);
    expect(outcomes.map((o) => o.playerName)).toEqual(['A', 'B', 'C']);
    expect(outcomes.map((o) => o.round)).toEqual([1, 1, 1]);
    expect(state.currentIndex).toBe(0);
    expect(state.round).toBe(2);
  });

  it('12 人一轮后进入第 2 轮', () => {
    const names = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
    const { state } = play(
      createGame(names),
      Array.from({ length: 12 }, () => NO_PRIZE),
    );
    expect(state.round).toBe(2);
    expect(state.currentIndex).toBe(0);
  });

  it('历史记录按序累积并带全局序号', () => {
    const g = createGame(['A', 'B']);
    const { state } = play(g, [NO_PRIZE, DUITANG, SANHONG]);
    expect(state.history).toHaveLength(3);
    expect(state.history.map((h) => h.seq)).toEqual([1, 2, 3]);
    expect(state.history[1].result.prize).toBe('对堂');
    expect(state.history[1].dice).toEqual(DUITANG);
    expect(state.history[2].round).toBe(2);
  });
});

describe('结束条件与结算', () => {
  it('不设轮数上限：连续 30 轮无奖也绝不结束', () => {
    const g = createGame(['A', 'B']);
    const rolls = Array.from({ length: 60 }, () => NO_PRIZE); // 2 人 × 30 轮

    const { state, outcomes } = play(g, rolls);

    expect(outcomes[59].round).toBe(30);
    expect(state.round).toBe(31);
    expect(state.status).toBe('playing');
    expect(state.settled).toBe(false);
    // 普通奖池仍有存货，轮次推得再远也不触发结束
    expect(isNormalPoolEmpty(state.pool)).toBe(false);
  });

  it('普通奖池全空是唯一的结束条件', () => {
    let g = createGame(['A', 'B', 'C', 'D']);
    g = onlyNormal(g, 'duitang', 1);
    expect(isNormalPoolEmpty(g.pool)).toBe(false);

    const { state, outcomes } = play(g, [DUITANG]);
    expect(outcomes[0].awarded).toBe('duitang');
    expect(isNormalPoolEmpty(state.pool)).toBe(true);
    expect(state.status).toBe('finished');
    expect(state.round).toBe(1); // 仅第 1 轮第 1 掷
  });

  it('结束时当前状元获得状元奖品', () => {
    let g = onlyNormal(createGame(['阿明', '阿花']), 'sanhong', 1);
    const { state, outcomes } = play(g, [SIHONG_MID, SANHONG]);

    expect(outcomes[0].zhuangyuanChange).toBe('became');
    expect(outcomes[1].awarded).toBe('sanhong');
    expect(state.status).toBe('finished');
    expect(state.settled).toBe(true);

    expect(state.players[0].prizes.zhuangyuan).toBe(1);
    expect(state.players[1].prizes.zhuangyuan).toBe(0);
    expect(state.pool.zhuangyuan).toBe(0);
    expect(zhuangyuanPlayer(state)?.name).toBe('阿明');
  });

  it('状元为空时状元奖品空缺', () => {
    let g = onlyNormal(createGame(['阿明', '阿花']), 'sanhong', 1);
    const { state } = play(g, [SANHONG]);

    expect(state.status).toBe('finished');
    expect(state.zhuangyuan).toBeNull();
    expect(zhuangyuanPlayer(state)).toBeNull();
    // 状元奖品保留在池中，无人获得
    expect(state.pool.zhuangyuan).toBe(1);
    for (const p of state.players) expect(p.prizes.zhuangyuan).toBe(0);
  });

  it('结束条件只看普通奖池，状元池不参与', () => {
    // 普通奖全部发完，但状元池仍为 1
    const g = onlyNormal(createGame(['A', 'B']), null);
    expect(g.pool.zhuangyuan).toBe(1);
    expect(isNormalPoolEmpty(g.pool)).toBe(true);
    expect(PRIZE_META.zhuangyuan.count).toBe(1);

    const { state, outcomes } = play(g, [DUITANG]);
    expect(outcomes[0].prizeFull).toBe(true);
    expect(state.status).toBe('finished');
  });

  it('游戏结束后继续掷骰应抛错', () => {
    const g = onlyNormal(createGame(['A', 'B']), null);
    const { state } = play(g, [NO_PRIZE]);
    expect(state.status).toBe('finished');
    expect(() => rollOnce(state, diceSequenceRandom([NO_PRIZE]))).toThrow();
  });
});

describe('结算汇总', () => {
  it('summarizePrizes 按等级从高到低列出奖品', () => {
    let g = onlyNormal(createGame(['A', 'B']), 'duitang', 2);
    const { state } = play(g, [DUITANG, DUITANG]);
    const summary = summarizePrizes(state.players[0]);
    expect(summary).toEqual([{ key: 'duitang', name: '对堂', count: 1 }]);
  });

  it('countPrizes 统计玩家奖品总数', () => {
    let g = createGame(['A', 'B']);
    g = withPool(g, { duitang: 2, sanhong: 4 });
    const { state } = play(g, [DUITANG, SANHONG]);
    expect(countPrizes(state.players[0])).toBe(1);
    expect(countPrizes(state.players[1])).toBe(1);
  });
});

describe('整局随机模拟（不变量校验）', () => {
  /** 确定性伪随机源（LCG），保证测试可复现 */
  function lcg(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  it('任意随机序列下都能正常结束，且奖品不超过奖池上限', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const playerCount = ((seed - 1) % 11) + 2; // 2–12
      const names = Array.from({ length: playerCount }, (_, i) => `P${i + 1}`);
      let state = createGame(names);
      const random = lcg(seed);

      let guard = 0;
      while (state.status === 'playing') {
        state = rollOnce(state, random).state;
        guard += 1;
        // 安全阀：最慢的奖池（四进 8 个 ≈ 200 掷）期望远小于此，超出即说明结束逻辑有问题
        expect(guard).toBeLessThanOrEqual(5000);
      }

      // 不设轮数上限 → 唯一的结束理由只能是普通奖全部发完
      expect(isNormalPoolEmpty(state.pool)).toBe(true);

      // 各普通奖发放总数不超过初始数量
      for (const key of NORMAL_PRIZE_KEYS) {
        const awarded = state.players.reduce((sum, p) => sum + p.prizes[key], 0);
        expect(awarded, `${key} 发放数`).toBeLessThanOrEqual(PRIZE_META[key].count);
      }

      // 每次掷骰恰落入一种结论：中奖 / 奖池已满 / 无奖 / 状元类
      const awardedCount = state.history.filter((h) => h.awarded !== null).length;
      const fullCount = state.history.filter((h) => h.prizeFull).length;
      const noneCount = state.history.filter((h) => h.result.type === 'none').length;
      const zyCount = state.history.filter((h) => h.result.type === 'zhuangyuan').length;
      expect(awardedCount + fullCount + noneCount + zyCount).toBe(state.history.length);

      // 状元奖品最多 1 个，且仅在存在状元时发放
      const zyTotal = state.players.reduce((sum, p) => sum + p.prizes.zhuangyuan, 0);
      expect(zyTotal).toBe(state.zhuangyuan ? 1 : 0);
      expect(state.pool.zhuangyuan).toBe(state.zhuangyuan ? 0 : 1);
      expect(state.status).toBe('finished');
      expect(state.settled).toBe(true);
    }
  });
});
