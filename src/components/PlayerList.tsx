/**
 * 玩家列表 —— 高亮当前玩家，状元 / 擂主戴皇冠
 */
import type { Player } from '../core/engine';
import { countPrizes } from '../core/engine';
import type { GameMode } from '../core/types';
import { Crown } from './Decor';

export interface PlayerListProps {
  players: Player[];
  currentIndex: number;
  zhuangyuanId: number | null;
  /** 掷骰动画中，弱化切换动效 */
  rolling?: boolean;
  /** 玩法模式：状元争下徽标为「守擂」、计数为回合数 */
  mode?: GameMode;
}

export function PlayerList({
  players,
  currentIndex,
  zhuangyuanId,
  rolling = false,
  mode = 'classic',
}: PlayerListProps) {
  const isDuel = mode === 'zhuangyuan';

  return (
    <ul className={`player-list${rolling ? ' is-rolling' : ''}`}>
      {players.map((player, index) => {
        const isCurrent = index === currentIndex;
        const isZy = player.id === zhuangyuanId;
        const total = isDuel ? player.turns : countPrizes(player);
        return (
          <li
            key={player.id}
            className={`player-chip${isCurrent ? ' is-current' : ''}${isZy ? ' is-zhuangyuan' : ''}`}
          >
            <span className="player-chip__avatar" aria-hidden="true">
              {player.name.slice(0, 1)}
            </span>

            <span className="player-chip__name">
              {player.name}
              {isZy && (
                <span className="player-chip__badge">
                  <Crown size={16} />
                  {isDuel ? '守擂' : '状元'}
                </span>
              )}
            </span>

            <span
              className="player-chip__count"
              title={isDuel ? `已上场 ${total} 个回合` : `已得奖品 ${total} 个`}
            >
              {total}
            </span>

            {isCurrent && <span className="player-chip__arrow" aria-hidden="true" />}
          </li>
        );
      })}
    </ul>
  );
}

export default PlayerList;
