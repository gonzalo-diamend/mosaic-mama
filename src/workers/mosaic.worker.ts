/// <reference lib="webworker" />

import { buildMosaicPixels } from "../lib/mosaic/process";
import type { MosaicWorkerRequest, MosaicWorkerResponse } from "../lib/mosaic/worker-types";

self.onmessage = (event: MessageEvent<MosaicWorkerRequest>) => {
  const { jobId, mode, width, height, options } = event.data;

  try {
    let sourcePixels: Uint8ClampedArray;

    if (mode === "bitmap") {
      const { bitmap } = event.data;
      if (typeof OffscreenCanvas === "undefined") {
        bitmap.close();
        throw new Error("OffscreenCanvas no disponible");
      }

      const offscreen = new OffscreenCanvas(width, height);
      const context = offscreen.getContext("2d", { willReadFrequently: true });
      if (!context) {
        bitmap.close();
        throw new Error("No se pudo inicializar OffscreenCanvas");
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const imageData = context.getImageData(0, 0, width, height);
      sourcePixels = imageData.data;
    } else {
      sourcePixels = event.data.pixels;
    }

    const result = buildMosaicPixels(sourcePixels, width, height, options);

    const response: MosaicWorkerResponse = {
      jobId,
      pixels: result.pixels,
      palette: result.palette,
      tileIndices: result.tileIndices,
      tileCols: result.tileCols,
      tileRows: result.tileRows,
    };

    self.postMessage(response);
  } catch {
    const response: MosaicWorkerResponse = {
      jobId,
      pixels: new Uint8ClampedArray(width * height * 4),
      palette: [],
      tileIndices: [],
      tileCols: 0,
      tileRows: 0,
      error: "worker_failed",
    };
    self.postMessage(response);
  }
};

export {};
