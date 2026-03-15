import { useEffect, useRef } from 'react';

export default function useKeyboardShortcuts(keyMap) {
  const keyMapRef = useRef(keyMap);
  keyMapRef.current = keyMap;

  useEffect(() => {
    function handleKeyDown(event) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      let key = event.key;
      if (key === ' ') key = 'Space';

      const handler = keyMapRef.current[key] ?? keyMapRef.current[event.key];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
