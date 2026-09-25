/**
 * 博饼游戏状态机 —— 纯逻辑，零 UI 依赖
 *
 * 所有状态变更都是「返回新对象」的不可变更新，方便 React 与测试使用。
 */
import { compareRolls, judgeRoll } from './rules';
import { defaultRandom, rollDice, type RandomFn } from './random';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  NORMAL_PRIZE_KEYS,
  PRIZE_META,
  createEmptyPrizeCount,
  createInitialPool,
  type GameMode,
  type PrizeKey,
  type RollResult,
} from './types';

/** 玩家 */
export interface Player {
  /** 稳定 id，从 0 开始 */
  id: number;
  name: string;
  /** 各奖项已获得数量 */
  prizes: Record<PrizeKey, number>;
  /**
   * 本局个人最好成绩（状元类；经典模式同样维护，状元争用于擂主榜展示）。
   * 从未博出状元类时为 null。
   */
  best: RollResult | null;
  /** 累计掷骰次数（含状元争的过程掷骰） */
  rolls: number;
  /** 累计回合数（经典模式每掷一骰记 1 回合） */
  turns: number;
}

/** 奖池剩余数量 */
export type PrizePool = Record<PrizeKey, number>;

/** 状元更替情形 */
export type ZhuangyuanChange =
  | 'none' // 本次未掷出状元类奖项
  | 'became' // 首个状元类奖项，成为当前状元
  | 'replaced' // 比当前状元大，替换
  | 'kept'; // 掷出状元类但未超过当前状元（含完全相等，先到先得）

/** 单次掷骰的完整结论 */
export interface RollOutcome {
  /** 本次掷出的骰子点数 */
  dice: number[];
  /** 规则判定结果 */
  result: RollResult;
  /** 实际获得的奖项；未获得为 null */
  awarded: PrizeKey | null;
  /** 普通奖是否因奖池已满而落空 */
  prizeFull: boolean;
  /** 状元更替情形 */
  zhuangyuanChange: ZhuangyuanChange;
  /** 掷骰玩家 */
  playerId: number;
  playerName: string;
  /** 所属轮次（1 起） */
  round: number;
}

/** 历史记录条目 */
export interface HistoryEntry extends RollOutcome {
  /** 全局序号（1 起） */
  seq: number;
  /**
   * 状元争的回合粒度记录：本回合的重掷次数（含命中的那一掷）。
   * 经典模式按掷记录，此字段为 undefined。
   */
  rolls?: number;
}

/** 状元争的一个完整回合结论 */
export interface TurnOutcome {
  playerId: number;
  playerName: string;
  /** 本回合重掷次数（含命中的那一掷） */
  rolls: number;
  /** 最终（命中）骰面 */
  dice: number[];
  /** 必定为状元类（type === 'zhuangyuan'） */
  result: RollResult;
  /** 抢位情形：became / replaced / kept */
  change: ZhuangyuanChange;
  /** 所属圈次（1 起） */
  round: number;
  /** 本次回合是否触发收官 */
  finished: boolean;
}

/** 整局游戏状态 */
export interface GameState {
  /** 玩法模式 */
  mode: GameMode;
  players: Player[];
  pool: PrizePool;
  /** 当前行动玩家在 players 中的下标 */
  currentIndex: number;
  /** 当前圈次（1 起），仅用于记录与展示，不参与结束判定 */
  round: number;
  /** 当前状元 / 擂主 */
  zhuangyuan: { playerId: number; result: RollResult } | null;
  /** 掷骰历史（按时间顺序） */
  history: HistoryEntry[];
  /** 游戏状态 */
  status: 'playing' | 'finished';
  /** 是否已完成结算发奖 */
  settled: boolean;
  /**
   * 状元争专用：本圈还差几人未完成回合。
   * 归零即收官；经典模式恒为 null。
   */
  challengersLeft: number | null;
  /** 累计掷骰次数（含过程掷骰） */
  totalRolls: number;
}

/** 玩家奖品总数 */
export function countPrizes(player: Player): number {
  return Object.values(player.prizes).reduce((sum, n) => sum + n, 0);
}

/** 普通奖奖池是否已全部发完（状元池不参与判定） */
export function isNormalPoolEmpty(pool: PrizePool): boolean {
  return NORMAL_PRIZE_KEYS.every((key) => pool[key] <= 0);
}

/**
 * 结束判定 —— 按模式分派。
 *
 * - 经典模式：五个普通奖池全空（状元池不参与判定）
 * - 状元争：本圈全部挑战者都博完且无人抢位（challengersLeft 归零）
 */
export function isFinished(state: GameState): boolean {
  if (state.mode === 'zhuangyuan') {
    return state.challengersLeft !== null && state.challengersLeft <= 0;
  }
  return isNormalPoolEmpty(state.pool);
}

/**
 * 创建一局新游戏。
 *
 * @param names 玩家姓名列表，长度须在 2–12 之间
 * @param mode 玩法模式，默认经典博饼（不传时行为与既有版本完全一致）
 */
export function createGame(names: string[], mode: GameMode = 'classic'): GameState {
  if (!Array.isArray(names) || names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    throw new Error(`玩家人数须在 ${MIN_PLAYERS}–${MAX_PLAYERS} 之间，收到 ${names?.length}`);
  }

  const players: Player[] = names.map((rawName, index) => {
    const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
    return {
      id: index,
      name: trimmed.length > 0 ? trimmed : `玩家${index + 1}`,
      prizes: createEmptyPrizeCount(),
      best: null,
      rolls: 0,
      turns: 0,
    };
  });

  return {
    mode,
    players,
    pool: createInitialPool(),
    currentIndex: 0,
    round: 1,
    zhuangyuan: null,
    history: [],
    status: 'playing',
    settled: false,
    // 第 1 圈全员参与；经典模式该字段恒为 null
    challengersLeft: mode === 'zhuangyuan' ? players.length : null,
    totalRolls: 0,
  };
}

/** 当前行动玩家 */
export function currentPlayer(state: GameState): Player {
  return state.players[state.currentIndex];
}

/** 查找当前状元玩家（无则 null） */
export function zhuangyuanPlayer(state: GameState): Player | null {
  if (!state.zhuangyuan) return null;
  return state.players.find((p) => p.id === state.zhuangyuan!.playerId) ?? null;
}

/**
 * 结算：当前状元获得状元奖品；状元为空则奖品空缺。
 */
function settle(state: GameState): GameState {
  const players = state.players.map((p) => ({ ...p, prizes: { ...p.prizes } }));
  const pool = { ...state.pool };

  if (state.zhuangyuan) {
    const winner = players.find((p) => p.id === state.zhuangyuan!.playerId);
    if (winner) {
      winner.prizes.zhuangyuan = 1;
      pool.zhuangyuan = 0;
    }
  }

  return { ...state, players, pool, settled: true };
}

/**
 * 执行一次掷骰（当前玩家的一掷）。
 *
 * 流程：掷骰 → 判定 → 发奖/更新状元 → 记录历史 → 切换下一位 → 判定是否结束 → 结算。
 * 若本次掷骰导致游戏结束，返回的 state.status 为 'finished' 且已完成结算。
 *
 * @throws 游戏已结束时调用会抛错；状元争模式请改用 `takeTurn`
 */
export function rollOnce(
  state: GameState,
  random: RandomFn = defaultRandom,
): { state: GameState; outcome: RollOutcome } {
  if (state.mode === 'zhuangyuan') {
    throw new Error('状元争模式请使用 takeTurn，rollOnce 仅用于经典模式');
  }
  if (state.status === 'finished') {
    throw new Error('游戏已结束，无法继续掷骰');
  }

  const dice = rollDice(random);
  const result = judgeRoll(dice);
  const actor = state.players[state.currentIndex];

  // 不可变更新：复制玩家与奖项计数
  const players = state.players.map((p) => ({ ...p, prizes: { ...p.prizes } }));
  const pool = { ...state.pool };

  // 回合计数与个人最好成绩（经典模式仅用于统计展示）
  players[state.currentIndex].rolls += 1;
  players[state.currentIndex].turns += 1;
  if (result.type === 'zhuangyuan') {
    const best = players[state.currentIndex].best;
    if (!best || compareRolls(result, best) > 0) players[state.currentIndex].best = result;
  }

  let awarded: PrizeKey | null = null;
  let prizeFull = false;
  let zhuangyuanChange: ZhuangyuanChange = 'none';
  let zhuangyuan = state.zhuangyuan;

  if (result.type === 'normal' && result.prizeKey) {
    // 普通奖：先到先得，池空则本次落空，绝不向下顺延
    const key = result.prizeKey;
    if (pool[key] > 0) {
      pool[key] -= 1;
      players[state.currentIndex].prizes[key] = (players[state.currentIndex].prizes[key] ?? 0) + 1;
      awarded = key;
    } else {
      prizeFull = true;
    }
  } else if (result.type === 'zhuangyuan') {
    // 状元类：更大才替换，完全相等先到先得
    if (!zhuangyuan) {
      zhuangyuan = { playerId: actor.id, result };
      zhuangyuanChange = 'became';
    } else if (compareRolls(result, zhuangyuan.result) > 0) {
      zhuangyuan = { playerId: actor.id, result };
      zhuangyuanChange = 'replaced';
    } else {
      zhuangyuanChange = 'kept';
    }
  }

  const outcome: RollOutcome = {
    dice,
    result,
    awarded,
    prizeFull,
    zhuangyuanChange,
    playerId: actor.id,
    playerName: actor.name,
    round: state.round,
  };

  const history: HistoryEntry[] = [...state.history, { ...outcome, seq: state.history.length + 1 }];

  // 切换到下一位玩家；走完一圈则进入下一轮
  let currentIndex = state.currentIndex + 1;
  let round = state.round;
  if (currentIndex >= players.length) {
    currentIndex = 0;
    round += 1;
  }

  // 结束条件由模式分派：经典模式 = 五个普通奖池全空（状元池不参与判定），轮数不设上限
  const finished = isFinished({ ...state, pool, challengersLeft: state.challengersLeft });

  const next: GameState = {
    ...state,
    players,
    pool,
    currentIndex,
    round,
    zhuangyuan,
    history,
    status: finished ? 'finished' : 'playing',
    settled: false,
    totalRolls: state.totalRolls + 1,
  };

  return { state: finished ? settle(next) : next, outcome };
}

/** 状元争单回合的掷骰安全上限（防注入随机源异常导致死循环） */
export const MAX_TURN_ROLLS = 100000;

/** `takeTurn` 的返回值 */
export interface TurnResult {
  state: GameState;
  outcome: TurnOutcome;
  /**
   * 本回合的掷骰序列（含最后一次命中的骰面），仅供界面播放动画使用。
   * 刻意不写入 state —— 单回合可达数百掷，避免长尾序列污染状态与渲染。
   */
  sequence: number[][];
}

/**
 * 执行状元争模式的一个完整回合 —— 当前玩家连掷直到博出状元类为止。
 *
 * 过程掷骰不产生结果、不写入历史；一次调用只追加 1 条回合级记录。
 * 抢位判定复用 `compareRolls`，与经典模式的状元更替逐字一致。
 *
 * @throws 非状元争模式调用、游戏已结束、或单回合超过安全上限时抛错
 */
export function takeTurn(state: GameState, random: RandomFn = defaultRandom): TurnResult {
  if (state.mode !== 'zhuangyuan') {
    throw new Error('takeTurn 仅用于状元争模式，经典模式请使用 rollOnce');
  }
  if (state.status === 'finished') {
    throw new Error('游戏已结束，无法继续掷骰');
  }

  const actorIndex = state.currentIndex;
  const actor = state.players[actorIndex];

  // ── 连掷直到博出状元类 ─────────────────────────────────────
  const sequence: number[][] = [];
  let dice: number[] = rollDice(random);
  let result: RollResult = judgeRoll(dice);
  sequence.push(dice);

  while (result.type !== 'zhuangyuan') {
    if (sequence.length >= MAX_TURN_ROLLS) {
      throw new Error(`单回合掷骰次数超过安全上限 ${MAX_TURN_ROLLS}，疑似随机源异常`);
    }
    dice = rollDice(random);
    result = judgeRoll(dice);
    sequence.push(dice);
  }

  const rolls = sequence.length;

  // ── 不可变更新：玩家、回合/掷骰计数、个人最好成绩 ─────────────
  const players = state.players.map((p) => ({ ...p, prizes: { ...p.prizes } }));
  const me = players[actorIndex];
  me.rolls += rolls;
  me.turns += 1;
  if (!me.best || compareRolls(result, me.best) > 0) me.best = result;

  // ── 抢位判定（与经典模式逐字一致）────────────────────────────
  const prev = state.zhuangyuan;
  let zhuangyuan: { playerId: number; result: RollResult };
  let change: ZhuangyuanChange;
  if (!prev) {
    zhuangyuan = { playerId: actor.id, result };
    change = 'became';
  } else if (compareRolls(result, prev.result) > 0) {
    zhuangyuan = { playerId: actor.id, result };
    change = 'replaced';
  } else {
    zhuangyuan = prev;
    change = 'kept';
  }

  // ── 守擂计数：抢位成功则重置为 N−1（新擂主之外全员重来一遍）──
  const playerCount = players.length;
  let challengersLeft = (state.challengersLeft ?? playerCount) - 1;
  if (change === 'replaced') challengersLeft = playerCount - 1;

  const outcome: TurnOutcome = {
    playerId: actor.id,
    playerName: actor.name,
    rolls,
    dice,
    result,
    change,
    round: state.round,
    finished: challengersLeft <= 0,
  };

  // 回合级历史：一次回合只追加 1 条
  const entry: HistoryEntry = {
    dice,
    result,
    awarded: null,
    prizeFull: false,
    zhuangyuanChange: change,
    playerId: actor.id,
    playerName: actor.name,
    round: state.round,
    seq: state.history.length + 1,
    rolls,
  };

  const finished = outcome.finished;

  // ── 前进到下一位挑战者（擂主不掷骰，跳过）────────────────────
  let currentIndex = actorIndex;
  let round = state.round;
  if (!finished) {
    let idx = actorIndex;
    for (let step = 0; step < playerCount; step += 1) {
      idx += 1;
      if (idx >= playerCount) {
        idx = 0;
        round += 1;
      }
      if (players[idx].id !== zhuangyuan.playerId) break;
    }
    currentIndex = idx;
  }

  const next: GameState = {
    ...state,
    players,
    currentIndex,
    round,
    zhuangyuan,
    history: [...state.history, entry],
    status: finished ? 'finished' : 'playing',
    settled: false,
    challengersLeft,
    totalRolls: state.totalRolls + rolls,
  };

  return { state: finished ? settle(next) : next, outcome, sequence };
}

/**
 * 已发放的奖项汇总，用于结算页展示。
 */
export function summarizePrizes(player: Player): Array<{ key: PrizeKey; name: string; count: number }> {
  const order: PrizeKey[] = ['zhuangyuan', 'duitang', 'sanhong', 'sijin', 'erju', 'yixiu'];
  return order
    .map((key) => ({ key, name: PRIZE_META[key].name, count: player.prizes[key] ?? 0 }))
    .filter((item) => item.count > 0);
}
