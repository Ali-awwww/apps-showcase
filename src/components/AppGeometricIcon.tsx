import { AppIconId } from '../types/app';

interface AppGeometricIconProps {
  iconId: AppIconId;
  size?: 'sm' | 'md' | 'lg';
}

export function AppGeometricIcon({
  iconId,
  size = 'md',
}: AppGeometricIconProps) {
  const sizeClasses =
    size === 'lg'
      ? 'w-16 h-16'
      : size === 'sm'
      ? 'w-10 h-10'
      : 'w-12 h-12';

  const renderSymbol = () => {
    switch (iconId) {
      case 'muslim-assistant':
        return (
          <>
            <polygon
              points="24,5 39,14 39,34 24,43 9,34 9,14"
              fill="rgba(0, 180, 255, 0.08)"
              stroke="#38bdf8"
              strokeWidth="1.6"
            />
            <rect
              x="14.5"
              y="14.5"
              width="19"
              height="19"
              transform="rotate(45 24 24)"
              fill="none"
              stroke="#00b4ff"
              strokeWidth="1.4"
              strokeOpacity="0.65"
            />
            <path
              d="M26.5 16.5a8.2 8.2 0 1 0 5 14.5 7 7 0 0 1-5-14.5Z"
              fill="#38bdf8"
            />
          </>
        );

      case 'phone-agent':
        return (
          <>
            <rect
              x="14"
              y="7"
              width="20"
              height="34"
              rx="3"
              fill="rgba(0, 180, 255, 0.08)"
              stroke="#38bdf8"
              strokeWidth="1.6"
            />
            <line
              x1="20"
              y1="11"
              x2="28"
              y2="11"
              stroke="#00b4ff"
              strokeWidth="1.5"
            />
            <polygon
              points="24,17 30,22 24,27 18,22"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            <circle cx="24" cy="22" r="2" fill="#00b4ff" />
            <line
              x1="21"
              y1="35"
              x2="27"
              y2="35"
              stroke="#38bdf8"
              strokeWidth="1.8"
            />
          </>
        );

      case 'abu-jrin-market':
        return (
          <>
            <polygon
              points="10,16 24,8 38,16 38,34 24,40 10,34"
              fill="rgba(0, 180, 255, 0.08)"
              stroke="#38bdf8"
              strokeWidth="1.6"
            />
            <polyline
              points="10,16 24,24 38,16"
              fill="none"
              stroke="#00b4ff"
              strokeWidth="1.5"
            />
            <line
              x1="24"
              y1="24"
              x2="24"
              y2="40"
              stroke="#00b4ff"
              strokeWidth="1.5"
            />
            <polyline
              points="17,12 31,20 31,28"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeOpacity="0.65"
            />
          </>
        );

      case '-Vibe-coding':
        return (
          <>
            <polygon
              points="8,12 24,6 40,12 40,36 24,42 8,36"
              fill="rgba(0, 180, 255, 0.08)"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            <polyline
              points="18,19 13,24 18,29"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="square"
            />
            <polyline
              points="30,19 35,24 30,29"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="square"
            />
            <line
              x1="26"
              y1="17"
              x2="22"
              y2="31"
              stroke="#00b4ff"
              strokeWidth="1.8"
            />
          </>
        );

      case '-AW':
        return (
          <>
            <polygon
              points="24,6 40,15 40,33 24,42 8,33 8,15"
              fill="rgba(0, 180, 255, 0.08)"
              stroke="#38bdf8"
              strokeWidth="1.6"
            />
            <polyline
              points="13,30 18,17 23,30"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.8"
              strokeLinejoin="miter"
            />
            <line
              x1="15"
              y1="26"
              x2="21"
              y2="26"
              stroke="#00b4ff"
              strokeWidth="1.5"
            />
            <polyline
              points="24,18 27,30 30,22 33,30 36,18"
              fill="none"
              stroke="#00b4ff"
              strokeWidth="1.8"
              strokeLinejoin="miter"
            />
          </>
        );

      case 'adhan-reminder':
        return (
          <>
            <circle
              cx="24"
              cy="24"
              r="16"
              fill="rgba(0, 180, 255, 0.06)"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <path
              d="M24 10c-5 4.2-7 8.4-7 13v7h14v-7c0-4.6-2-8.8-7-13Z"
              fill="rgba(0, 180, 255, 0.14)"
              stroke="#38bdf8"
              strokeWidth="1.6"
            />
            <line
              x1="24"
              y1="6"
              x2="24"
              y2="10"
              stroke="#00b4ff"
              strokeWidth="1.6"
            />
            <line
              x1="13"
              y1="34"
              x2="35"
              y2="34"
              stroke="#38bdf8"
              strokeWidth="1.6"
            />
            <circle cx="24" cy="23" r="2.2" fill="#00b4ff" />
          </>
        );
    }
  };

  return (
    <div
      className={`${sizeClasses} shrink-0 relative flex items-center justify-center bg-[#061229] border border-sky-400/30 rounded-lg shadow-[0_0_16px_-6px_rgba(0,180,255,0.45)]`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        className="w-4/5 h-4/5"
        xmlns="http://www.w3.org/2000/svg"
      >
        {renderSymbol()}
      </svg>
    </div>
  );
}
