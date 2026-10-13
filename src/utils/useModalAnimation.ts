import { useState, useEffect } from 'react';

/**
 * Hook to manage enter and exit keyframe animations for modal dialogs.
 * Keeps the modal mounted during exit animation so keyframes finish before unmounting.
 */
export function useModalAnimation(isOpen: boolean, duration: number = 200) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsAnimatingOut(false);
    } else if (isRendered) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsAnimatingOut(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered, duration]);

  return {
    isRendered,
    isVisible: isOpen && !isAnimatingOut,
    backdropClass: isAnimatingOut ? 'anim-modal-backdrop-out' : 'anim-modal-backdrop-in',
    dialogClass: isAnimatingOut ? 'anim-modal-content-out' : 'anim-modal-content-in',
    isAnimatingOut,
  };
}

/**
 * Hook to manage smooth enter and exit animations for dropdown curtains.
 */
export function useCurtainAnimation(isOpen: boolean, duration: number = 160) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsAnimatingOut(false);
    } else if (isRendered) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsAnimatingOut(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered, duration]);

  return {
    isRendered,
    curtainClass: isAnimatingOut ? 'anim-curtain-out' : 'anim-curtain-in',
    isAnimatingOut,
  };
}

/**
 * Hook to manage smooth slide in and slide out animations for the Queue Drawer.
 */
export function useDrawerAnimation(isOpen: boolean, duration: number = 180) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsAnimatingOut(false);
    } else if (isRendered) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsAnimatingOut(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered, duration]);

  return {
    isRendered,
    drawerClass: isAnimatingOut ? 'anim-drawer-out' : 'anim-drawer-in',
    isAnimatingOut,
  };
}
