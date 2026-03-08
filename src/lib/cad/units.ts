// Imperial unit parsing and formatting for power generation drawings
// All internal measurements stored in inches

/**
 * Parse an imperial dimension string like "45'-0 1/2\"" or "9'-8 3/4\"" into inches
 */
export function parseImperialToInches(value: string): number {
  const cleaned = value.replace(/"/g, "").trim();

  // Try to match ft'-in fraction" format: 45'-0 1/2
  const ftInFracMatch = cleaned.match(
    /^(\d+)'-(\d+)\s+(\d+)\/(\d+)$/
  );
  if (ftInFracMatch) {
    const feet = parseInt(ftInFracMatch[1]);
    const inches = parseInt(ftInFracMatch[2]);
    const fracNum = parseInt(ftInFracMatch[3]);
    const fracDen = parseInt(ftInFracMatch[4]);
    return feet * 12 + inches + fracNum / fracDen;
  }

  // Try ft'-in" format: 45'-0 or 9'-8
  const ftInMatch = cleaned.match(/^(\d+)'-(\d+)$/);
  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1]);
    const inches = parseInt(ftInMatch[2]);
    return feet * 12 + inches;
  }

  // Try just feet: 45'
  const ftMatch = cleaned.match(/^(\d+)'$/);
  if (ftMatch) {
    return parseInt(ftMatch[1]) * 12;
  }

  // Try fraction only: 1/8
  const fracMatch = cleaned.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
  }

  // Try decimal inches
  const num = parseFloat(cleaned);
  if (!isNaN(num)) return num;

  return 0;
}

/**
 * Format inches as imperial ft'-in fraction" string
 */
export function inchesToImperial(totalInches: number): string {
  const negative = totalInches < 0;
  totalInches = Math.abs(totalInches);

  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches - feet * 12;
  const wholeInches = Math.floor(remainingInches);
  const fractionalInches = remainingInches - wholeInches;

  const fraction = decimalToFraction(fractionalInches, 16); // 1/16" precision
  const sign = negative ? "-" : "";

  if (feet === 0) {
    if (fraction) {
      return wholeInches > 0
        ? `${sign}${wholeInches} ${fraction}"`
        : `${sign}${fraction}"`;
    }
    return `${sign}${wholeInches}"`;
  }

  if (fraction) {
    return `${sign}${feet}'-${wholeInches} ${fraction}"`;
  }
  return `${sign}${feet}'-${wholeInches}"`;
}

/**
 * Convert decimal to a reduced fraction string with given denominator precision
 */
function decimalToFraction(
  decimal: number,
  maxDenominator: number
): string {
  if (decimal < 1 / (maxDenominator * 2)) return "";

  const numerator = Math.round(decimal * maxDenominator);
  if (numerator === 0) return "";
  if (numerator === maxDenominator) return "";

  // Reduce the fraction
  const g = gcd(numerator, maxDenominator);
  return `${numerator / g}/${maxDenominator / g}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Format a diameter dimension
 */
export function formatDiameter(inches: number): string {
  return `Ø${inchesToImperial(inches)}`;
}

/**
 * Calculate scale factor between two imperial dimension strings
 */
export function calculateScaleFactor(
  originalStr: string,
  newStr: string
): number {
  const original = parseImperialToInches(originalStr);
  const newVal = parseImperialToInches(newStr);
  if (original === 0) return 1;
  return newVal / original;
}
