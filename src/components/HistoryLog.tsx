/**
 * 历史记录 —— 最新在上
 *
 * 经典模式按「掷」记录；状元争按「回合」记录（一次连掷只留一条）。
 */
import type { HistoryEntry } from '../core/engine';
import { PRIZE_META, type GameMode } from '../core/types';
import { Die } from './Die';

export interface HistoryLogProps {
  history: HistoryEntry[];
  /** 玩法模式，决定记录粒度 */
  mode?: GameMode;
}

/** 把一次掷骰 / 一个回合转成简明的结果文案 */
function outcomeLabel(entry: HistoryEntry, mode: GameMode): { text: string; kind: string } {
  if (mode === 'zhuangyuan') {
    const prefix = `连掷 ${entry.rolls ?? 1} 次 · `;
    if (entry.zhuangyuanChange === 'became') {
      return { text: `${prefix}${entry.result.prize} · 成为擂主`, kind: 'zhuangyuan' };
    }
    if (entry.zhuangyuanChange === 'replaced') {
      return { text: `${prefix}${entry.result.prize} · 抢过擂主`, kind: 'zhuangyuan' };
    }
    return { text: `${prefix}${entry.result.prize} · 未超过擂主`, kind: 'keep' };
  }

  if (entry.awarded) {
    return { text: `中奖 · ${PRIZE_META[entry.awarded].name}`, kind: 'award' };
  }
  if (entry.prizeFull) {
    return { text: `${entry.result.prize}已满，无奖`, kind: 'full' };
  }
  if (entry.result.type === 'zhuangyuan') {
    if (entry.zhuangyuanChange === 'became') {
      return { text: `${entry.result.prize} · 成为状元`, kind: 'zhuangyuan' };
    }
    if (entry.zhuangyuanChange === 'replaced') {
      return { text: `${entry.result.prize} · 替换状元`, kind: 'zhuangyuan' };
    }
    return { text: `${entry.result.prize} · 未超过状元`, kind: 'keep' };
  }
  return { text: '无奖', kind: 'none' };
}

export function HistoryLog({ history, mode = 'classic' }: HistoryLogProps) {
  const isDuel = mode === 'zhuangyuan';

  if (history.length === 0) {
    return (
      <p className="history__empty">
        {isDuel ? '还没开博，第一个博中状元类的人就是擂主。' : '还没开始掷骰，第一碗花落谁家？'}
      </p>
    );
  }

  // 最新在上
  const rows = [...history].reverse();

  return (
    <ol className="history">
      {rows.map((entry) => {
        const label = outcomeLabel(entry, mode);
        return (
          <li key={entry.seq} className={`history__row history__row--${label.kind}`}>
            <span className="history__round">
              {isDuel ? `第${entry.round}圈` : `第${entry.round}轮`}
            </span>

            <span className="history__player" title={entry.playerName}>
              {entry.playerName}
            </span>

            <span className="history__dice" title={entry.dice.join(' + ')}>
              {entry.dice.map((value, i) => (
                <Die key={i} value={value} size={18} />
              ))}
            </span>

            <span className={`history__result history__result--${label.kind}`}>{label.text}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default HistoryLog;
