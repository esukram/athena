import { useTranslation } from 'react-i18next';

export interface ProgressBarProps {
  /** Current position (1-indexed for display, but 0-indexed internally) */
  current: number;
  /** Total number of items */
  total: number;
  /** If true, removes rounded corners for flush positioning at top of cards */
  flush?: boolean;
}

/**
 * A green progress bar showing current/total progress with percentage.
 * Includes ARIA attributes for accessibility.
 */
export const ProgressBar = ({
  current,
  total,
  flush = false,
}: ProgressBarProps) => {
  const { t } = useTranslation();

  // Clamp percentage between 0% and 100%
  const percent =
    total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  const roundedPercent = Math.round(percent);

  const label = t('lectureTrain.progressLabel', {
    current,
    total,
    percent: roundedPercent,
  });

  return (
    <div
      className="w-full"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
    >
      <div
        className={`w-full h-2 bg-surface-2 overflow-hidden ${flush ? '' : 'rounded-full'}`}
      >
        <div
          className="h-full bg-success transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
          data-testid="progress-bar-fill"
        />
      </div>
      <div
        className={`text-xs text-success font-bold mt-1 ${flush ? 'px-8' : ''}`}
        data-testid="progress-bar-percent"
      >
        {roundedPercent}%
      </div>
    </div>
  );
};
