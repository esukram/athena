import { ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { IconButton } from './buttons/IconButton';

interface AutoAdvanceToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Toggle controlling whether voice playback in Learn mode continues into the
 * next chapter automatically once the current chapter finishes. Renders as a
 * circular icon button consistent with the other header controls; the enabled
 * state is conveyed via `aria-pressed` and a primary tint. The preference is
 * persisted by the parent — this component is purely presentational.
 */
export const AutoAdvanceToggle = ({
  checked,
  onChange,
}: AutoAdvanceToggleProps) => {
  const { t } = useTranslation();
  const label = t('speech.autoAdvance');

  return (
    <IconButton
      icon={ChevronsRight}
      onClick={() => onChange(!checked)}
      aria-label={label}
      title={label}
      aria-pressed={checked}
      className={checked ? '!bg-primary-100' : ''}
      iconClassName={checked ? '!text-primary-700' : ''}
    />
  );
};
