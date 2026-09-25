/**
 * 游戏主界面 —— 博饼碗、骰子、奖池/擂主榜、玩家、历史记录、掷骰按钮
 *
 * 两种玩法共用同一套骨架，按 state.mode 分派：
 *   - classic     一掷一次判定，右栏为奖池
 *   - zhuangyuan  一个回合连掷到博出状元类为止，右栏为擂主榜，自动重掷演出
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  currentPlayer,
  rollOnce,
  takeTurn,
  zhuangyuanPlayer,
  type GameState,
  type RollOutcome,
  type TurnOutcome,
} from '../core/engine';
import { PRIZE_META, NORMAL_PRIZE_KEYS, DICE_COUNT, type PrizeKey } from '../core/types';
import type { RandomFn } from '../core/random';
import { sound } from '../sound';
import { Crown, Sparkle } from './Decor';
import { DiceBowl } from './DiceBowl';
import { DuelPlayer, SPEED_OPTIONS, type SpeedFactor } from './DuelPlayer';
import { HistoryLog } from './HistoryLog';
import { Leaderboard } from './Leaderboard';
import { PlayerList } from './PlayerList';
import { PrizePool } from './PrizePool';
import { SoundToggle } from './SoundToggle';

/** 掷骰动画总时长（6 颗依次落入 + 定格） */
const ROLL_DURATION = 1300;
/** 结束后自动进入结算的延迟 */
const FINISH_DELAY = 2800;
/** 「直接看结果」档的定格延迟 */
const INSTANT_DELAY = 260;

type Phase = 'idle' | 'rolling' | 'result';

type ResultKind = 'award' | 'full' | 'zhuangyuan' | 'none' | 'keep';

function randomFaces(): number[] {
  return Array.from({ length: DICE_COUNT }, () => Math.floor(Math.random() * 6) + 1);
}

/** 根据经典模式掷骰结论推导展示样式分类 */
function resultKind(outcome: RollOutcome): ResultKind {
  if (outcome.awarded) return 'award';
  if (outcome.prizeFull) return 'full';
  if (outcome.result.type === 'zhuangyuan') return 'zhuangyuan';
  return 'none';
}

export interface GameScreenProps {
  state: GameState;
  /** 动画结束后提交新状态（经典为单掷结论，状元争为一个回合结论） */
  onCommit: (next: GameState, outcome: RollOutcome | TurnOutcome) => void;
  /** 进入结算界面 */
  onFinish: (next: GameState) => void;
  /** 退出并重开（二次确认后回调） */
  onExit: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  /** 可选随机源（测试注入确定性骰子序列），不传即为真随机 */
  random?: RandomFn;
}

export function GameScreen({
  state,
  onCommit,
  onFinish,
  onExit,
  soundEnabled,
  onToggleSound,
  random,
}: GameScreenProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [displayDice, setDisplayDice] = useState<number[]>(() => randomFaces());
  const [outcome, setOutcome] = useState<RollOutcome | null>(null);
  const [turn, setTurn] = useState<TurnOutcome | null>(null);
  const [frames, setFrames] = useState<number[][] | null>(null);
  const [speed, setSpeed] = useState<SpeedFactor>(1);
  const [rollKey, setRollKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFinish, setPendingFinish] = useState(false);

  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);
  /** 状元争过程阶段播完后要执行的「命中定格」 */
  const revealRef = useRef<(() => void) | null>(null);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 卸载时清理所有计时器，避免内存泄漏与状态错乱
  useEffect(() => clearTimers, [clearTimers]);

  const isDuel = state.mode === 'zhuangyuan';
  const actor = currentPlayer(state);
  const zy = zhuangyuanPlayer(state);
  const finished = state.status === 'finished';

  /**
   * 高亮当前玩家。
   * 掷骰动画期间状态尚未提交，currentIndex 仍是掷骰的人；
   * 动画结束后状态已提交，currentIndex 自然变成下一位 —— 与「掷骰子」按钮归属始终一致。
   */
  const highlightIndex = state.currentIndex;

  const remainingNormal = NORMAL_PRIZE_KEYS.reduce((sum, key) => sum + state.pool[key], 0);

  // ── 经典模式：一掷 ─────────────────────────────────────────
  const handleRoll = () => {
    if (phase === 'rolling' || finished) return;

    sound.unlock();
    sound.play('roll');

    // 先按规则算出结果，动画结束后再揭晓
    const { state: next, outcome: result } = rollOnce(state, random);

    setPhase('rolling');
    setOutcome(null);
    setTurn(null);
    setPendingFinish(false);
    setRollKey((k) => k + 1);

    // 骰子乱跳，营造翻滚感
    intervalRef.current = window.setInterval(() => {
      setDisplayDice(randomFaces());
    }, 75);

    const settle = window.setTimeout(() => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayDice(result.dice);
      setOutcome(result);
      setPhase('result');

      // 音效：状元的优先级最高
      if (result.zhuangyuanChange === 'became' || result.zhuangyuanChange === 'replaced') {
        sound.play('zhuangyuan');
      } else if (result.awarded) {
        sound.play('award');
      } else if (result.prizeFull) {
        sound.play('full');
      }

      onCommit(next, result);

      if (next.status === 'finished') {
        setPendingFinish(true);
        const goFinish = window.setTimeout(() => {
          sound.play('fanfare');
          onFinish(next);
        }, FINISH_DELAY);
        timersRef.current.push(goFinish);
      }
    }, ROLL_DURATION);

    timersRef.current.push(settle);
  };

  // ── 状元争：一个完整回合（过程高速重掷 + 命中定格）──────────
  const handleTurn = () => {
    if (phase === 'rolling' || finished) return;

    sound.unlock();
    sound.play('roll');

    const { state: next, outcome: result, sequence } = takeTurn(state, random);
    const processFrames = sequence.slice(0, -1); // 最后一条是命中的那一掷

    setOutcome(null);
    setTurn(null);
    setPendingFinish(false);
    setRollKey((k) => k + 1);
    setPhase('rolling');

    /** 命中定格：落碗动画 + 金效 + 结果提交 */
    const reveal = () => {
      setDisplayDice(result.dice);
      setTurn(result);
      setFrames(null);
      setPhase('result');

      if (result.change === 'became' || result.change === 'replaced') sound.play('zhuangyuan');
      else sound.play('full');

      onCommit(next, result);

      if (next.status === 'finished') {
        setPendingFinish(true);
        const goFinish = window.setTimeout(() => {
          sound.play('fanfare');
          onFinish(next);
        }, FINISH_DELAY);
        timersRef.current.push(goFinish);
      }
    };

    // 已经瞬时出结果，或用户选了「直接看结果」→ 省掉过程阶段
    if (speed === 'instant' || processFrames.length === 0) {
      const delay = speed === 'instant' ? INSTANT_DELAY : ROLL_DURATION;
      timersRef.current.push(window.setTimeout(reveal, delay));
      return;
    }

    revealRef.current = reveal;
    setFrames(processFrames);
  };

  /** 过程阶段播完（由 DuelPlayer 回调，身份稳定） */
  const handleDuelDone = useCallback(() => {
    const reveal = revealRef.current;
    revealRef.current = null;
    reveal?.();
  }, []);

  const handleExitConfirmed = () => {
    clearTimers();
    setConfirmOpen(false);
    onExit();
  };

  // ── 结果区展示分类 ─────────────────────────────────────────
  const kind: ResultKind | null = isDuel
    ? turn
      ? turn.change === 'kept'
        ? 'keep'
        : 'zhuangyuan'
      : null
    : outcome
      ? resultKind(outcome)
      : null;

  const hasResult = isDuel ? turn !== null : outcome !== null;

  /** 经典模式结果文案 */
  let statusText = '';
  if (outcome && !isDuel) {
    if (outcome.awarded) {
      statusText = `恭喜中奖 · ${PRIZE_META[outcome.awarded].name}`;
    } else if (outcome.prizeFull) {
      statusText = `${outcome.result.prize}已满，无奖`;
    } else if (outcome.result.type === 'zhuangyuan') {
      statusText =
        outcome.zhuangyuanChange === 'became'
          ? '成为当前状元'
          : outcome.zhuangyuanChange === 'replaced'
            ? '替换当前状元'
            : '未超过当前状元';
    } else {
      statusText = '这一把没中，下把再来';
    }
  }

  /** 状元争结果文案 */
  let duelStatus = '';
  if (turn) {
    duelStatus =
      turn.change === 'became'
        ? '成为擂主，等一圈人来挑战'
        : turn.change === 'replaced'
          ? '抢过擂主位！'
          : '未超过擂主，守擂成功';
  }

  // 只有真正中奖、或成功坐上/抢过状元位才撒金色光效
  const showSparkles = isDuel
    ? turn !== null && turn.change !== 'kept'
    : outcome !== null &&
      (outcome.awarded !== null ||
        outcome.zhuangyuanChange === 'became' ||
        outcome.zhuangyuanChange === 'replaced');

  const rollDisabled = phase === 'rolling' || finished;

  return (
    <div className="screen screen--game">
      {/* ── 顶栏 ─────────────────────────────────── */}
      <header className="game-header glass">
        <div className="game-header__left">
          {isDuel ? (
            <>
              <span className="round-badge round-badge--mode">
                <b>状元争</b>
              </span>
              <span className="round-meta">
                本圈还剩 {state.challengersLeft ?? 0} 人待博 · 共 {state.players.length} 位玩家
              </span>
            </>
          ) : (
            <>
              <span className="round-badge">
                第 <b>{state.round}</b> 轮
              </span>
              <span className="round-meta">
                还剩 {remainingNormal} 份普通奖 · 共 {state.players.length} 位玩家
              </span>
            </>
          )}
        </div>

        <div className="game-header__right">
          <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmOpen(true)}>
            重新开始
          </button>
        </div>
      </header>

      <main className="game-layout">
        {/* ── 左：玩家 ─────────────────────────────── */}
        <aside className="panel panel--players glass">
          <h2 className="panel__title">玩家</h2>
          <PlayerList
            players={state.players}
            currentIndex={highlightIndex}
            zhuangyuanId={state.zhuangyuan?.playerId ?? null}
            rolling={phase === 'rolling'}
            mode={state.mode}
          />
        </aside>

        {/* ── 中：博饼碗 ───────────────────────────── */}
        <section className="panel panel--center glass">
          <div className="zy-banner">
            {zy ? (
              <>
                <Crown size={30} className="zy-banner__crown" />
                <span className="zy-banner__label">{isDuel ? '当前擂主' : '当前状元'}</span>
                <b className="zy-banner__name">{zy.name}</b>
                {state.zhuangyuan && (
                  <em className="zy-banner__result">{state.zhuangyuan.result.prize}</em>
                )}
              </>
            ) : (
              <span className="zy-banner__empty">
                {isDuel ? '擂主虚位以待，第一个博中状元类的人上位' : '状元还虚位以待'}
              </span>
            )}
          </div>

          <DiceBowl
            dice={displayDice}
            rolling={phase === 'rolling'}
            rollKey={rollKey}
            glowing={showSparkles}
          />

          {/* 状元争：过程掷骰的高速计数演出 */}
          {isDuel && phase === 'rolling' && frames && frames.length > 0 && (
            <DuelPlayer
              frames={frames}
              speed={speed}
              onFrame={(dice) => setDisplayDice(dice)}
              onDone={handleDuelDone}
            />
          )}

          {/* ── 结果区 ───────────────────────────── */}
          <div className={`result-panel${hasResult ? ` is-show result-panel--${kind}` : ''}`}>
            {hasResult ? (
              <>
                {showSparkles && (
                  <span className="result-panel__burst" aria-hidden="true">
                    <Sparkle x="12%" y="18%" size={16} delay={0} />
                    <Sparkle x="84%" y="12%" size={20} delay={120} />
                    <Sparkle x="72%" y="76%" size={14} delay={240} />
                    <Sparkle x="20%" y="70%" size={18} delay={360} />
                  </span>
                )}

                {isDuel && turn ? (
                  <>
                    <p className="result-panel__thrower">
                      {turn.playerName} 连掷 {turn.rolls} 次，博出 {turn.dice.join(' ')}
                    </p>

                    <p className="result-panel__prize">{turn.result.prize}</p>

                    <p className="result-panel__desc">{turn.result.desc}</p>

                    <p className={`result-panel__status result-panel__status--${kind}`}>{duelStatus}</p>

                    {turn.change !== 'kept' && (
                      <p className="result-panel__zy">
                        <Crown size={20} />
                        {turn.change === 'became' ? '坐上擂主位！' : '抢过擂主位！'}
                      </p>
                    )}
                  </>
                ) : (
                  outcome && (
                    <>
                      <p className="result-panel__thrower">
                        {outcome.playerName} 掷出 {outcome.dice.join(' ')}
                      </p>

                      <p className="result-panel__prize">
                        {outcome.result.prize}
                        {outcome.result.level > 0 && (
                          <em className="result-panel__level">等级 {outcome.result.level}</em>
                        )}
                      </p>

                      <p className={`result-panel__status result-panel__status--${kind}`}>{statusText}</p>

                      {(outcome.zhuangyuanChange === 'became' ||
                        outcome.zhuangyuanChange === 'replaced') && (
                        <p className="result-panel__zy">
                          <Crown size={20} />
                          {outcome.zhuangyuanChange === 'became' ? '坐上状元位！' : '抢过状元位！'}
                        </p>
                      )}
                    </>
                  )
                )}
              </>
            ) : (
              <p className="result-panel__idle">
                {phase === 'rolling' ? (
                  <>
                    骰子落碗中……
                    {isDuel && <span className="result-panel__wait">正在等那一下子</span>}
                  </>
                ) : finished ? (
                  <>本局结束，看看谁博到了状元</>
                ) : (
                  <>
                    轮到 <b>{actor.name}</b> {isDuel ? '博一次' : '掷骰'}
                  </>
                )}
              </p>
            )}
          </div>

          {/* ── 操作区 ───────────────────────────── */}
          <div className="action-bar">
            <p className="next-turn">
              {finished ? (
                '本局结束，看看谁博到了状元'
              ) : (
                <>
                  轮到 <b>{actor.name}</b> {isDuel ? '博一次' : '掷骰'}
                </>
              )}
            </p>

            <button
              type="button"
              className="btn btn--primary btn--large btn--roll"
              onClick={isDuel ? handleTurn : handleRoll}
              disabled={rollDisabled}
            >
              {phase === 'rolling'
                ? '骰子落碗中…'
                : finished
                  ? '本局已结束'
                  : isDuel
                    ? '博一次'
                    : '掷骰子'}
            </button>

            {isDuel && (
              <div className="speed-control" role="group" aria-label="演出速度">
                <span className="speed-control__label">演出速度</span>
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    className={`speed-control__btn${speed === opt.value ? ' is-active' : ''}`}
                    aria-pressed={speed === opt.value}
                    onClick={() => setSpeed(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {pendingFinish && (
              <button
                type="button"
                className="btn btn--ghost btn--medium"
                onClick={() => {
                  clearTimers();
                  sound.play('fanfare');
                  onFinish(state);
                }}
              >
                查看最终结算
              </button>
            )}
          </div>
        </section>

        {/* ── 右：奖池（经典）/ 擂主榜（状元争）+ 历史 ── */}
        <aside className="panel panel--side">
          {isDuel ? (
            <div className="panel panel--pool glass">
              <h2 className="panel__title">
                擂主榜
                <span className="panel__hint">最佳成绩 / 回合 · 掷骰</span>
              </h2>
              <Leaderboard
                players={state.players}
                zhuangyuanId={state.zhuangyuan?.playerId ?? null}
              />
            </div>
          ) : (
            <div className="panel panel--pool glass">
              <h2 className="panel__title">
                奖池
                <span className="panel__hint">剩余 / 总数</span>
              </h2>
              <PrizePool
                pool={state.pool}
                highlight={outcome?.result.prizeKey ? (outcome.result.prizeKey as PrizeKey) : null}
              />
            </div>
          )}

          <div className="panel panel--history glass">
            <h2 className="panel__title">
              历史记录
              <span className="panel__hint">
                共 {state.history.length} {isDuel ? '回合' : '掷'}
              </span>
            </h2>
            <HistoryLog history={state.history} mode={state.mode} />
          </div>
        </aside>
      </main>

      {/* ── 重新开始二次确认 ─────────────────────── */}
      {confirmOpen && (
        <div className="modal-mask" role="dialog" aria-modal="true">
          <div className="modal glass">
            <h3 className="modal__title">要重新开始吗？</h3>
            <p className="modal__text">
              当前这局的{isDuel ? '所有回合记录与擂主成绩' : '所有掷骰记录和奖品'}都会清空。
            </p>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost btn--medium" onClick={() => setConfirmOpen(false)}>
                继续这局
              </button>
              <button type="button" className="btn btn--primary btn--medium" onClick={handleExitConfirmed}>
                重新开始
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameScreen;
