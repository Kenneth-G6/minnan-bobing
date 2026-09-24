/**
 * 单颗骰子 —— 白色圆角方块，1 点为红色，其余点深色，带光泽感
 */
import type { CSSProperties } from 'react';

/** 9 宫格点位：1–9 对应 左上→右下 */
const PIP_LAYOUT: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export interface DieProps {
  /** 点数 1–6 */
  value: number;
  /** 是否处于滚动动画中 */
  rolling?: boolean;
  /** 附加样式（用于绝对定位） */
  style?: CSSProperties;
  /** 尺寸 */
  size?: number | string;
}

export function Die({ value, rolling = false, style, size }: DieProps) {
  const pips = PIP_LAYOUT[value] ?? [];

  const mergedStyle: CSSProperties = {
    ...style,
    ...(size !== undefined ? { width: size, height: size } : null),
  };

  return (
    <div
      className={`die${rolling ? ' die--rolling' : ''}`}
      style={mergedStyle}
      data-value={value}
      role="img"
      aria-label={`骰子 ${value} 点`}
    >
      <div className="die__face">
        <span className="die__gloss" aria-hidden="true" />
        {Array.from({ length: 9 }, (_, i) => {
          const cell = i + 1;
          const hasPip = pips.includes(cell);
          const isRed = hasPip && value === 1;
          return (
            <span
              key={cell}
              className={`die__cell${hasPip ? ' is-pip' : ''}${isRed ? ' is-red' : ''}`}
              style={{ gridArea: `${Math.ceil(cell / 3)} / ${((cell - 1) % 3) + 1}` }}
            />
          );
        })}
      </div>
      {/* 落碗时的压感阴影 */}
      <span className="die__shadow" aria-hidden="true" />
    </div>
  );
}

export default Die;
