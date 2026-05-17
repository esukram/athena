import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { VoicePlaybackButton } from './VoicePlaybackButton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('VoicePlaybackButton', () => {
  it('shows the play label when inactive', () => {
    render(
      <VoicePlaybackButton
        status="idle"
        isActive={false}
        isPaused={false}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('speech.autoPlay');
  });

  it('shows the pause label while actively speaking', () => {
    render(
      <VoicePlaybackButton
        status="speaking-question"
        isActive={true}
        isPaused={false}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent(
      'speech.autoPlayPause',
    );
  });

  it('shows the resume label while paused', () => {
    render(
      <VoicePlaybackButton
        status="speaking-answer"
        isActive={true}
        isPaused={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent(
      'speech.autoPlayResume',
    );
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(
      <VoicePlaybackButton
        status="idle"
        isActive={false}
        isPaused={false}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
