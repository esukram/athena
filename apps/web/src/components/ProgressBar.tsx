import { useTranslation } from 'react-i18next';

export interface ProgressBarProps {
  /** Current position (1-indexed for display, but 0-indexed internally) */
  current: number;
  /** Total number of items */
  total: number;
}

/**
 * A slim accent progress bar showing current/total progress.
 * Includes ARIA attributes for accessibility.
 */
export const ProgressBar = ({ current, total }: ProgressBarProps) => {
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
      className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
    >
      <div
        className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
        style={{ width: `${percent}%` }}
        data-testid="progress-bar-fill"
      />
    </div>
  );
};
