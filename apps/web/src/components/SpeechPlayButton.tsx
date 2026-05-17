import { AudioLines, Loader2, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useCallback, useRef, useState } from 'react';

import { audioUrlFromBase64 } from '../utils/audioFromBase64';
import { trpc } from '../utils/trpc';

interface SpeechPlayButtonProps {
  text: string;
  language: 'de' | 'en';
  className?: string;
}

type PlaybackState = 'idle' | 'loading' | 'playing';

export const SpeechPlayButton = ({
  text,
  language,
  className = '',
}: SpeechPlayButtonProps) => {
  const { t } = useTranslation();
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const synthesizeMutation = trpc.speech.synthesize.useMutation();
  const isConfiguredQuery = trpc.speech.isConfigured.useQuery();

  const handlePlay = useCallback(async () => {
    if (playbackState === 'playing') {
      // Stop playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlaybackState('idle');
      return;
    }

    setPlaybackState('loading');

    try {
      const result = await synthesizeMutation.mutateAsync({ text, language });

      // Create audio from base64 data
      const audioUrl = audioUrlFromBase64(result.audioData);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlaybackState('idle');
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPlaybackState('idle');
        URL.revokeObjectURL(audioUrl);
      };

      setPlaybackState('playing');
      await audio.play();
    } catch {
      setPlaybackState('idle');
    }
  }, [playbackState, synthesizeMutation, text, language]);

  // Don't render if speech is not configured
  if (!isConfiguredQuery.data) {
    return null;
  }

  const getIcon = () => {
    switch (playbackState) {
      case 'loading':
        return <Loader2 size={18} className="animate-spin" />;
      case 'playing':
        return <Square size={18} />;
      default:
        return <AudioLines size={18} />;
    }
  };

  const getAriaLabel = () => {
    switch (playbackState) {
      case 'loading':
        return t('speech.loading');
      case 'playing':
        return t('speech.stopPlayback');
      default:
        return t('speech.playQuestion');
    }
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handlePlay();
      }}
      disabled={playbackState === 'loading'}
      className={`p-2 rounded-full transition-all hover:scale-110 hover:bg-primary-50 
        ${playbackState === 'playing' ? 'text-primary-600 bg-primary-100' : 'text-on-surface-variant'}
        ${playbackState === 'loading' ? 'opacity-50 cursor-wait' : ''}
        ${className}`}
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
    >
      {getIcon()}
    </button>
  );
};
