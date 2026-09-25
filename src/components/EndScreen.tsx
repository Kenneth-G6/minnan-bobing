/**
 * 结算界面 —— 团圆喜庆，逐位玩家的战果清单与状元 / 擂主加冕
 *
 * 经典模式：按奖品数排行，状元加冕；
 * 状元争：按本局最佳成绩排行，擂主加冕，其余人展示个人最好成绩。
 */
import { countPrizes, summarizePrizes, type GameState, type Player } from '../core/engine';
import { compareRolls } from '../core/rules';
import { PRIZE_META } from '../core/types';
import { Crown, Mooncake, RedFlower, Sparkle } from './Decor';
import { SoundToggle } from './SoundToggle';

export interface EndScreenProps {
  state: GameState;
  /** 回到开始界面 */
  onRestart: () => void;
  /** 沿用相同玩家再开一局 */
  onPlayAgain: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

/** 加冕时飘落的金粉 */
const GOLD_DUST = [
  { x: '8%', y: '12%', size: 18, delay: 0 },
  { x: '26%', y: '4%', size: 12, delay: 260 },
  { x: '48%', y: '10%', size: 22, delay: 120 },
  { x: '70%', y: '2%', size: 14, delay: 420 },
  { x: '88%', y: '14%', size: 20, delay: 200 },
  { x: '16%', y: '48%', size: 14, delay: 560 },
  { x: '82%', y: '52%', size: 16, delay: 340 },
];

/** 经典模式：状元优先，其次按奖品总数排序 */
function rankClassic(players: Player[], zyId: number | null): Player[] {
  return [...players].sort((a, b) => {
    if (a.id === zyId) return -1;
    if (b.id === zyId) return 1;
    return countPrizes(b) - countPrizes(a);
  });
}

/** 状元争：按本局最佳成绩排序（擂主必然就是全场最高） */
function rankDuel(players: Player[], zyId: number | null): Player[] {
  return [...players].sort((a, b) => {
    if (a.id === zyId) return -1;
    if (b.id === zyId) return 1;
    if (a.best && b.best) return compareRolls(b.best, a.best);
    if (a.best) return -1;
    if (b.best) return 1;
    return a.id - b.id;
  });
}

export function EndScreen({ state, onRestart, onPlayAgain, soundEnabled, onToggleSound }: EndScreenProps) {
  const isDuel = state.mode === 'zhuangyuan';
  const zyId = state.zhuangyuan?.playerId ?? null;
  const zyPlayer = zyId === null ? null : (state.players.find((p) => p.id === zyId) ?? null);

  const ranked = isDuel ? rankDuel(state.players, zyId) : rankClassic(state.players, zyId);

  const reason =
    state.history.length === 0
      ? ''
      : isDuel
        ? '本圈无人抢位，状元定格'
        : '普通奖全部博完';

  return (
    <div className="screen screen--end">
      <div className="screen__topbar">
        <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
      </div>

      {/* ── 状元 / 擂主加冕 ───────────────────────── */}
      <section className="crowning">
        <span className="crowning__dust" aria-hidden="true">
          {GOLD_DUST.map((d, i) => (
            <Sparkle key={i} x={d.x} y={d.y} size={d.size} delay={d.delay} />
          ))}
        </span>

        {zyPlayer ? (
          <div className="crowning__inner">
            <div className="crowning__crown">
              <Crown size={86} />
            </div>
            <p className="crowning__eyebrow">{isDuel ? '本轮擂主 · 加冕' : '本轮状元 · 加冕'}</p>
            <h1 className="crowning__name">{zyPlayer.name}</h1>
            <p className="crowning__prize">
              <RedFlower size={26} />
              {state.zhuangyuan?.result.prize}
            </p>
            <p className="crowning__desc">
              {state.zhuangyuan?.result.desc} ——{' '}
              {isDuel ? '守擂到最后，独占状元饼！' : '博得头筹，独占状元饼！'}
            </p>
          </div>
        ) : (
          <div className="crowning__inner">
            <p className="crowning__eyebrow">{isDuel ? '本轮擂主' : '本轮状元'}</p>
            <h1 className="crowning__name crowning__name--empty">状元空缺</h1>
            <p className="crowning__desc">这一夜谁都没博出状元，状元饼留待来年再争。</p>
          </div>
        )}
      </section>

      {/* ── 各玩家战果 ───────────────────────────── */}
      <section className="tally glass">
        <h2 className="tally__title">
          团圆战果
          {reason && <span className="tally__reason">{reason}，本局结束</span>}
        </h2>

        <ul className="tally__grid">
          {ranked.map((player) => {
            const isZy = player.id === zyId;

            if (isDuel) {
              return (
                <li key={player.id} className={`tally-card${isZy ? ' is-zhuangyuan' : ''}`}>
                  <div className="tally-card__head">
                    <span className="tally-card__avatar" aria-hidden="true">
                      {player.name.slice(0, 1)}
                    </span>
                    <span className="tally-card__name">
                      {player.name}
                      {isZy && <Crown size={20} className="tally-card__crown" />}
                    </span>
                    <span className="tally-card__total">
                      <b>{player.turns}</b> 回合
                    </span>
                  </div>

                  {player.best ? (
                    <ul className="tally-card__prizes">
                      <li className="tally-prize tally-prize--zhuangyuan tally-prize--stack">
                        <RedFlower size={20} />
                        <span className="tally-prize__name">
                          {player.best.prize}
                          {isZy && <em>状元饼</em>}
                        </span>
                        <span className="tally-prize__count">{player.best.desc}</span>
                      </li>
                      <li className="tally-meta">累计连掷 {player.rolls} 次</li>
                    </ul>
                  ) : (
                    <p className="tally-card__none">本局未上场</p>
                  )}
                </li>
              );
            }

            const prizes = summarizePrizes(player);
            const total = countPrizes(player);
            return (
              <li key={player.id} className={`tally-card${isZy ? ' is-zhuangyuan' : ''}`}>
                <div className="tally-card__head">
                  <span className="tally-card__avatar" aria-hidden="true">
                    {player.name.slice(0, 1)}
                  </span>
                  <span className="tally-card__name">
                    {player.name}
                    {isZy && <Crown size={20} className="tally-card__crown" />}
                  </span>
                  <span className="tally-card__total">
                    <b>{total}</b> 件
                  </span>
                </div>

                {prizes.length > 0 ? (
                  <ul className="tally-card__prizes">
                    {prizes.map((item) => (
                      <li key={item.key} className={`tally-prize tally-prize--${item.key}`}>
                        <Mooncake size={20} dim={false} />
                        <span className="tally-prize__name">{item.name}</span>
                        <span className="tally-prize__count">
                          {item.count} 个
                          {item.key === 'zhuangyuan' && <em>状元饼</em>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tally-card__none">
                    这次没博到奖品
                    <span className="tally-card__none-note">
                      （{PRIZE_META.yixiu.name}等普通奖已发完或未中）
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── 操作 ─────────────────────────────────── */}
      <div className="end-actions">
        <button type="button" className="btn btn--ghost btn--medium" onClick={onRestart}>
          重新开始
        </button>
        <button type="button" className="btn btn--primary btn--large" onClick={onPlayAgain}>
          再来一局（相同玩家）
        </button>
      </div>

      <footer className="end-footer">
        <Mooncake size={18} />
        愿年年月圆，家家团圆
        <Mooncake size={18} />
      </footer>
    </div>
  );
}

export default EndScreen;
