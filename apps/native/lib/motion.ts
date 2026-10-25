import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the phone asks for less motion (iOS Reduce Motion, Android Remove animations), kept in
 * step while the app is open (hard rule 9, A7-12). Until the phone answers it says `true`: no
 * motion is the safe guess for the first frame.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (live) setReduce(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) =>
      setReduce(enabled),
    );
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
