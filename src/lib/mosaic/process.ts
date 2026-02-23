import { nearestPaletteColor, quantizeColors, type RGB } from "./quantize";

export type MosaicProcessOptions = {
  tileSize: number;
  colorCount: number;
  showGrout: boolean;
  customPalette?: RGB[];
  dithering?: boolean;
  style?: "square" | "irregular";
};

type Tile = {
  x: number;
  y: number;
  width: number;
  height: number;
  average: RGB;
  gridX: number;
  gridY: number;
};

function blendChannel(base: number, overlay: number, alpha: number): number {
  return Math.round(base * (1 - alpha) + overlay * alpha);
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function noise2d(x: number, y: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function buildMosaicPixels(
  sourcePixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: MosaicProcessOptions,
): { pixels: Uint8ClampedArray; palette: RGB[]; tileIndices: number[]; tileCols: number; tileRows: number } {
  const tileSize = Math.max(2, Math.floor(options.tileSize));
  const tiles: Tile[] = [];
  const averages: RGB[] = [];
  const tileCols = Math.ceil(width / tileSize);
  const tileRows = Math.ceil(height / tileSize);

  for (let y = 0, gy = 0; y < height; y += tileSize, gy += 1) {
    for (let x = 0, gx = 0; x < width; x += tileSize, gx += 1) {
      const currentTileWidth = Math.min(tileSize, width - x);
      const currentTileHeight = Math.min(tileSize, height - y);

      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let yy = y; yy < y + currentTileHeight; yy += 1) {
        for (let xx = x; xx < x + currentTileWidth; xx += 1) {
          const index = (yy * width + xx) * 4;
          r += sourcePixels[index];
          g += sourcePixels[index + 1];
          b += sourcePixels[index + 2];
          count += 1;
        }
      }

      const average: RGB = [
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count),
      ];

      tiles.push({
        x,
        y,
        width: currentTileWidth,
        height: currentTileHeight,
        average,
        gridX: gx,
        gridY: gy,
      });
      averages.push(average);
    }
  }

  const palette =
    options.customPalette && options.customPalette.length > 0
      ? options.customPalette.slice(0, options.colorCount)
      : quantizeColors(averages, options.colorCount);

  const output = new Uint8ClampedArray(width * height * 4);
  const tileIndices = new Array(tiles.length).fill(0);

  const assignedColors: RGB[] = options.dithering
    ? new Array(tiles.length).fill(null).map(() => [0, 0, 0] as RGB)
    : tiles.map((tile) => nearestPaletteColor(tile.average, palette));

  if (options.dithering) {
    const working = tiles.map((tile) => [tile.average[0], tile.average[1], tile.average[2]] as [number, number, number]);
    const indexAt = (x: number, y: number) => y * tileCols + x;

    for (let y = 0; y < tileRows; y += 1) {
      for (let x = 0; x < tileCols; x += 1) {
        const index = indexAt(x, y);
        const src = working[index];
        const mapped = nearestPaletteColor([clampChannel(src[0]), clampChannel(src[1]), clampChannel(src[2])], palette);
        assignedColors[index] = mapped;
        tileIndices[index] = palette.findIndex((p) => p[0] === mapped[0] && p[1] === mapped[1] && p[2] === mapped[2]);

        const errR = src[0] - mapped[0];
        const errG = src[1] - mapped[1];
        const errB = src[2] - mapped[2];

        const diffuse = (dx: number, dy: number, factor: number) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= tileCols || ny >= tileRows) {
            return;
          }
          const nIndex = indexAt(nx, ny);
          working[nIndex][0] += errR * factor;
          working[nIndex][1] += errG * factor;
          working[nIndex][2] += errB * factor;
        };

        diffuse(1, 0, 7 / 16);
        diffuse(-1, 1, 3 / 16);
        diffuse(0, 1, 5 / 16);
        diffuse(1, 1, 1 / 16);
      }
    }
  }

  for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
    const tile = tiles[tileIndex];
    const color = assignedColors[tileIndex];
    if (!options.dithering) {
      tileIndices[tileIndex] = palette.findIndex((p) => p[0] === color[0] && p[1] === color[1] && p[2] === color[2]);
    }

    for (let yy = tile.y; yy < tile.y + tile.height; yy += 1) {
      for (let xx = tile.x; xx < tile.x + tile.width; xx += 1) {
        const index = (yy * width + xx) * 4;
        const edgeDistance = Math.min(
          xx - tile.x,
          tile.x + tile.width - 1 - xx,
          yy - tile.y,
          tile.y + tile.height - 1 - yy,
        );
        const edgeNoise = noise2d(xx, yy);

        const isBorder =
          options.showGrout &&
          (options.style === "irregular"
            ? edgeDistance === 0 || (edgeDistance === 1 && edgeNoise > 0.5)
            : (xx === tile.x ||
                xx === tile.x + tile.width - 1 ||
                yy === tile.y ||
                yy === tile.y + tile.height - 1));

        if (isBorder) {
          output[index] = blendChannel(color[0], 255, 0.75);
          output[index + 1] = blendChannel(color[1], 255, 0.75);
          output[index + 2] = blendChannel(color[2], 255, 0.75);
        } else {
          output[index] = color[0];
          output[index + 1] = color[1];
          output[index + 2] = color[2];
        }

        output[index + 3] = 255;
      }
    }
  }

  return { pixels: output, palette, tileIndices, tileCols, tileRows };
}
