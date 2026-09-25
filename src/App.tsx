/**
 * 闽南中秋博饼模拟器 —— 应用入口，负责三阶段（开始 / 游戏 / 结算）编排
 */
import { useCallback, useEffect, useState } from 'react';
import { createGame, type GameState, type RollOutcome, type TurnOutcome } from './core/engine';
import type { GameMode } from './core/types';
import { EndScreen } from './components/EndScreen';
import { GameScreen } from './components/GameScreen';
import { Osmanthus } from './components/Decor';
import { StartScreen } from './components/StartScreen';
import type { RandomFn } from './core/random';
import { loadSoundPreference, saveSoundPreference, sound } from './sound';

type Stage = 'start' | 'playing' | 'end';

/** 可选随机源，仅用于测试注入确定性骰子序列；不传即真随机 */
export interface AppProps {
  random?: RandomFn;
}

/** 背景桂花飘落的位置（固定数组，避免每次渲染重新随机） */
const OSMANTHUS = [
  { left: '4%', delay: 0, duration: 15, size: 16 },
  { left: '12%', delay: 3.2, duration: 18, size: 12 },
  { left: '21%', delay: 7.4, duration: 16, size: 18 },
  { left: '29%', delay: 1.6, duration: 20, size: 13 },
  { left: '37%', delay: 9.1, duration: 17, size: 17 },
  { left: '45%', delay: 5.3, duration: 19, size: 12 },
  { left: '53%', delay: 11.8, duration: 15, size: 19 },
  { left: '61%', delay: 2.4, duration: 21, size: 14 },
  { left: '69%', delay: 8.6, duration: 16, size: 16 },
  { left: '77%', delay: 4.5, duration: 18, size: 13 },
  { left: '85%', delay: 12.9, duration: 17, size: 18 },
  { left: '93%', delay: 6.7, duration: 20, size: 12 },
];

export default function App({ random }: AppProps = {}) {
  const [stage, setStage] = useState<Stage>('start');
  const [game, setGame] = useState<GameState | null>(null);
  const [playedNames, setPlayedNames] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadSoundPreference());

  // 音效开关同步到引擎
  useEffect(() => {
    sound.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      saveSoundPreference(next);
      sound.setEnabled(next);
      if (next) {
        sound.unlock();
        sound.play('click');
      }
      return next;
    });
  }, []);

  /** 开始界面 → 游戏界面 */
  const handleStart = useCallback((names: string[], mode: GameMode) => {
    sound.unlock();
    sound.play('click');
    setPlayedNames(names);
    setGame(createGame(names, mode));
    setStage('playing');
  }, []);

  /** 掷骰动画结束后提交状态（经典模式为单掷，状元争为一个完整回合） */
  const handleCommit = useCallback((next: GameState, _outcome: RollOutcome | TurnOutcome) => {
    setGame(next);
  }, []);

  /** 游戏结束 → 结算界面 */
  const handleFinish = useCallback((next: GameState) => {
    setGame(next);
    setStage((prev) => (prev === 'end' ? prev : 'end'));
  }, []);

  /** 退出并重开（游戏界面二次确认后） */
  const handleExit = useCallback(() => {
    setGame(null);
    setStage('start');
  }, []);

  /** 结算 → 开始界面 */
  const handleRestart = useCallback(() => {
    sound.play('click');
    setGame(null);
    setStage('start');
  }, []);

  /** 结算 → 沿用相同玩家与玩法再来一局 */
  const handlePlayAgain = useCallback(() => {
    const names = playedNames.length > 0 ? playedNames : (game?.players.map((p) => p.name) ?? []);
    sound.unlock();
    sound.play('click');
    setGame(createGame(names, game?.mode ?? 'classic'));
    setStage('playing');
  }, [playedNames, game]);

  return (
    <div className="app">
      {/* ── 全局背景：暖色夜空 + 飘落桂花 ───────────── */}
      <div className="app-bg" aria-hidden="true">
        <span className="app-bg__glow" />
        <span className="app-bg__hills" />
      </div>
      <div className="osmanthus-layer" aria-hidden="true">
        {OSMANTHUS.map((item, i) => (
          <span
            key={i}
            className="osmanthus-fall"
            style={{
              left: item.left,
              animationDelay: `${item.delay}s`,
              animationDuration: `${item.duration}s`,
            }}
          >
            <Osmanthus size={item.size} />
          </span>
        ))}
      </div>

      {stage === 'start' && (
        <StartScreen soundEnabled={soundEnabled} onToggleSound={toggleSound} onStart={handleStart} />
      )}

      {stage === 'playing' && game && (
        <GameScreen
          state={game}
          onCommit={handleCommit}
          onFinish={handleFinish}
          onExit={handleExit}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          random={random}
        />
      )}

      {stage === 'end' && game && (
        <EndScreen
          state={game}
          onRestart={handleRestart}
          onPlayAgain={handlePlayAgain}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
        />
      )}
    </div>
  );
}
