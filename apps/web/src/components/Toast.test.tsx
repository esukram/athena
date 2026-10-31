import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '@testing-library/react';

import { Toast } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onDismiss after duration plus the fade-out delay', () => {
    const onDismiss = vi.fn();
    render(
      <Toast message="Saved" visible duration={1000} onDismiss={onDismiss} />,
    );

    vi.advanceTimersByTime(1299);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not call onDismiss when unmounted during the fade-out', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <Toast message="Saved" visible duration={1000} onDismiss={onDismiss} />,
    );

    vi.advanceTimersByTime(1000);
    unmount();
    vi.advanceTimersByTime(300);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('stops rendering when visible turns false before the auto-hide fires', () => {
    const onDismiss = vi.fn();
    const { rerender, queryByText } = render(
      <Toast message="Saved" visible duration={1000} onDismiss={onDismiss} />,
    );

    rerender(
      <Toast
        message="Saved"
        visible={false}
        duration={1000}
        onDismiss={onDismiss}
      />,
    );
    vi.advanceTimersByTime(5000);

    expect(queryByText('Saved')).toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
