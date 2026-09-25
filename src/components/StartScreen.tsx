/**
 * 开始界面 —— 标题、中秋装饰、玩法模式、玩家人数/姓名输入、开始博饼
 */
import { useState } from 'react';
import {
  DEFAULT_PLAYER_COUNT,
  DUEL_HIT_RATE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MODE_META,
  PRIZE_META,
  ZHUANGYUAN_TIERS,
  type GameMode,
  type PrizeKey,
} from '../core/types';
import { BowlIcon, Cloud, Lantern, Moon, Mooncake, Rabbit } from './Decor';
import { SoundToggle } from './SoundToggle';

export interface StartScreenProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onStart: (names: string[], mode: GameMode) => void;
}

/** 规则速览的展示顺序（由高到低） */
const RULE_ROWS: Array<{ level: number; label: string; combo: string }> = [
  { level: 12, label: '状元插金花', combo: '4 个 4 + 2 个 1' },
  { level: 11, label: '六杯红', combo: '6 个 4' },
  { level: 10, label: '遍地锦', combo: '6 个 1' },
  { level: 9, label: '六勃黑', combo: '6 个 2 / 3 / 5 / 6' },
  { level: 8, label: '五王', combo: '5 个 4' },
  { level: 7, label: '五子', combo: '5 个同点（非 4）' },
  { level: 6, label: '四红', combo: '4 个 4' },
  { level: 5, label: '对堂', combo: '1–6 各一个' },
  { level: 4, label: '三红', combo: '3 个 4' },
  { level: 3, label: '四进', combo: '4 个同点（非 4）' },
  { level: 2, label: '二举', combo: '2 个 4' },
  { level: 1, label: '一秀', combo: '1 个 4' },
];

const PRIZE_ORDER: PrizeKey[] = ['yixiu', 'erju', 'sijin', 'sanhong', 'duitang', 'zhuangyuan'];

const MODES: GameMode[] = ['classic', 'zhuangyuan'];

export function StartScreen({ soundEnabled, onToggleSound, onStart }: StartScreenProps) {
  const [count, setCount] = useState(DEFAULT_PLAYER_COUNT);
  const [names, setNames] = useState<string[]>(() => Array.from({ length: DEFAULT_PLAYER_COUNT }, () => ''));
  const [mode, setMode] = useState<GameMode>('classic');
  const [showRules, setShowRules] = useState(false);

  const isDuel = mode === 'zhuangyuan';

  /** 调整人数，同步姓名输入框数量（保留已填内容） */
  const updateCount = (next: number) => {
    const clamped = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, next));
    setCount(clamped);
    setNames((prev) => {
      const array = prev.slice(0, clamped);
      while (array.length < clamped) array.push('');
      return array;
    });
  };

  const setName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const handleStart = () => {
    onStart(
      names.slice(0, count).map((raw, i) => (raw.trim() ? raw.trim() : `玩家${i + 1}`)),
      mode,
    );
  };

  return (
    <div className="screen screen--start">
      {/* ── 中秋装饰 ───────────────────────────────── */}
      <div className="decor-layer" aria-hidden="true">
        <Cloud className="decor-cloud decor-cloud--1" width={190} />
        <Cloud className="decor-cloud decor-cloud--2" width={150} />
        <div className="decor-moon-wrap">
          <Moon size={150} />
        </div>
        <div className="decor-lantern decor-lantern--left">
          <Lantern size={54} />
        </div>
        <div className="decor-lantern decor-lantern--right">
          <Lantern size={64} />
        </div>
        <div className="decor-rabbit">
          <Rabbit size={132} />
        </div>
        <div className="decor-bowl">
          <BowlIcon size={120} />
        </div>
      </div>

      <div className="screen__topbar">
        <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
      </div>

      <div className="start-card glass">
        <p className="start-card__eyebrow">中秋团圆 · 闽南民俗</p>
        <h1 className="start-card__title">闽南中秋博饼</h1>
        <p className="start-card__subtitle">
          六颗骰子一只碗，一家人围坐争状元。愿今夜月圆人圆，博个好彩头。
        </p>

        {/* 玩法模式 */}
        <section className="start-field">
          <div className="start-field__head">
            <span className="start-field__label">玩法模式</span>
            <span className="start-field__hint">{isDuel ? '只争状元' : '博全套奖品'}</span>
          </div>

          <div className="mode-grid" role="group" aria-label="玩法模式">
            {MODES.map((key) => {
              const active = key === mode;
              return (
                <button
                  key={key}
                  type="button"
                  className={`mode-card${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setMode(key)}
                >
                  <span className="mode-card__name">{MODE_META[key].name}</span>
                  <span className="mode-card__tag">{MODE_META[key].tagline}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 人数 */}
        <section className="start-field">
          <div className="start-field__head">
            <span className="start-field__label">玩家人数</span>
            <span className="start-field__hint">
              可选 {MIN_PLAYERS}–{MAX_PLAYERS} 人
            </span>
          </div>

          <div className="count-control">
            <button
              type="button"
              className="btn btn--round btn--ghost"
              onClick={() => updateCount(count - 1)}
              disabled={count <= MIN_PLAYERS}
              aria-label="减少人数"
            >
              −
            </button>

            <div className="count-control__value">
              <b>{count}</b>
              <span>人</span>
            </div>

            <button
              type="button"
              className="btn btn--round btn--ghost"
              onClick={() => updateCount(count + 1)}
              disabled={count >= MAX_PLAYERS}
              aria-label="增加人数"
            >
              +
            </button>
          </div>

          <input
            className="count-slider"
            type="range"
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            value={count}
            onChange={(e) => updateCount(Number(e.target.value))}
            aria-label="玩家人数滑块"
          />
        </section>

        {/* 姓名 */}
        <section className="start-field">
          <div className="start-field__head">
            <span className="start-field__label">玩家姓名</span>
            <span className="start-field__hint">留空则用「玩家N」</span>
          </div>
          <div className="name-grid">
            {names.map((value, index) => (
              <label key={index} className="name-input">
                <span className="name-input__index">{index + 1}</span>
                <input
                  type="text"
                  value={value}
                  maxLength={12}
                  placeholder={`玩家${index + 1}`}
                  onChange={(e) => setName(index, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>

        <button type="button" className="btn btn--primary btn--large start-card__start" onClick={handleStart}>
          开始博饼
        </button>

        <button type="button" className="rules-toggle" onClick={() => setShowRules((v) => !v)}>
          {showRules ? '收起规则速览' : '看看规则速览'}
        </button>

        {showRules && (
          <div className="rules-panel">
            {isDuel ? (
              <>
                <div className="rules-panel__section">
                  <h3 className="rules-panel__title">判定表（只认四红及以上 7 级）</h3>
                  <ol className="rules-table rules-table--duel">
                    {ZHUANGYUAN_TIERS.map((row) => (
                      <li key={row.level}>
                        <span className="rules-table__level">{row.level}</span>
                        <span className="rules-table__label">{row.name}</span>
                        <span className="rules-table__combo">{row.combo}</span>
                        <span className="rules-table__rate">{row.rate}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <p className="rules-panel__note">
                  每一次回合都持续掷骰，<b>直到博出四红及以上为止</b>；中间那些没博中的掷骰不产生结果、
                  不计入记录。一秀、二举、四进、三红、对堂在本模式中<b>不存在</b>，整套奖池不参与。
                  <br />
                  首个博出状元类的人坐上<b>擂主位</b>，其后谁的状元类更大谁抢位；擂主本人不再掷骰、只守擂。
                  一圈之内无人抢位，状元即定格夺冠。
                </p>

                <p className="rules-panel__note rules-panel__note--warn">
                  这 7 级的合计命中率只有 <b>{DUEL_HIT_RATE}</b>（平均 83 掷才博中一次），所以一局动辄几百掷，
                  绝大多数时间都在等那一下子——这是规则的必然，不是卡住了。
                </p>
              </>
            ) : (
              <>
                <div className="rules-panel__section">
                  <h3 className="rules-panel__title">奖项与奖品</h3>
                  <ul className="rules-prize">
                    {PRIZE_ORDER.map((key) => (
                      <li key={key}>
                        <Mooncake size={22} />
                        <span className="rules-prize__name">{PRIZE_META[key].name}</span>
                        <span className="rules-prize__count">{PRIZE_META[key].count} 个</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rules-panel__section">
                  <h3 className="rules-panel__title">判定表（从高到低匹配）</h3>
                  <ol className="rules-table">
                    {RULE_ROWS.map((row) => (
                      <li key={row.level}>
                        <span className="rules-table__level">{row.level}</span>
                        <span className="rules-table__label">{row.label}</span>
                        <span className="rules-table__combo">{row.combo}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <p className="rules-panel__note">
                  普通奖先到先得，发完即「该奖项已满，无奖」，不向下顺延。状元类奖项更大者替换当前状元，
                  完全相等先到先得。五个普通奖全部博完即结束，当前状元获得状元奖品。
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StartScreen;
