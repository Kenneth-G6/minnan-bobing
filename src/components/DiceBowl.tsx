/**
 * 博饼碗 —— 中央大瓷碗，骰子从上方落入碗中
 */
import type { CSSProperties } from 'react';
import { Die } from './Die';

/** 6 颗骰子在碗中的落点（相对碗的百分比） */
const DICE_SLOTS = [
  { x: '29%', y: '41%', rot: -13 },
  { x: '50%', y: '35%', rot: 8 },
  { x: '71%', y: '42%', rot: -6 },
  { x: '30%', y: '66%', rot: 10 },
  { x: '50%', y: '71%', rot: -5 },
  { x: '70%', y: '64%', rot: 14 },
];

export interface DiceBowlProps {
  /** 当前展示的 6 颗骰子点数 */
  dice: number[];
  /** 是否正在掷骰动画中 */
  rolling?: boolean;
  /** 每次掷骰递增，用于强制重放动画 */
  rollKey?: number;
  /** 高亮：中奖时碗体发光 */
  glowing?: boolean;
}

export function DiceBowl({ dice, rolling = false, rollKey = 0, glowing = false }: DiceBowlProps) {
  return (
    <div className={`bowl-stage${glowing ? ' is-glowing' : ''}`}>
      <div className="bowl">
        <div className="bowl-ring bowl-ring--back" aria-hidden="true" />
        <div className="bowl-floor" aria-hidden="true" />

        <div className="dice-stage">
          {dice.map((value, i) => {
            const slot = DICE_SLOTS[i] ?? { x: '50%', y: '50%', rot: 0 };
            return (
              <Die
                key={`${rollKey}-${i}`}
                value={value}
                rolling={rolling}
                style={
                  {
                    left: slot.x,
                    top: slot.y,
                    '--rot': `${slot.rot}deg`,
                    '--delay': `${i * 90}ms`,
                  } as CSSProperties
                }
              />
            );
          })}
        </div>

        <div className="bowl-veil" aria-hidden="true" />
        <div className="bowl-ring bowl-ring--front" aria-hidden="true" />
      </div>
    </div>
  );
}

export default DiceBowl;
