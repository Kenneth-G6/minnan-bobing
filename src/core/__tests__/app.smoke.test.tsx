// @vitest-environment jsdom
/**
 * 应用渲染冒烟测试 —— 验证三阶段界面能真实挂载、交互不报错。
 *
 * 覆盖：
 *   1. 开始界面渲染（标题、默认玩家人数、姓名输入框）
 *   2. 调整人数后开始博饼，进入游戏界面（玩家高亮、奖池、掷骰按钮）
 *   3. 掷骰 → 动画结束 → 结果与历史记录写入
 *   4. 轮次只累加不封顶
 *   5. 一直博到普通奖发完 → 结算界面正常渲染
 *   6. 状元争：模式选择、规则速览切换、连掷演出、擂主收官全流程
 *   7. 全流程不产生 React 运行时错误
 *
 * 经典模式结束条件只剩「普通奖全部发完」后，靠真随机掷骰无法在有限步内稳定结束，
 * 因此注入确定性骰子序列：第 1 掷博出状元插金花，其后 62 掷恰好清空五个普通奖池。
 * 状元争同理 —— 每回合平均要连掷 83 次才博中，也必须注入确定性序列。
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import type { RandomFn } from '../random';
import { diceSequenceRandom } from '../random';

let container: HTMLDivElement;
let root: Root;
let errorSpy: ReturnType<typeof vi.spyOn>;

/** 掷骰动画时长 + 余量 */
const ROLL_TICKS = 1500;
/** 状元争一个完整回合（过程演出 + 命中定格 + 可能的结算跳转）的推进量 */
const TURN_TICKS = 8000;

// ── 确定性骰子序列 ────────────────────────────────────────────
const NO_PRIZE = [2, 2, 3, 3, 5, 6]; // 无奖
const CHAJINHUA = [4, 4, 4, 4, 1, 1]; // 状元插金花（不消耗普通奖池）
const YIXIU = [4, 1, 2, 3, 5, 5]; // 一秀 ×1（刻意避开「六点全不同」的对堂形态）
const ERJU = [4, 4, 1, 2, 3, 5]; // 二举 ×2
const SANHONG = [4, 4, 4, 1, 2, 3]; // 三红 ×3
const DUITANG = [1, 2, 3, 4, 5, 6]; // 对堂 ×1
const SIJIN = [1, 1, 1, 1, 2, 3]; // 四进 ×4
const DUEL_WUZI = [5, 5, 5, 5, 5, 2]; // 五子（状元类 7）
const DUEL_SIHONG = [4, 4, 4, 4, 2, 1]; // 四红（状元类 6）

/** 从空池开始、发满全部普通奖所需的总掷骰数（1 + 32 + 16 + 4 + 2 + 8） */
const FULL_GAME_ROLLS = 63;

/**
 * 构造「必然把五个普通奖池发空」的骰子序列：
 * 插金花抢先占状元位，随后按奖池数量依次发完一秀 / 二举 / 三红 / 对堂 / 四进。
 * 尾部补几掷无奖作为余量，防止断言漂移时序列耗尽抛错。
 */
function winningSequence(): number[][] {
  return [
    CHAJINHUA,
    ...Array.from({ length: 32 }, () => YIXIU),
    ...Array.from({ length: 16 }, () => ERJU),
    ...Array.from({ length: 4 }, () => SANHONG),
    ...Array.from({ length: 2 }, () => DUITANG),
    ...Array.from({ length: 8 }, () => SIJIN),
    ...Array.from({ length: 5 }, () => NO_PRIZE),
  ];
}

/**
 * 状元争 4 人局：恰好 4 个回合收官。
 *   回合 1（玩家1）连掷 2 次博出五子 → 成为擂主
 *   回合 2（玩家2）连掷 3 次博出四红 → 未超过
 *   回合 3（玩家3）一击即中四红   → 未超过
 *   回合 4（玩家4）一击即中四红   → 未超过 → 本圈无人抢位，收官
 */
function duelSequence(): number[][] {
  return [
    NO_PRIZE,
    DUEL_WUZI,
    NO_PRIZE,
    NO_PRIZE,
    DUEL_SIHONG,
    DUEL_SIHONG,
    DUEL_SIHONG,
  ];
}

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  errorSpy.mockRestore();
});

function renderApp(random?: RandomFn) {
  act(() => {
    root.render(random ? <App random={random} /> : <App />);
  });
}

/** 一路点「掷骰子」直到进入结算界面，返回实际掷骰次数 */
function rollUntilEnd(limit = FULL_GAME_ROLLS + 10): number {
  let rolls = 0;
  while (rolls < limit && !container.querySelector('.screen--end')) {
    const button = container.querySelector<HTMLButtonElement>('.btn--roll');
    if (!button || button.disabled) break;
    click('.btn--roll');
    tick(ROLL_TICKS + 3200); // 覆盖动画 + 自动跳转结算的延迟
    rolls += 1;
  }
  return rolls;
}

function text(): string {
  return container.textContent ?? '';
}

/** 按选择器点击（派发冒泡 click，触发 React 合成事件） */
function click(selector: string) {
  const el = container.querySelector(selector);
  expect(el, `找不到可点击元素 ${selector}`).not.toBeNull();
  act(() => {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** 推进假定时器并让 React 完成更新 */
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** 在开始界面选中指定玩法模式 */
function pickMode(label: string) {
  const card = Array.from(container.querySelectorAll('.mode-card')).find((b) =>
    (b.textContent ?? '').includes(label),
  );
  expect(card, `找不到模式卡片 ${label}`).not.toBeNull();
  act(() => {
    card!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** 把玩家人数调整到指定值（默认 6 人） */
function setCountTo(target: number) {
  const value = () => Number(container.querySelector('.count-control__value b')?.textContent ?? '0');
  const [minus, plus] = Array.from(
    container.querySelectorAll<HTMLButtonElement>('.count-control .btn--round'),
  );
  let guard = 0;
  while (value() !== target && guard < 20) {
    const button = value() > target ? minus : plus;
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    guard += 1;
  }
  expect(value(), '玩家人数调整失败').toBe(target);
}

/** 交一次「博一次」，把过程演出与命中定格全部推进完 */
function playDuelTurn() {
  click('.btn--roll');
  tick(TURN_TICKS);
}

describe('应用整体流程', () => {
  it('开始界面渲染标题与默认 6 位玩家输入', () => {
    renderApp();

    expect(text()).toContain('闽南中秋博饼');
    expect(text()).toContain('玩家人数');
    expect(container.querySelectorAll('.name-input input')).toHaveLength(6);
    expect(container.querySelector('.start-card__start')).not.toBeNull();
    // 默认音效开启
    expect(text()).toContain('音效开');
  });

  it('规则速览可展开并列出全部奖项', () => {
    renderApp();
    click('.rules-toggle');

    const panel = container.querySelector('.rules-panel');
    expect(panel).not.toBeNull();
    for (const name of [
      '状元插金花',
      '六杯红',
      '遍地锦',
      '六勃黑',
      '五王',
      '五子',
      '四红',
      '对堂',
      '三红',
      '四进',
      '二举',
      '一秀',
    ]) {
      expect(panel!.textContent).toContain(name);
    }
  });

  it('调整人数后开始博饼，进入游戏界面', () => {
    renderApp();

    // 减少到 4 人（点两次「−」）
    click('.count-control .btn--round');
    click('.count-control .btn--round');
    expect(text()).toContain('4');

    click('.start-card__start');

    // 玩家列表 4 人
    expect(container.querySelectorAll('.player-chip')).toHaveLength(4);
    expect(text()).toContain('玩家1');
    expect(text()).toContain('玩家4');
    // 奖池与掷骰按钮
    expect(container.querySelectorAll('.prize-item')).toHaveLength(6);
    expect(container.querySelector('.btn--roll')).not.toBeNull();
    // 第 1 轮、状元虚位以待
    expect(text()).toContain('第');
    expect(text()).toContain('状元还虚位以待');
    // 初始无历史记录
    expect(container.querySelector('.history__empty')).not.toBeNull();
    expect(container.querySelectorAll('.die')).toHaveLength(6);
    // 首个玩家被高亮
    expect(container.querySelector('.player-chip.is-current')?.textContent).toContain('玩家1');
  });

  it('掷骰后写入历史记录并展示结果', () => {
    renderApp();
    click('.start-card__start');

    click('.btn--roll');
    // 动画进行中：按钮禁用、提示文案出现，且仍高亮掷骰者本人
    expect(text()).toContain('骰子落碗中');
    expect(container.querySelector<HTMLButtonElement>('.btn--roll')!.disabled).toBe(true);
    expect(container.querySelector('.player-chip.is-current')?.textContent).toContain('玩家1');

    tick(ROLL_TICKS);

    // 动画结束：结果区展示、历史记录 +1、按钮恢复
    expect(container.querySelector('.result-panel.is-show')).not.toBeNull();
    expect(container.querySelectorAll('.history__row')).toHaveLength(1);
    expect(container.querySelector<HTMLButtonElement>('.btn--roll')!.disabled).toBe(false);

    // 轮到下一位玩家：玩家列表高亮与「轮到谁」提示都指向玩家2
    expect(container.querySelector('.player-chip.is-current')?.textContent).toContain('玩家2');
    expect(container.querySelector('.next-turn')?.textContent).toContain('玩家2');
  });

  it('轮次只累加不封顶：走完一圈即进入第 2 轮，徽章不再显示上限', () => {
    renderApp();
    click('.start-card__start'); // 默认 6 人

    const badge = () => container.querySelector('.round-badge')?.textContent ?? '';
    expect(badge()).toContain('第');
    expect(badge()).toContain('1');

    // 6 人各掷一次 → 走完第 1 圈
    for (let i = 0; i < 6; i += 1) {
      click('.btn--roll');
      tick(ROLL_TICKS);
    }

    expect(badge()).toContain('2');
    expect(badge()).not.toContain('/');
    // 62 份普通奖不可能 6 掷发完，游戏必定仍在进行
    expect(container.querySelector('.screen--game')).not.toBeNull();
    expect(container.querySelectorAll('.history__row')).toHaveLength(6);
  });

  it('连续掷骰会把记录累积到历史，并在普通奖发完后进入结算界面', () => {
    renderApp(diceSequenceRandom(winningSequence()));
    click('.start-card__start');

    const rolls = rollUntilEnd();

    expect(rolls).toBe(FULL_GAME_ROLLS);
    expect(container.querySelector('.screen--end'), '应进入结算界面').not.toBeNull();

    const endText = text();
    expect(endText).toContain('团圆战果');
    // 唯一结束条件：普通奖全部发完（不再有「掷满 10 轮」）
    expect(endText).toContain('普通奖全部博完');
    expect(endText).not.toContain('掷满');
    // 每位玩家都有战果卡片
    expect(container.querySelectorAll('.tally-card')).toHaveLength(6);
    // 首掷即博出状元插金花 → 必然加冕而非空缺
    expect(container.querySelector('.crowning__crown')).not.toBeNull();
    expect(endText).toContain('状元插金花');
    // 重新开始按钮存在
    expect(container.querySelector('.end-actions')).not.toBeNull();
  });

  it('可以从结算界面重新开始回到开始界面', () => {
    renderApp(diceSequenceRandom(winningSequence()));
    click('.start-card__start');

    expect(rollUntilEnd()).toBe(FULL_GAME_ROLLS);
    expect(container.querySelector('.screen--end')).not.toBeNull();

    const restart = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === '重新开始',
    );
    expect(restart).toBeTruthy();
    act(() => {
      restart!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('.screen--start')).not.toBeNull();
    expect(text()).toContain('闽南中秋博饼');
  });

  it('音效开关可切换且状态落到界面上', () => {
    renderApp();
    expect(text()).toContain('音效开');

    click('.sound-toggle');
    expect(text()).toContain('音效关');

    click('.sound-toggle');
    expect(text()).toContain('音效开');
  });

  it('游戏界面「重新开始」需二次确认', () => {
    renderApp();
    click('.start-card__start');
    expect(container.querySelectorAll('.player-chip')).toHaveLength(6);

    // 顶栏「重新开始」按钮
    const headerBtn = Array.from(container.querySelectorAll('.game-header button')).find(
      (b) => b.textContent === '重新开始',
    );
    act(() => {
      headerBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // 弹出确认框，此时仍在游戏中
    expect(container.querySelector('.modal')).not.toBeNull();
    expect(container.querySelector('.screen--game')).not.toBeNull();

    // 点「继续这局」关闭弹窗
    const keep = Array.from(container.querySelectorAll('.modal button')).find(
      (b) => b.textContent === '继续这局',
    );
    act(() => {
      keep!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('.modal')).toBeNull();
    expect(container.querySelector('.screen--game')).not.toBeNull();
  });

  it('状元争：开始界面可切换玩法，规则速览随之切换', () => {
    renderApp();

    // 默认经典：规则速览列出全部 12 级奖项
    click('.rules-toggle');
    expect(container.querySelectorAll('.rules-table li')).toHaveLength(12);

    pickMode('状元争');
    expect(container.querySelector('.mode-card.is-active')?.textContent).toContain('状元争');

    // 状元争：只剩 7 级判定，且带命中率
    const labels = Array.from(
      container.querySelectorAll('.rules-table--duel .rules-table__label'),
    ).map((el) => el.textContent);
    expect(labels).toEqual(['状元插金花', '六杯红', '遍地锦', '六勃黑', '五王', '五子', '四红']);
    expect(container.querySelector('.rules-panel')?.textContent).toContain('1.2024%');

    // 切回经典，回归 12 级
    pickMode('经典博饼');
    expect(container.querySelectorAll('.rules-table--duel')).toHaveLength(0);
    expect(container.querySelectorAll('.rules-table li')).toHaveLength(12);
  });

  it('状元争：注入确定性序列跑完整局，结算出现擂主与最佳成绩榜', () => {
    renderApp(diceSequenceRandom(duelSequence()));
    pickMode('状元争');
    setCountTo(4);
    click('.start-card__start');

    // 游戏界面：模式徽章、擂主榜取代奖池、按钮为「博一次」
    const badge = container.querySelector('.round-badge')?.textContent ?? '';
    expect(badge).toContain('状元争');
    expect(badge).not.toContain('轮');
    expect(container.querySelector('.leaderboard')).not.toBeNull();
    expect(container.querySelector('.prize-pool')).toBeNull();
    expect(container.querySelector('.btn--roll')?.textContent).toContain('博一次');
    expect(container.querySelector('.speed-control')).not.toBeNull();
    expect(text()).toContain('本圈还剩 4 人待博');
    // 开局无历史，擂主席虚位以待
    expect(text()).toContain('擂主虚位以待');

    // 回合 1：玩家1 连掷 2 次博出五子 → 成为擂主
    playDuelTurn();
    expect(container.querySelector('.result-panel__prize')?.textContent).toContain('五子');
    expect(text()).toContain('坐上擂主位');
    expect(container.querySelector('.next-turn')?.textContent).toContain('玩家2');
    expect(container.querySelectorAll('.history__row')).toHaveLength(1);
    expect(container.querySelector('.history__row')?.textContent).toContain('连掷 2 次');
    expect(container.querySelector('.history__row')?.textContent).toContain('成为擂主');
    expect(container.querySelector('.leader-row.is-zhuangyuan')?.textContent).toContain('守擂中');
    expect(text()).toContain('本圈还剩 3 人待博');

    // 剩下三个回合全部未超过擂主 → 本圈无人抢位，收官
    playDuelTurn();
    expect(container.querySelector('.history__row')?.textContent).toContain('未超过擂主');
    playDuelTurn();
    playDuelTurn();

    expect(container.querySelector('.screen--end'), '应进入结算界面').not.toBeNull();
    const endText = text();
    expect(endText).toContain('本轮擂主 · 加冕');
    expect(endText).toContain('本圈无人抢位，状元定格');
    expect(endText).toContain('玩家1');
    expect(endText).toContain('五子');
    // 四位玩家都有战果卡片，且累计连掷数反查得到
    expect(container.querySelectorAll('.tally-card')).toHaveLength(4);
    expect(container.querySelectorAll('.tally-card.is-zhuangyuan')).toHaveLength(1);
    expect(endText).toContain('累计连掷 2 次');
    expect(container.querySelector('.end-actions')).not.toBeNull();
  });

  it('状元争：过程阶段显示连掷计数，可切到「直接看结果」', () => {
    renderApp(diceSequenceRandom(duelSequence()));
    pickMode('状元争');
    setCountTo(4);
    click('.start-card__start');

    // 默认 ×1：点下「博一次」先进入过程阶段，计数条出现
    expect(container.querySelector('.speed-control__btn.is-active')?.textContent).toBe('×1');
    click('.btn--roll');
    tick(20);
    expect(container.querySelector('.reroll-counter')).not.toBeNull();
    expect(text()).toContain('连掷中');
    tick(TURN_TICKS);
    expect(text()).toContain('坐上擂主位');

    // 切到「直接看结果」：之后每回合不播过程阶段
    const instant = Array.from(container.querySelectorAll('.speed-control__btn')).find(
      (b) => b.textContent === '直接看结果',
    );
    expect(instant).toBeTruthy();
    act(() => {
      instant!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('.speed-control__btn.is-active')?.textContent).toBe('直接看结果');

    playDuelTurn();
    expect(container.querySelector('.reroll-counter')).toBeNull();
    expect(container.querySelector('.history__row')?.textContent).toContain('未超过擂主');
    playDuelTurn();
    playDuelTurn();

    expect(container.querySelector('.screen--end')).not.toBeNull();
  });

  it('全流程未产生 React 运行时错误', () => {
    renderApp();
    click('.start-card__start');
    for (let i = 0; i < 5; i += 1) {
      click('.btn--roll');
      tick(ROLL_TICKS);
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
