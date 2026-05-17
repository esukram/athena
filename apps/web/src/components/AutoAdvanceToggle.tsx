import { ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AutoAdvanceToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Compact icon toggle controlling whether voice playback in Learn mode continues
 * into the next chapter automatically once the current chapter finishes. Renders
 * icon-only by default and expands to reveal its label on hover or keyboard
 * focus. The preference is persisted by the parent — this component is purely
 * presentational.
 */
export const AutoAdvanceToggle = ({
  checked,
  onChange,
}: AutoAdvanceToggleProps) => {
  const { t } = useTranslation();
  const fullLabel = t('speech.autoAdvance');
  const shortLabel = t('speech.autoAdvanceShort');

  return (
    <label
      className={`group relative flex items-center px-3 py-1.5 text-sm font-medium rounded-full cursor-pointer transition-all
        ${
          checked
            ? 'bg-primary-100 text-primary-700'
            : 'bg-surface text-on-surface-variant hover:bg-primary-50'
        }`}
      title={fullLabel}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={fullLabel}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <ChevronsRight size={18} aria-hidden="true" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all group-hover:ml-2 group-hover:max-w-[12rem] group-hover:opacity-100 peer-focus-visible:ml-2 peer-focus-visible:max-w-[12rem] peer-focus-visible:opacity-100">
        {shortLabel}
      </span>
    </label>
  );
};
