/**
 * Hook for haptic feedback (vibration) on mobile devices
 * Provides tactile confirmation for user actions
 */

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 50,
  success: [50, 50, 50], // Three short pulses
  error: [100, 50, 100], // Two longer pulses
  warning: [30, 30, 30, 30, 30], // Five quick pulses
};

/**
 * Check if haptic feedback is available
 */
export function isHapticAvailable(): boolean {
  return 'vibrate' in navigator && typeof navigator.vibrate === 'function';
}

/**
 * Trigger haptic feedback with a specific pattern
 */
export function triggerHaptic(pattern: HapticPattern = 'light'): void {
  if (!isHapticAvailable()) {
    return;
  }

  try {
    const vibrationPattern = HAPTIC_PATTERNS[pattern];
    navigator.vibrate(vibrationPattern);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Hook that provides haptic feedback functions
 */
export function useHaptic() {
  const vibrate = (pattern: HapticPattern = 'light') => {
    triggerHaptic(pattern);
  };

  const vibrateSuccess = () => triggerHaptic('success');
  const vibrateError = () => triggerHaptic('error');
  const vibrateWarning = () => triggerHaptic('warning');
  const vibrateLight = () => triggerHaptic('light');
  const vibrateMedium = () => triggerHaptic('medium');
  const vibrateHeavy = () => triggerHaptic('heavy');

  return {
    vibrate,
    vibrateSuccess,
    vibrateError,
    vibrateWarning,
    vibrateLight,
    vibrateMedium,
    vibrateHeavy,
    isAvailable: isHapticAvailable(),
  };
}

/**
 * Stop any ongoing vibration
 */
export function stopHaptic(): void {
  if (isHapticAvailable()) {
    navigator.vibrate(0);
  }
}
