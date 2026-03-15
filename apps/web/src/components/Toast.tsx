import { useEffect, useRef, useState } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  duration?: number;
  onDismiss: () => void;
}

export const Toast = ({
  message,
  visible,
  duration = 2000,
  onDismiss,
}: ToastProps) => {
  const [isShowing, setIsShowing] = useState(false);
  const onDismissRef = useRef(onDismiss);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref updated
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsShowing(true);

      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Set timer to hide after duration
      timerRef.current = setTimeout(() => {
        setIsShowing(false);
        // Wait for fade-out animation, then call dismiss
        setTimeout(() => {
          onDismissRef.current();
        }, 300);
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible, duration]);

  if (!visible && !isShowing) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isShowing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
        {message}
      </div>
    </div>
  );
};
