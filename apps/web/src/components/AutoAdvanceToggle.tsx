import { useTranslation } from 'react-i18next';

interface AutoAdvanceToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Toggle controlling whether voice playback in Learn mode continues into the
 * next chapter automatically once the current chapter finishes. Renders as a
 * pill-shaped switch consistent with the Dusk design language; the enabled
 * state is conveyed via `aria-pressed`, an accent tint, and a sliding knob. The
 * preference is persisted by the parent — this component is purely
 * presentational.
 */
export const AutoAdvanceToggle = ({
  checked,
  onChange,
}: AutoAdvanceToggleProps) => {
  const { t } = useTranslation();
  const label = t('speech.autoAdvance');

  return (
    <button
      type="button"
      aria-pressed={checked}
      title={label}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-all ' +
        (checked
          ? 'border-transparent bg-accent-soft text-accent-soft-ink'
          : 'border-border bg-surface text-ink-soft')
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
      {label}
    </button>
  );
};
