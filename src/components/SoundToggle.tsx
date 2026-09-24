/**
 * 音效开关 —— 默认开启，偏好写入 localStorage
 */
export interface SoundToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <button
      type="button"
      className={`sound-toggle${enabled ? ' is-on' : ' is-off'}`}
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? '音效已开启，点击关闭' : '音效已关闭，点击开启'}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none">
        <path
          d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"
          fill="currentColor"
        />
        {enabled ? (
          <>
            <path d="M15.4 8.6a4.6 4.6 0 0 1 0 6.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M18.2 5.6a8.4 8.4 0 0 1 0 12.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.72" />
          </>
        ) : (
          <path d="M16 9.4l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        )}
      </svg>
      <span className="sound-toggle__text">{enabled ? '音效开' : '音效关'}</span>
    </button>
  );
}

export default SoundToggle;
