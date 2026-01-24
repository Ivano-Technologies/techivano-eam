/**
 * Format a number as Nigerian Naira currency with ₦ symbol and thousand separators
 * @param amount - The numeric amount to format
 * @param options - Optional formatting options
 * @returns Formatted currency string (e.g., "₦1,234,567.89")
 */
export function formatNaira(
  amount: number | string | null | undefined,
  options?: {
    showSymbol?: boolean;
    decimals?: number;
    compact?: boolean;
  }
): string {
  const {
    showSymbol = true,
    decimals = 2,
    compact = false,
  } = options || {};

  // Handle null/undefined
  if (amount === null || amount === undefined) {
    return showSymbol ? '₦0.00' : '0.00';
  }

  // Convert to number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Handle invalid numbers
  if (isNaN(numAmount)) {
    return showSymbol ? '₦0.00' : '0.00';
  }

  // Compact notation for large numbers (e.g., ₦1.2M, ₦3.5B)
  if (compact) {
    const absAmount = Math.abs(numAmount);
    let compactValue: string;
    
    if (absAmount >= 1_000_000_000) {
      compactValue = (numAmount / 1_000_000_000).toFixed(1) + 'B';
    } else if (absAmount >= 1_000_000) {
      compactValue = (numAmount / 1_000_000).toFixed(1) + 'M';
    } else if (absAmount >= 1_000) {
      compactValue = (numAmount / 1_000).toFixed(1) + 'K';
    } else {
      compactValue = numAmount.toFixed(decimals);
    }
    
    return showSymbol ? `₦${compactValue}` : compactValue;
  }

  // Standard formatting with thousand separators
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numAmount);

  return showSymbol ? `₦${formatted}` : formatted;
}

/**
 * Parse a Naira-formatted string back to a number
 * @param nairaString - Formatted currency string (e.g., "₦1,234.56")
 * @returns Numeric value
 */
export function parseNaira(nairaString: string): number {
  // Remove ₦ symbol, commas, and whitespace
  const cleaned = nairaString.replace(/[₦,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
