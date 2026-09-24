/**
 * 历史记录 —— 轮次 / 玩家 / 骰子 / 奖项，最新在上
 */
import type { HistoryEntry } from '../core/engine';
import { PRIZE_META } from '../core/types';
import { Die } from './Die';

export interface HistoryLogProps {
  history: HistoryEntry[];
}

/** 把一次掷骰转成简明的结果文案 */
function outcomeLabel(entry: HistoryEntry): { text: string; kind: string } {
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

export function HistoryLog({ history }: HistoryLogProps) {
  if (history.length === 0) {
    return <p className="history__empty">还没开始掷骰，第一碗花落谁家？</p>;
  }

  // 最新在上
  const rows = [...history].reverse();

  return (
    <ol className="history">
      {rows.map((entry) => {
        const label = outcomeLabel(entry);
        return (
          <li key={entry.seq} className={`history__row history__row--${label.kind}`}>
            <span className="history__round">第{entry.round}轮</span>

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
