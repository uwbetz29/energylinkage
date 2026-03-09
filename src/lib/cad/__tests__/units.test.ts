import { describe, it, expect } from "vitest";
import {
  parseImperialToInches,
  inchesToImperial,
  calculateScaleFactor,
  formatDiameter,
} from "../units";

describe("parseImperialToInches", () => {
  it("parses feet-inches-fraction: 45'-0 1/2\"", () => {
    expect(parseImperialToInches("45'-0 1/2\"")).toBe(540.5);
  });

  it("parses feet-inches: 9'-8\"", () => {
    expect(parseImperialToInches("9'-8\"")).toBe(116);
  });

  it("parses feet-inches zero: 10'-0\"", () => {
    expect(parseImperialToInches("10'-0\"")).toBe(120);
  });

  it("parses feet only: 5'", () => {
    expect(parseImperialToInches("5'")).toBe(60);
  });

  it("parses fraction only: 1/8", () => {
    expect(parseImperialToInches("1/8")).toBe(0.125);
  });

  it("parses fraction: 3/4", () => {
    expect(parseImperialToInches("3/4")).toBe(0.75);
  });

  it("parses decimal inches: 24.5", () => {
    expect(parseImperialToInches("24.5")).toBe(24.5);
  });

  it("returns 0 for empty string", () => {
    expect(parseImperialToInches("")).toBe(0);
  });

  it("returns 0 for non-numeric garbage", () => {
    expect(parseImperialToInches("abc")).toBe(0);
  });

  it("strips quotes from input", () => {
    expect(parseImperialToInches('10\'-0"')).toBe(120);
  });
});

describe("inchesToImperial", () => {
  it("formats whole feet: 120 => 10'-0\"", () => {
    expect(inchesToImperial(120)).toBe("10'-0\"");
  });

  it("formats feet and inches: 116 => 9'-8\"", () => {
    expect(inchesToImperial(116)).toBe("9'-8\"");
  });

  it("formats with fraction: 540.5 => 45'-0 1/2\"", () => {
    expect(inchesToImperial(540.5)).toBe("45'-0 1/2\"");
  });

  it("formats inches only: 6 => 6\"", () => {
    expect(inchesToImperial(6)).toBe('6"');
  });

  it("formats fraction only: 0.25 => 1/4\"", () => {
    expect(inchesToImperial(0.25)).toBe('1/4"');
  });

  it("formats negative values", () => {
    expect(inchesToImperial(-24)).toBe('-2\'-0"');
  });

  it("formats zero", () => {
    expect(inchesToImperial(0)).toBe('0"');
  });

  it("roundtrips feet-inches-fraction", () => {
    const original = "45'-0 1/2\"";
    const inches = parseImperialToInches(original);
    expect(inchesToImperial(inches)).toBe(original);
  });
});

describe("calculateScaleFactor", () => {
  it("returns ratio between two dimension strings", () => {
    expect(calculateScaleFactor("10'-0\"", "20'-0\"")).toBe(2);
  });

  it("returns 1 for equal dimensions", () => {
    expect(calculateScaleFactor("5'-0\"", "5'-0\"")).toBe(1);
  });

  it("returns 1 when original is zero", () => {
    expect(calculateScaleFactor("", "10'-0\"")).toBe(1);
  });

  it("handles fractional scale", () => {
    expect(calculateScaleFactor("10'-0\"", "5'-0\"")).toBeCloseTo(0.5);
  });
});

describe("formatDiameter", () => {
  it("prepends diameter symbol", () => {
    expect(formatDiameter(24)).toBe('Ø2\'-0"');
  });

  it("formats small diameters", () => {
    expect(formatDiameter(6)).toBe('Ø6"');
  });
});
