import { AlertCircle, Loader2, Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { VoicePlaybackStatus } from '../hooks/useChapterVoicePlayback';

interface VoicePlaybackButtonProps {
  status: VoicePlaybackStatus;
  isActive: boolean;
  isPaused: boolean;
  onToggle: () => void;
}

/**
 * Labeled Play/Pause control that drives the hands-free chapter walkthrough in
 * Learn mode. Rendering is gated by the parent — it is only mounted when the
 * speech service is configured.
 */
export const VoicePlaybackButton = ({
  status,
  isActive,
  isPaused,
  onToggle,
}: VoicePlaybackButtonProps) => {
  const { t } = useTranslation();

  const isError = status === 'error';
  const isLoading = isActive && !isPaused && status === 'loading';
  const showPause = isActive && !isPaused;

  const label = isError
    ? t('speech.autoPlayError')
    : !isActive
      ? t('speech.autoPlay')
      : isPaused
        ? t('speech.autoPlayResume')
        : isLoading
          ? t('speech.autoPlayLoading')
          : t('speech.autoPlayPause');

  const icon = isError ? (
    <AlertCircle size={18} />
  ) : isLoading ? (
    <Loader2 size={18} className="animate-spin" />
  ) : showPause ? (
    <Pause size={18} />
  ) : (
    <Play size={18} />
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative flex items-center px-3 py-1.5 text-sm font-medium rounded-full transition-all
        ${
          isError
            ? 'bg-red-50 text-red-700 hover:bg-red-100'
            : showPause
              ? 'bg-primary-100 text-primary-700'
              : 'bg-surface text-on-surface-variant hover:bg-primary-50'
        }`}
      aria-label={label}
      title={label}
    >
      {icon}
      <span
        className={`overflow-hidden whitespace-nowrap transition-all ${
          isError
            ? 'ml-2 max-w-[20rem] opacity-100'
            : 'max-w-0 opacity-0 group-hover:ml-2 group-hover:max-w-[12rem] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[12rem] group-focus-visible:opacity-100'
        }`}
      >
        {label}
      </span>
    </button>
  );
};
