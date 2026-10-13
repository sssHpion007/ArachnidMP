import { useState, useEffect } from 'react';

/**
 * Hook to manage smooth enter and exit CSS transitions for modal dialogs.
 * Keeps the modal mounted during exit animation so transition finishes before unmounting.
 */
export function useModalAnimation(isOpen: boolean, duration: number = 200) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const raf = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration]);

  return { isRendered, isVisible };
}
