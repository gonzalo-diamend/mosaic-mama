import type { RGB } from "./quantize";
import { buildMosaicPixels } from "./process";

export type MosaicOptions = {
  tileSize: number;
  colorCount: number;
  showGrout: boolean;
  customPalette?: RGB[];
  dithering?: boolean;
  style?: "square" | "irregular";
};

export function fitDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const maxSide = Math.max(width, height);
  if (maxSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / maxSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function drawScaledImage(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  maxDimension = 1400,
): { width: number; height: number } {
  const { width, height } = fitDimensions(image.naturalWidth, image.naturalHeight, maxDimension);
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo inicializar el canvas.");
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return { width, height };
}

export function renderMosaic(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  options: MosaicOptions,
): RGB[] {
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const targetContext = targetCanvas.getContext("2d");

  if (!sourceContext || !targetContext) {
    throw new Error("No se pudo inicializar el canvas.");
  }

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  targetCanvas.width = width;
  targetCanvas.height = height;

  const imageData = sourceContext.getImageData(0, 0, width, height);
  const result = buildMosaicPixels(imageData.data, width, height, options);
  const output = new ImageData(new Uint8ClampedArray(result.pixels), width, height);

  targetContext.clearRect(0, 0, width, height);
  targetContext.imageSmoothingEnabled = false;
  targetContext.putImageData(output, 0, 0);
  return result.palette;
}
