/**
 * ─── useDebounce Hook ────────────────────────────────────────────────
 * Custom hook to debounce a value.
 * Returns debounced value after specified delay.
 * Used in AssumptionEditor for 600ms debounce on slider changes.
 */

import { useEffect, useState } from 'react';

/**
 * Debounce hook: delays value update until no changes occur within delay ms
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default: 600)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 600): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timeout to update the debounced value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timeout if value changes before delay completes
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
