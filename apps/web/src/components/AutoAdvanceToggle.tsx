import { useTranslation } from 'react-i18next';

interface AutoAdvanceToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Checkbox that controls whether voice playback in Learn mode continues into the
 * next chapter automatically once the current chapter finishes. The preference
 * is persisted by the parent — this component is purely presentational.
 */
export const AutoAdvanceToggle = ({
  checked,
  onChange,
}: AutoAdvanceToggleProps) => {
  const { t } = useTranslation();
  const label = t('speech.autoAdvance');

  return (
    <label
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full bg-surface text-on-surface-variant cursor-pointer transition-colors hover:bg-primary-50"
      title={label}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary-600 cursor-pointer"
      />
      <span className="whitespace-nowrap">{label}</span>
    </label>
  );
};
