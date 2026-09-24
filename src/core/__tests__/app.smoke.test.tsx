// @vitest-environment jsdom
/**
 * 应用渲染冒烟测试 —— 验证三阶段界面能真实挂载、交互不报错。
 *
 * 覆盖：
 *   1. 开始界面渲染（标题、默认玩家人数、姓名输入框）
 *   2. 调整人数后开始博饼，进入游戏界面（玩家高亮、奖池、掷骰按钮）
 *   3. 掷骰 → 动画结束 → 结果与历史记录写入
 *   4. 一直博到结束 → 结算界面正常渲染
 *   5. 全流程不产生 React 运行时错误
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';

let container: HTMLDivElement;
let root: Root;
let errorSpy: ReturnType<typeof vi.spyOn>;

/** 掷骰动画时长 + 余量 */
const ROLL_TICKS = 1500;

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

function renderApp() {
  act(() => {
    root.render(createElement(App));
  });
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

  it('连续掷骰会把记录累积到历史，并在结束后进入结算界面', () => {
    renderApp();
    click('.start-card__start');

    // 6 位玩家 × 10 轮 = 最多 60 掷；奖池发完会更早结束
    let rolls = 0;
    while (container.querySelector('.btn--roll') && rolls < 70) {
      const button = container.querySelector<HTMLButtonElement>('.btn--roll');
      if (button?.disabled) break;
      click('.btn--roll');
      tick(ROLL_TICKS + 3200); // 覆盖动画 + 自动跳转结算的延迟
      rolls += 1;
      if (container.querySelector('.screen--end')) break;
    }

    expect(rolls).toBeGreaterThan(0);
    expect(container.querySelector('.screen--end'), '应进入结算界面').not.toBeNull();

    const endText = text();
    expect(endText).toContain('团圆战果');
    // 必然结束：要么掷满 10 轮，要么普通奖发完
    expect(endText.includes('掷满 10 轮') || endText.includes('普通奖全部博完')).toBe(true);
    // 每位玩家都有战果卡片
    expect(container.querySelectorAll('.tally-card')).toHaveLength(6);
    // 状元要么加冕，要么明确显示空缺
    expect(
      endText.includes('状元空缺') || container.querySelector('.crowning__crown') !== null,
    ).toBe(true);
    // 重新开始按钮存在
    expect(container.querySelector('.end-actions')).not.toBeNull();
  });

  it('可以从结算界面重新开始回到开始界面', () => {
    renderApp();
    click('.start-card__start');

    let rolls = 0;
    while (rolls < 70 && !container.querySelector('.screen--end')) {
      const button = container.querySelector<HTMLButtonElement>('.btn--roll');
      if (!button || button.disabled) break;
      click('.btn--roll');
      tick(ROLL_TICKS + 3200);
      rolls += 1;
    }
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
