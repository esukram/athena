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
 * controls; the descriptive label is exposed via `aria-label`/`title`. The
 * error state additionally renders the label as visible text, since a failure
 * should be noticeable without hovering. Rendering is gated by the parent — it
 * is only mounted when the speech service is configured.
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

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <IconButton
          icon={AlertCircle}
          onClick={onToggle}
          aria-label={label}
          title={label}
          variant="danger"
          className="!bg-red-50"
          iconClassName="!text-red-600"
        />
        <span className="text-sm font-medium text-red-700">{label}</span>
      </div>
    );
  }

  const icon = isLoading ? Loader2 : showPause ? Pause : Play;

  return (
    <IconButton
      icon={icon}
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-pressed={showPause}
      className={showPause ? '!bg-primary-100' : ''}
      iconClassName={
        isLoading ? 'animate-spin' : showPause ? '!text-primary-700' : ''
      }
    />
  );
};
