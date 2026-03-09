// Dimension Filter
// Filters out junk dimension candidates (page border grid numbers, title block text,
// implausible values) that pollute the dimension overlay and cascade suggestions.

/**
 * Returns true if text looks like junk — page border grid numbers, note references, etc.
 */
export function isJunkDimensionText(text: string): boolean {
  const cleaned = text.trim();

  // Single digit 1-9 → page grid numbers
  if (/^\d$/.test(cleaned)) return true;

  // Single or double letter → grid column labels (A, B, AA, AB)
  if (/^[A-Za-z]{1,2}$/.test(cleaned)) return true;

  // Title block keywords
  if (/^(REV|NO\.|DWG|DATE|SCALE|CHK|DR|APP|SHEET|OF|BY)\b/i.test(cleaned)) return true;

  // Note references in parentheses: (1), (2), (SEE NOTE)
  if (/^\(.*\)$/.test(cleaned)) return true;

  // Revision numbers like "R1", "R2"
  if (/^R\d+$/i.test(cleaned)) return true;

  // Just a dash or period
  if (/^[-.]$/.test(cleaned)) return true;

  return false;
}

/**
 * Returns true if value in inches is plausible for an engineering dimension.
 * Filters out very tiny values (< 1/8") and extremely large values (> 200 ft).
 */
export function isPlausibleValue(valueInches: number): boolean {
  // Less than 1/8" is implausible for structural/ductwork dimensions
  if (valueInches < 0.125) return false;

  // Greater than 200 feet (2400") is implausible for single components
  if (valueInches > 2400) return false;

  return true;
}

/**
 * Returns true if position falls inside the typical title block region
 * of an engineering drawing (bottom strip + right-bottom corner).
 */
export function isInTitleBlock(
  position: { x: number; y: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) return false;

  // Normalize position to 0-1 range within bounds
  const nx = (position.x - bounds.minX) / width;
  const ny = (position.y - bounds.minY) / height;

  // Bottom 12% of drawing height → title block strip
  if (ny < 0.12) return true;

  // Right 35% AND bottom 40% → title block border region
  if (nx > 0.65 && ny < 0.40) return true;

  return false;
}

/**
 * Master filter: combine all checks. Returns whether the candidate passes
 * and a confidence score (0–1).
 */
export function filterDimensionCandidate(
  text: string,
  valueInches: number,
  position: { x: number; y: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): { pass: boolean; confidence: number } {
  // Junk text → reject entirely
  if (isJunkDimensionText(text)) {
    return { pass: false, confidence: 0 };
  }

  // Implausible value → reject
  if (!isPlausibleValue(valueInches)) {
    return { pass: false, confidence: 0 };
  }

  // Title block → keep but with very low confidence
  if (isInTitleBlock(position, bounds)) {
    return { pass: true, confidence: 0.1 };
  }

  // All checks pass → full confidence
  return { pass: true, confidence: 1.0 };
}
