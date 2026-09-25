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
}

/** 整局游戏状态 */
export interface GameState {
  players: Player[];
  pool: PrizePool;
  /** 当前行动玩家在 players 中的下标 */
  currentIndex: number;
  /** 当前轮次（1 起），仅用于记录与展示，不参与结束判定 */
  round: number;
  /** 当前状元 */
  zhuangyuan: { playerId: number; result: RollResult } | null;
  /** 掷骰历史（按时间顺序） */
  history: HistoryEntry[];
  /** 游戏状态 */
  status: 'playing' | 'finished';
  /** 是否已完成结算发奖 */
  settled: boolean;
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
 * 创建一局新游戏。
 *
 * @param names 玩家姓名列表，长度须在 2–12 之间
 */
export function createGame(names: string[]): GameState {
  if (!Array.isArray(names) || names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    throw new Error(`玩家人数须在 ${MIN_PLAYERS}–${MAX_PLAYERS} 之间，收到 ${names?.length}`);
  }

  const players: Player[] = names.map((rawName, index) => {
    const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
    return {
      id: index,
      name: trimmed.length > 0 ? trimmed : `玩家${index + 1}`,
      prizes: createEmptyPrizeCount(),
    };
  });

  return {
    players,
    pool: createInitialPool(),
    currentIndex: 0,
    round: 1,
    zhuangyuan: null,
    history: [],
    status: 'playing',
    settled: false,
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
 * @throws 游戏已结束时调用会抛错
 */
export function rollOnce(
  state: GameState,
  random: RandomFn = defaultRandom,
): { state: GameState; outcome: RollOutcome } {
  if (state.status === 'finished') {
    throw new Error('游戏已结束，无法继续掷骰');
  }

  const dice = rollDice(random);
  const result = judgeRoll(dice);
  const actor = state.players[state.currentIndex];

  // 不可变更新：复制玩家与奖项计数
  const players = state.players.map((p) => ({ ...p, prizes: { ...p.prizes } }));
  const pool = { ...state.pool };

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

  // 结束条件：五个普通奖池全空（状元池不参与判定）；轮数不设上限
  const finished = isNormalPoolEmpty(pool);

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
  };

  return { state: finished ? settle(next) : next, outcome };
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
