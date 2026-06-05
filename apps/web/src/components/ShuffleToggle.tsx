import { Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ShuffleToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Toggle switching the training session between sequential and randomized
 * (shuffled) order. Renders as a pill-shaped switch consistent with the Dusk
 * design language; the enabled state is conveyed via `aria-pressed`, an accent
 * tint, and a sliding knob. The mode change itself is handled by the parent.
 */
export const ShuffleToggle = ({ checked, onChange }: ShuffleToggleProps) => {
  const { t } = useTranslation();
  const label = t('lectureTrain.shuffle');

  return (
    <button
      type="button"
      aria-pressed={checked}
      title={label}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ' +
        (checked ? 'text-accent-soft-ink' : 'text-ink-soft hover:text-ink')
      }
    >
      <span
        className={
          'relative h-[19px] w-[34px] shrink-0 rounded-full transition-colors ' +
          (checked ? 'bg-accent' : 'bg-border')
        }
      >
        <span
          className={
            'absolute top-0.5 left-0.5 h-[15px] w-[15px] rounded-full bg-surface transition-transform ' +
            (checked ? 'translate-x-[15px]' : '')
          }
        />
      </span>
      <Shuffle size={15} className="shrink-0" />
      {label}
    </button>
  );
};
