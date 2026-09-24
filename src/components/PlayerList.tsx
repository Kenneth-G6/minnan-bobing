/**
 * 玩家列表 —— 高亮当前玩家，状元戴皇冠
 */
import type { Player } from '../core/engine';
import { countPrizes } from '../core/engine';
import { Crown } from './Decor';

export interface PlayerListProps {
  players: Player[];
  currentIndex: number;
  zhuangyuanId: number | null;
  /** 掷骰动画中，弱化切换动效 */
  rolling?: boolean;
}

export function PlayerList({ players, currentIndex, zhuangyuanId, rolling = false }: PlayerListProps) {
  return (
    <ul className={`player-list${rolling ? ' is-rolling' : ''}`}>
      {players.map((player, index) => {
        const isCurrent = index === currentIndex;
        const isZy = player.id === zhuangyuanId;
        const total = countPrizes(player);
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
                  状元
                </span>
              )}
            </span>

            <span className="player-chip__count" title={`已得奖品 ${total} 个`}>
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
