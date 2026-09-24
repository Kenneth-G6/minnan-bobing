/**
 * 音效引擎 —— 使用 WebAudio 程序化合成，零音频文件、零网络请求。
 *
 * 全部音效在本地实时合成（掷骰碰撞、中奖铃声、状元锣声），
 * 因此断网、双击打开都能正常发声，也不存在素材授权问题。
 *
 * 所有发声都受 enabled 开关控制；浏览器要求用户交互后才能播放，
 * 首次点击「开始博饼」时会自动解锁 AudioContext。
 */

export type SoundName =
  | 'roll' // 掷骰：骰子落入碗中的连续碰撞声
  | 'award' // 中奖：清亮铃声
  | 'zhuangyuan' // 状元：锣声 + 上行音阶
  | 'full' // 奖项已满：低沉落空声
  | 'click' // 按钮点击
  | 'fanfare'; // 结算加冕：欢庆音阶

class SoundEngine {
  private ctx: AudioContext | null = null;

  private master: GainNode | null = null;

  private enabled = true;

  /** 获取或创建 AudioContext（惰性创建，避免自动播放策略告警） */
  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.42;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** 用户首次交互时调用，解锁音频 */
  unlock(): void {
    this.ensureContext();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** 生成白噪声缓冲，用于骰子碰撞声 */
  private createNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** 单次敲击：带通滤波的白噪声 + 指数衰减 */
  private clack(ctx: AudioContext, at: number, volume: number, freq: number, duration = 0.07): void {
    const source = ctx.createBufferSource();
    source.buffer = this.createNoise(ctx, duration + 0.02);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  /** 单音：正弦/三角波 + 指数衰减 */
  private tone(
    ctx: AudioContext,
    at: number,
    freq: number,
    volume: number,
    duration: number,
    type: OscillatorType = 'sine',
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  /** 掷骰：6 颗骰子依次落入碗中，连续碰撞后逐渐落定 */
  private playRoll(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const hits = 14;
    let t = now;
    for (let i = 0; i < hits; i += 1) {
      // 间隔先疏后密，营造「依次落入」的节奏
      const gap = i < 6 ? 0.075 : 0.045 + Math.random() * 0.04;
      t += gap;
      const volume = 0.32 * (1 - i / hits / 1.6);
      this.clack(ctx, t, volume, 1500 + Math.random() * 2200, 0.06 + Math.random() * 0.03);
    }
    // 收尾低沉稳响
    this.tone(ctx, t + 0.06, 180, 0.16, 0.16, 'triangle');
  }

  /** 中奖：清脆的双音铃声 */
  private playAward(ctx: AudioContext): void {
    const now = ctx.currentTime;
    this.tone(ctx, now, 880, 0.24, 0.5);
    this.tone(ctx, now + 0.09, 1318.5, 0.2, 0.55);
    this.tone(ctx, now + 0.18, 1760, 0.14, 0.6);
  }

  /** 状元：锣声 + 上行五声音阶 */
  private playZhuangyuan(ctx: AudioContext): void {
    const now = ctx.currentTime;

    // 锣：低频正弦 + 慢衰减
    this.tone(ctx, now, 98, 0.3, 1.5, 'sine');
    this.tone(ctx, now, 147, 0.18, 1.3, 'triangle');
    // 金属泛音
    this.clack(ctx, now, 0.22, 3200, 0.9);

    // 上行五声音阶（宫商角徵羽）
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    scale.forEach((freq, i) => {
      this.tone(ctx, now + 0.24 + i * 0.085, freq, 0.16, 0.45);
    });
  }

  /** 奖项已满：低沉落空 */
  private playFull(ctx: AudioContext): void {
    const now = ctx.currentTime;
    this.tone(ctx, now, 300, 0.18, 0.22, 'triangle');
    this.tone(ctx, now + 0.1, 210, 0.16, 0.32, 'triangle');
  }

  /** 按钮点击 */
  private playClick(ctx: AudioContext): void {
    const now = ctx.currentTime;
    this.tone(ctx, now, 660, 0.1, 0.09, 'triangle');
  }

  /** 结算加冕：欢庆上行音阶 */
  private playFanfare(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      this.tone(ctx, now + i * 0.12, freq, 0.18, 0.6);
      this.tone(ctx, now + i * 0.12, freq * 2, 0.06, 0.5);
    });
  }

  /** 播放指定音效 */
  play(name: SoundName): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    try {
      switch (name) {
        case 'roll':
          this.playRoll(ctx);
          break;
        case 'award':
          this.playAward(ctx);
          break;
        case 'zhuangyuan':
          this.playZhuangyuan(ctx);
          break;
        case 'full':
          this.playFull(ctx);
          break;
        case 'click':
          this.playClick(ctx);
          break;
        case 'fanfare':
          this.playFanfare(ctx);
          break;
        default:
          break;
      }
    } catch {
      // 音频失败不应影响游戏进行
    }
  }
}

export const sound = new SoundEngine();

const STORAGE_KEY = 'bobing:sound-enabled';

/** 读取音效开关偏好（默认开启） */
export function loadSoundPreference(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

/** 持久化音效开关偏好 */
export function saveSoundPreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
}
