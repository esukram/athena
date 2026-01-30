import { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (visible) {
      setIsShowing(true);
      const timer = setTimeout(() => {
        setIsShowing(false);
        setTimeout(onDismiss, 300); // Wait for fade-out animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!visible && !isShowing) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isShowing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
        {message}
      </div>
    </div>
  );
};
