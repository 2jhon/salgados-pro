import { useState, useEffect } from 'react';

export function useKeyboardFocus() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        setIsKeyboardOpen(true);
      }
    };
    
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        // Small delay to prevent flickering when jumping between inputs
        setTimeout(() => {
          if (document.activeElement?.tagName !== 'INPUT' && 
              document.activeElement?.tagName !== 'TEXTAREA' && 
              !(document.activeElement as HTMLElement)?.isContentEditable) {
            setIsKeyboardOpen(false);
          }
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isKeyboardOpen;
}
