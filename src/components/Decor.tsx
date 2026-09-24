/**
 * 中秋装饰图形 —— 全部手绘内联 SVG。
 * 统一暖金色调，不含任何外部图片依赖。
 */

/** 圆月：暖金满月 + 柔光 */
export function Moon({ size = 120 }: { size?: number }) {
  return (
    <svg className="decor decor--moon" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#ffe9a8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd97a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonBody" cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#fffdf0" />
          <stop offset="55%" stopColor="#ffeeb5" />
          <stop offset="100%" stopColor="#f8d27a" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#moonGlow)" />
      <circle cx="60" cy="60" r="38" fill="url(#moonBody)" />
      {/* 环形山 */}
      <circle cx="48" cy="48" r="7" fill="#f0c86a" opacity="0.55" />
      <circle cx="72" cy="62" r="5" fill="#f0c86a" opacity="0.45" />
      <circle cx="56" cy="74" r="4" fill="#f0c86a" opacity="0.4" />
      <circle cx="70" cy="42" r="3" fill="#f0c86a" opacity="0.35" />
    </svg>
  );
}

/** 玉兔：捧月饼的可爱兔子 */
export function Rabbit({ size = 130 }: { size?: number }) {
  return (
    <svg className="decor decor--rabbit" width={size} height={size * 1.15} viewBox="0 0 110 126" aria-hidden="true">
      <defs>
        <linearGradient id="rabbitBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3e6f6" />
        </linearGradient>
      </defs>

      {/* 耳朵 */}
      <ellipse cx="38" cy="24" rx="9" ry="22" fill="url(#rabbitBody)" transform="rotate(-12 38 24)" />
      <ellipse cx="38" cy="26" rx="4.5" ry="15" fill="#ffc0cf" transform="rotate(-12 38 26)" />
      <ellipse cx="64" cy="22" rx="9" ry="22" fill="url(#rabbitBody)" transform="rotate(10 64 22)" />
      <ellipse cx="64" cy="24" rx="4.5" ry="15" fill="#ffc0cf" transform="rotate(10 64 24)" />

      {/* 身体 */}
      <ellipse cx="52" cy="98" rx="26" ry="24" fill="url(#rabbitBody)" />

      {/* 头 */}
      <circle cx="52" cy="58" r="27" fill="url(#rabbitBody)" />

      {/* 腮红 */}
      <circle cx="35" cy="66" r="6" fill="#ffb3c4" opacity="0.75" />
      <circle cx="69" cy="66" r="6" fill="#ffb3c4" opacity="0.75" />

      {/* 眼睛 */}
      <circle cx="42" cy="55" r="3.6" fill="#4a3226" />
      <circle cx="62" cy="55" r="3.6" fill="#4a3226" />
      <circle cx="43.4" cy="53.6" r="1.2" fill="#ffffff" />
      <circle cx="63.4" cy="53.6" r="1.2" fill="#ffffff" />

      {/* 鼻子与嘴 */}
      <ellipse cx="52" cy="64" rx="3" ry="2.2" fill="#ff9db4" />
      <path d="M52 66.5 Q52 70 48.5 70.5 M52 66.5 Q52 70 55.5 70.5" stroke="#c98b9c" strokeWidth="1.4" fill="none" strokeLinecap="round" />

      {/* 捧着的月饼 */}
      <circle cx="52" cy="92" r="13" fill="#f0b25a" />
      <circle cx="52" cy="92" r="13" fill="none" stroke="#d9913a" strokeWidth="1.6" />
      <circle cx="52" cy="92" r="8.4" fill="none" stroke="#d9913a" strokeWidth="1.2" opacity="0.85" />
      <path d="M52 84.5 L52 99.5 M44.5 92 L59.5 92" stroke="#d9913a" strokeWidth="1.1" opacity="0.7" />
      <circle cx="52" cy="92" r="2.6" fill="#e4573d" />
    </svg>
  );
}

/** 红灯笼 */
export function Lantern({ size = 56 }: { size?: number }) {
  return (
    <svg className="decor decor--lantern" width={size} height={size * 1.6} viewBox="0 0 56 90" aria-hidden="true">
      <defs>
        <radialGradient id="lanternBody" cx="34%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ff7a5c" />
          <stop offset="55%" stopColor="#e8452b" />
          <stop offset="100%" stopColor="#b8291a" />
        </radialGradient>
      </defs>
      {/* 吊绳 */}
      <path d="M28 0 L28 12" stroke="#c8901f" strokeWidth="2" strokeLinecap="round" />
      {/* 灯身 */}
      <ellipse cx="28" cy="40" rx="20" ry="25" fill="url(#lanternBody)" />
      {/* 灯骨 */}
      <path d="M12 40 Q28 30 44 40" stroke="#ffd77a" strokeWidth="1.2" fill="none" opacity="0.55" />
      <path d="M12 40 Q28 50 44 40" stroke="#ffd77a" strokeWidth="1.2" fill="none" opacity="0.55" />
      <path d="M20 19 Q24 40 20 61 M28 15 Q28 40 28 65 M36 19 Q32 40 36 61" stroke="#ffd77a" strokeWidth="1.1" fill="none" opacity="0.4" />
      {/* 上下金盖 */}
      <rect x="17" y="12" width="22" height="7" rx="2.5" fill="#f2c14e" />
      <rect x="17" y="61" width="22" height="7" rx="2.5" fill="#f2c14e" />
      {/* 流苏 */}
      <path d="M28 68 L28 82" stroke="#f2c14e" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M25 82 L28 90 L31 82 Z" fill="#f2c14e" />
    </svg>
  );
}

/** 桂花：四瓣小花 */
export function Osmanthus({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="#f6c453">
        <ellipse cx="12" cy="6" rx="3.6" ry="4.6" />
        <ellipse cx="18" cy="12" rx="4.6" ry="3.6" />
        <ellipse cx="12" cy="18" rx="3.6" ry="4.6" />
        <ellipse cx="6" cy="12" rx="4.6" ry="3.6" />
      </g>
      <circle cx="12" cy="12" r="2.6" fill="#e08c2c" />
    </svg>
  );
}

/** 月饼 */
export function Mooncake({ size = 26, dim = false }: { size?: number; dim?: boolean }) {
  return (
    <svg className="decor decor--mooncake" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="mooncakeBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dim ? '#e8d8bd' : '#f6c579'} />
          <stop offset="100%" stopColor={dim ? '#d3c1a3' : '#dc9c3f'} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#mooncakeBody)" stroke={dim ? '#bda98a' : '#c98428'} strokeWidth="1.6" />
      <circle cx="20" cy="20" r="12" fill="none" stroke={dim ? '#c4b193' : '#c98428'} strokeWidth="1.2" opacity="0.8" />
      <path
        d="M20 10 L20 30 M10 20 L30 20 M13 13 L27 27 M27 13 L13 27"
        stroke={dim ? '#c4b193' : '#c98428'}
        strokeWidth="1.1"
        opacity="0.55"
      />
      <circle cx="20" cy="20" r="3.4" fill={dim ? '#c4b193' : '#e4573d'} />
    </svg>
  );
}

/** 云纹 */
export function Cloud({ width = 120, className = '' }: { width?: number; className?: string }) {
  return (
    <svg className={className} width={width} height={width * 0.42} viewBox="0 0 120 50" aria-hidden="true">
      <path
        d="M14 40 Q2 40 4 30 Q6 21 18 23 Q20 10 34 12 Q42 2 56 8 Q68 0 80 10 Q94 6 99 18 Q114 18 114 29 Q114 40 100 40 Z"
        fill="#fff4dd"
        opacity="0.62"
      />
    </svg>
  );
}

/** 皇冠（状元） */
export function Crown({ size = 46, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size * 0.8} viewBox="0 0 50 40" aria-hidden="true">
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a0" />
          <stop offset="45%" stopColor="#f5c542" />
          <stop offset="100%" stopColor="#d39218" />
        </linearGradient>
      </defs>
      <path d="M4 32 L7 12 L17 22 L25 6 L33 22 L43 12 L46 32 Z" fill="url(#crownGold)" stroke="#c07f14" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="4" y="31" width="42" height="7" rx="3" fill="#efb52f" stroke="#c07f14" strokeWidth="1.2" />
      <circle cx="25" cy="6" r="3.4" fill="#e4573d" stroke="#b8291a" strokeWidth="1" />
      <circle cx="7" cy="12" r="2.4" fill="#e4573d" />
      <circle cx="43" cy="12" r="2.4" fill="#e4573d" />
      <circle cx="25" cy="34.5" r="2.4" fill="#e4573d" />
    </svg>
  );
}

/** 红花（状元标记） */
export function RedFlower({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g fill="#e8452b">
        <ellipse cx="16" cy="7" rx="6" ry="7" />
        <ellipse cx="25" cy="16" rx="7" ry="6" />
        <ellipse cx="16" cy="25" rx="6" ry="7" />
        <ellipse cx="7" cy="16" rx="7" ry="6" />
      </g>
      <circle cx="16" cy="16" r="5" fill="#ffe07a" stroke="#e0a922" strokeWidth="1.2" />
    </svg>
  );
}

/** 博饼碗（开始页装饰小图） */
export function BowlIcon({ size = 90 }: { size?: number }) {
  return (
    <svg className="decor decor--bowl-icon" width={size} height={size * 0.72} viewBox="0 0 100 72" aria-hidden="true">
      <defs>
        <linearGradient id="bowlIconRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9ad" />
          <stop offset="50%" stopColor="#e8a63f" />
          <stop offset="100%" stopColor="#b96a19" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="30" rx="40" ry="22" fill="url(#bowlIconRim)" />
      <ellipse cx="50" cy="29" rx="33" ry="17" fill="#fdf3e0" />
      <ellipse cx="50" cy="30" rx="27" ry="13" fill="#f4e3c6" />
      {/* 碗中的骰子 */}
      <rect x="38" y="24" width="11" height="11" rx="3" fill="#fffdf8" stroke="#d8c6a6" strokeWidth="1" transform="rotate(-12 43.5 29.5)" />
      <rect x="51" y="26" width="11" height="11" rx="3" fill="#fffdf8" stroke="#d8c6a6" strokeWidth="1" transform="rotate(10 56.5 31.5)" />
      <circle cx="43.5" cy="29.5" r="1.7" fill="#e4573d" />
      <circle cx="56.5" cy="31.5" r="1.6" fill="#5b3a22" />
      {/* 碗身 */}
      <path d="M10 30 Q14 66 50 66 Q86 66 90 30 Z" fill="url(#bowlIconRim)" opacity="0.95" />
      <path d="M10 30 Q14 66 50 66 Q86 66 90 30 Z" fill="none" stroke="#a35c12" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/** 金色小星点（中奖光效点缀） */
export function Sparkle({ x, y, size = 14, delay = 0 }: { x: string; y: string; size?: number; delay?: number }) {
  return (
    <svg
      className="sparkle"
      style={{ left: x, top: y, animationDelay: `${delay}ms`, width: size, height: size }}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 0 L14.4 9.6 L24 12 L14.4 14.4 L12 24 L9.6 14.4 L0 12 L9.6 9.6 Z" fill="#ffd977" />
    </svg>
  );
}
