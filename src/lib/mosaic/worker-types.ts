import type { RGB } from "./quantize";
import type { MosaicProcessOptions } from "./process";

export type MosaicWorkerRequestFromPixels = {
  jobId: number;
  mode: "pixels";
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  options: MosaicProcessOptions;
};

export type MosaicWorkerRequestFromBitmap = {
  jobId: number;
  mode: "bitmap";
  width: number;
  height: number;
  bitmap: ImageBitmap;
  options: MosaicProcessOptions;
};

export type MosaicWorkerRequest = MosaicWorkerRequestFromPixels | MosaicWorkerRequestFromBitmap;

export type MosaicWorkerResponse = {
  jobId: number;
  pixels: Uint8ClampedArray;
  palette: RGB[];
  tileIndices: number[];
  tileCols: number;
  tileRows: number;
  error?: string;
};
