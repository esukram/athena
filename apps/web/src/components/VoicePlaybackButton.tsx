import { AlertCircle, Loader2, Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { VoicePlaybackStatus } from '../hooks/useChapterVoicePlayback';
import { IconButton } from './buttons/IconButton';

interface VoicePlaybackButtonProps {
  status: VoicePlaybackStatus;
  isActive: boolean;
  isPaused: boolean;
  onToggle: () => void;
}

/**
 * Play/Pause control that drives the hands-free chapter walkthrough in Learn
 * mode. Renders as a circular icon button consistent with the other header
 * controls; the descriptive label is exposed via `aria-label`/`title`.
 * Rendering is gated by the parent — it is only mounted when the speech
 * service is configured.
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

  const icon = isError
    ? AlertCircle
    : isLoading
      ? Loader2
      : showPause
        ? Pause
        : Play;

  return (
    <IconButton
      icon={icon}
      onClick={onToggle}
      aria-label={label}
      title={label}
      variant={isError ? 'danger' : 'primary'}
      className={isError ? '!bg-red-50' : showPause ? '!bg-primary-100' : ''}
      iconClassName={
        isLoading
          ? 'animate-spin'
          : isError
            ? 'text-red-600'
            : showPause
              ? 'text-primary-700'
              : ''
      }
    />
  );
};
