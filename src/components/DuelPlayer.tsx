/**
 * 自动重掷播放器 —— 状元争里一个回合的「过程掷骰」高速演出
 *
 * 一个回合平均要连掷 83 次才博中一次状元类，p99 可达 381 次，
 * 所以过程阶段不能逐次播完整落碗动画：
 *   - 计数每帧跳动，骰面每 4 帧才刷新一次（降低重渲染压力）
 *   - 单回合过程时长硬上限 5 秒，超出自动压缩单帧间隔
 *   - 提供 ×1 / ×2 / ×4 / 直接看结果 四档速度
 */
import { useEffect, useRef, useState } from 'react';

/** 演出速度档位 */
export type SpeedFactor = 1 | 2 | 4 | 'instant';

/** 过程掷骰的基础间隔（ms） */
const BASE_STEP = 60;
/** 加速后的最低间隔（ms） */
const MIN_STEP = 12;
/** 单回合过程时长硬上限（ms） */
export const PROCESS_CAP_MS = 5000;

/** 可选速度档位 */
export const SPEED_OPTIONS: ReadonlyArray<{ value: SpeedFactor; label: string }> = [
  { value: 1, label: '×1' },
  { value: 2, label: '×2' },
  { value: 4, label: '×4' },
  { value: 'instant', label: '直接看结果' },
];

/**
 * 计算过程掷骰的单帧间隔：
 * 先按「单回合封顶 5 秒」自动加速，再按用户档位提速，最低不低于 12ms。
 */
export function stepInterval(frames: number, speed: SpeedFactor): number {
  const base = Math.max(MIN_STEP, Math.min(BASE_STEP, PROCESS_CAP_MS / Math.max(1, frames)));
  const factor = speed === 'instant' ? 1 : speed;
  return Math.max(MIN_STEP, Math.round(base / factor));
}

export interface DuelPlayerProps {
  /** 过程掷骰的骰面序列（不含最后命中的那一掷） */
  frames: number[][];
  speed: SpeedFactor;
  /** 每帧回调，用于刷新碗中骰面 */
  onFrame?: (dice: number[], index: number) => void;
  /** 过程阶段播完 */
  onDone: () => void;
}

export function DuelPlayer({ frames, speed, onFrame, onDone }: DuelPlayerProps) {
  const [count, setCount] = useState(0);
  const latest = useRef({ onFrame, onDone });
  latest.current = { onFrame, onDone };

  useEffect(() => {
    setCount(0);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      latest.current.onDone();
    };

    if (frames.length === 0) {
      finish();
      return undefined;
    }

    let index = 0;
    const step = stepInterval(frames.length, speed);
    const id = window.setInterval(() => {
      index += 1;
      setCount(index);
      if (index % 4 === 0 || index === frames.length) {
        latest.current.onFrame?.(frames[index - 1], index);
      }
      if (index >= frames.length) {
        window.clearInterval(id);
        finish();
      }
    }, step);

    return () => window.clearInterval(id);
  }, [frames, speed]);

  const total = frames.length;
  const ratio = total > 0 ? Math.min(1, count / total) : 0;

  return (
    <p className="reroll-counter" aria-live="polite">
      <span className="reroll-counter__label">连掷中</span>
      <b className="reroll-counter__num">{count}</b>
      <span className="reroll-counter__unit">次</span>
      <span className="reroll-counter__bar" aria-hidden="true">
        <i style={{ width: `${ratio * 100}%` }} />
      </span>
    </p>
  );
}

export default DuelPlayer;
