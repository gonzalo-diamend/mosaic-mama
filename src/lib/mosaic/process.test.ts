import { describe, expect, it } from "vitest";
import { buildMosaicPixels } from "./process";
import type { RGB } from "./quantize";

function solidImage(width: number, height: number, color: RGB): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    pixels[idx] = color[0];
    pixels[idx + 1] = color[1];
    pixels[idx + 2] = color[2];
    pixels[idx + 3] = 255;
  }
  return pixels;
}

describe("buildMosaicPixels", () => {
  it("keeps solid image color with no grout", () => {
    const src = solidImage(4, 4, [120, 30, 30]);
    const result = buildMosaicPixels(src, 4, 4, {
      tileSize: 2,
      colorCount: 2,
      showGrout: false,
      style: "square",
    });

    expect(result.tileCols).toBe(2);
    expect(result.tileRows).toBe(2);
    expect(result.tileIndices).toHaveLength(4);

    for (let i = 0; i < result.pixels.length; i += 4) {
      expect(result.pixels[i]).toBe(120);
      expect(result.pixels[i + 1]).toBe(30);
      expect(result.pixels[i + 2]).toBe(30);
      expect(result.pixels[i + 3]).toBe(255);
    }
  });

  it("uses custom palette as hard constraint", () => {
    const src = solidImage(4, 4, [200, 10, 10]);
    const customPalette: RGB[] = [
      [0, 0, 255],
      [255, 255, 0],
    ];

    const result = buildMosaicPixels(src, 4, 4, {
      tileSize: 2,
      colorCount: 2,
      showGrout: false,
      style: "square",
      customPalette,
    });

    for (const index of result.tileIndices) {
      expect(index === 0 || index === 1).toBe(true);
    }
  });

  it("returns consistent tile metadata when dithering is enabled", () => {
    const src = new Uint8ClampedArray([
      255, 0, 0, 255,
      200, 50, 50, 255,
      100, 150, 150, 255,
      0, 255, 255, 255,
      255, 80, 20, 255,
      200, 90, 40, 255,
      20, 180, 200, 255,
      0, 140, 255, 255,
      250, 100, 40, 255,
      180, 120, 60, 255,
      30, 180, 220, 255,
      10, 120, 255, 255,
      255, 120, 50, 255,
      170, 130, 70, 255,
      40, 190, 230, 255,
      20, 110, 240, 255,
    ]);

    const result = buildMosaicPixels(src, 4, 4, {
      tileSize: 2,
      colorCount: 2,
      showGrout: true,
      style: "irregular",
      dithering: true,
    });

    expect(result.tileCols).toBe(2);
    expect(result.tileRows).toBe(2);
    expect(result.tileIndices).toHaveLength(4);
    expect(result.palette.length).toBeLessThanOrEqual(2);
  });
});
