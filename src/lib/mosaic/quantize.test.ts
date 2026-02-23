import { describe, expect, it } from "vitest";
import { nearestPaletteColor, quantizeColors, type RGB } from "./quantize";

describe("quantize", () => {
  it("selects nearest color in palette", () => {
    const palette: RGB[] = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
    ];

    expect(nearestPaletteColor([240, 20, 10], palette)).toEqual([255, 0, 0]);
    expect(nearestPaletteColor([10, 230, 10], palette)).toEqual([0, 255, 0]);
  });

  it("returns k centroids bounded by input size", () => {
    const points: RGB[] = [
      [250, 0, 0],
      [245, 8, 3],
      [0, 240, 0],
      [5, 252, 5],
    ];

    const palette = quantizeColors(points, 2, 8);
    expect(palette).toHaveLength(2);

    for (const color of palette) {
      expect(color[0]).toBeGreaterThanOrEqual(0);
      expect(color[0]).toBeLessThanOrEqual(255);
      expect(color[1]).toBeGreaterThanOrEqual(0);
      expect(color[1]).toBeLessThanOrEqual(255);
      expect(color[2]).toBeGreaterThanOrEqual(0);
      expect(color[2]).toBeLessThanOrEqual(255);
    }
  });
});
