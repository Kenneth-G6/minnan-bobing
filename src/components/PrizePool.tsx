/**
 * 奖池 —— 用月饼卡片展示各奖项剩余数量
 */
import type { PrizePool as Pool } from '../core/engine';
import { PRIZE_META, type PrizeKey } from '../core/types';
import { Mooncake } from './Decor';

/** 展示顺序：由高到低 */
const DISPLAY_ORDER: PrizeKey[] = ['zhuangyuan', 'duitang', 'sanhong', 'sijin', 'erju', 'yixiu'];

export interface PrizePoolProps {
  pool: Pool;
  /** 本次掷骰涉及到的奖项，用于高亮 */
  highlight?: PrizeKey | null;
}

export function PrizePool({ pool, highlight = null }: PrizePoolProps) {
  return (
    <ul className="prize-pool">
      {DISPLAY_ORDER.map((key) => {
        const meta = PRIZE_META[key];
        const remaining = pool[key] ?? 0;
        const isEmpty = remaining <= 0;
        const ratio = meta.count > 0 ? remaining / meta.count : 0;
        return (
          <li
            key={key}
            className={[
              'prize-item',
              isEmpty ? 'is-empty' : '',
              highlight === key ? 'is-highlight' : '',
              key === 'zhuangyuan' ? 'prize-item--zhuangyuan' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <Mooncake size={30} dim={isEmpty} />

            <div className="prize-item__info">
              <span className="prize-item__name">
                {meta.name}
                {key === 'zhuangyuan' && <em className="prize-item__tag">最大奖</em>}
              </span>
              <span className="prize-item__desc">{meta.desc}</span>
              <span className="prize-item__bar" aria-hidden="true">
                <i style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
              </span>
            </div>

            <span className={`prize-item__count${isEmpty ? ' is-empty' : ''}`}>
              <b>{remaining}</b>
              <i>/{meta.count}</i>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default PrizePool;
