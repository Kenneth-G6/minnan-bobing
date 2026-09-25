/**
 * 擂主榜 —— 状元争模式的右栏：各人最佳成绩排行
 *
 * 擂主恒在首位（他的成绩必然就是全场最高），其余按最佳成绩降序，
 * 还没上过场的人排在最后。
 */
import type { Player } from '../core/engine';
import { compareRolls } from '../core/rules';
import { Crown, RedFlower } from './Decor';

export interface LeaderboardProps {
  players: Player[];
  zhuangyuanId: number | null;
}

export function Leaderboard({ players, zhuangyuanId }: LeaderboardProps) {
  const ranked = [...players].sort((a, b) => {
    if (a.id === zhuangyuanId) return -1;
    if (b.id === zhuangyuanId) return 1;
    if (a.best && b.best) return compareRolls(b.best, a.best);
    if (a.best) return -1;
    if (b.best) return 1;
    return a.id - b.id;
  });

  return (
    <ul className="leaderboard">
      {ranked.map((player, index) => {
        const isZy = player.id === zhuangyuanId;
        return (
          <li key={player.id} className={`leader-row${isZy ? ' is-zhuangyuan' : ''}`}>
            <span className="leader-row__rank">{index + 1}</span>

            <span className="leader-row__avatar" aria-hidden="true">
              {player.name.slice(0, 1)}
            </span>

            <span className="leader-row__main">
              <span className="leader-row__name">
                {player.name}
                {isZy && (
                  <span className="leader-row__badge">
                    <Crown size={14} />
                    守擂中
                  </span>
                )}
              </span>

              <span className="leader-row__best">
                {player.best ? (
                  <>
                    <RedFlower size={13} />
                    {player.best.prize}
                  </>
                ) : (
                  <em className="leader-row__none">还没上场</em>
                )}
              </span>
            </span>

            <span className="leader-row__meta">
              {player.turns > 0 && (
                <>
                  <b>{player.turns}</b> 回合
                  <i>{player.rolls} 掷</i>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default Leaderboard;
