"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import MosaicControls from "@/components/MosaicControls";
import MosaicPreview from "@/components/MosaicPreview";
import PaletteEditor from "@/components/PaletteEditor";
import { exportCanvasAsA4Pdf, exportPatternAsA4Pdf } from "@/lib/mosaic/export";
import { fitDimensions, renderMosaic } from "@/lib/mosaic/render";
import type { RGB } from "@/lib/mosaic/quantize";
import { quantizeColors } from "@/lib/mosaic/quantize";
import type { MosaicWorkerRequest, MosaicWorkerResponse } from "@/lib/mosaic/worker-types";
import { getLatestProject, saveProject } from "@/lib/storage/projects";

const SETTINGS_KEY = "mosaic-settings-v2";
const PALETTE_PRESETS_KEY = "mosaic-palette-presets-v1";

type CropAspect = "original" | "square" | "portrait";
type StyleMode = "square" | "irregular";

type SavedSettings = {
  tileSize: number;
  colorCount: number;
  showGrout: boolean;
  useCustomPalette: boolean;
  customPalette: string[];
  lockedPalette: boolean[];
  dithering: boolean;
  style: StyleMode;
  contrast: number;
  saturation: number;
  rotation: number;
  cropAspect: CropAspect;
  quickPreview: boolean;
  highContrast: boolean;
  largeText: boolean;
  guidedMode: boolean;
};

type PalettePreset = {
  name: string;
  colors: string[];
};

type CachedMosaic = {
  pixels: Uint8ClampedArray;
  palette: RGB[];
  tileIndices: number[];
  tileCols: number;
  tileRows: number;
};

type MosaicMeta = {
  palette: RGB[];
  tileIndices: number[];
  tileCols: number;
  tileRows: number;
};

type RenderMode = "cache" | "bitmap-worker" | "pixels-worker" | "main-thread";

const DEFAULTS: SavedSettings = {
  tileSize: 16,
  colorCount: 10,
  showGrout: true,
  useCustomPalette: false,
  customPalette: new Array(10).fill("#cccccc"),
  lockedPalette: new Array(10).fill(false),
  dithering: false,
  style: "square",
  contrast: 100,
  saturation: 100,
  rotation: 0,
  cropAspect: "original",
  quickPreview: false,
  highContrast: false,
  largeText: false,
  guidedMode: false,
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo abrir la imagen."));
    };

    image.src = url;
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo abrir la imagen guardada."));
    image.src = url;
  });
}

function copyCanvas(source: HTMLCanvasElement, target: HTMLCanvasElement) {
  target.width = source.width;
  target.height = source.height;
  const context = target.getContext("2d");
  if (!context) {
    throw new Error("No se pudo inicializar el canvas.");
  }
  context.clearRect(0, 0, target.width, target.height);
  context.drawImage(source, 0, 0);
}

function rgbToHex([r, g, b]: RGB): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "").slice(0, 6).padEnd(6, "0");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function normalizePaletteLength(palette: string[], count: number): string[] {
  if (palette.length === count) {
    return palette;
  }
  if (palette.length > count) {
    return palette.slice(0, count);
  }

  const next = [...palette];
  while (next.length < count) {
    next.push("#cccccc");
  }
  return next;
}

function normalizeLocks(locks: boolean[], count: number): boolean[] {
  if (locks.length === count) {
    return locks;
  }
  if (locks.length > count) {
    return locks.slice(0, count);
  }
  const next = [...locks];
  while (next.length < count) {
    next.push(false);
  }
  return next;
}

function calcCropRect(width: number, height: number, aspect: CropAspect) {
  if (aspect === "original") {
    return { sx: 0, sy: 0, sw: width, sh: height };
  }

  const targetAspect = aspect === "square" ? 1 : 4 / 5;
  const sourceAspect = width / height;

  if (sourceAspect > targetAspect) {
    const sw = Math.round(height * targetAspect);
    const sx = Math.floor((width - sw) / 2);
    return { sx, sy: 0, sw, sh: height };
  }

  const sh = Math.round(width / targetAspect);
  const sy = Math.floor((height - sh) / 2);
  return { sx: 0, sy, sw: width, sh };
}

function mergePaletteWithLocks(nextPalette: string[], previous: string[], locks: boolean[]) {
  return nextPalette.map((value, index) => (locks[index] ? previous[index] ?? value : value));
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [tileSize, setTileSize] = useState(DEFAULTS.tileSize);
  const [colorCount, setColorCount] = useState(DEFAULTS.colorCount);
  const [showGrout, setShowGrout] = useState(DEFAULTS.showGrout);
  const [useCustomPalette, setUseCustomPalette] = useState(DEFAULTS.useCustomPalette);
  const [customPalette, setCustomPalette] = useState<string[]>(DEFAULTS.customPalette);
  const [lockedPalette, setLockedPalette] = useState<boolean[]>(DEFAULTS.lockedPalette);
  const [style, setStyle] = useState<StyleMode>(DEFAULTS.style);
  const [dithering, setDithering] = useState(DEFAULTS.dithering);
  const [contrast, setContrast] = useState(DEFAULTS.contrast);
  const [saturation, setSaturation] = useState(DEFAULTS.saturation);
  const [rotation, setRotation] = useState(DEFAULTS.rotation);
  const [cropAspect, setCropAspect] = useState<CropAspect>(DEFAULTS.cropAspect);
  const [quickPreview, setQuickPreview] = useState(DEFAULTS.quickPreview);
  const [highContrast, setHighContrast] = useState(DEFAULTS.highContrast);
  const [largeText, setLargeText] = useState(DEFAULTS.largeText);
  const [guidedMode, setGuidedMode] = useState(DEFAULTS.guidedMode);
  const [guidedStep, setGuidedStep] = useState(1);

  const [showOriginal, setShowOriginal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [hasExported, setHasExported] = useState(false);
  const [palettePresets, setPalettePresets] = useState<PalettePreset[]>([]);
  const [lastRenderMs, setLastRenderMs] = useState<number | null>(null);
  const [avgRenderMs, setAvgRenderMs] = useState<number | null>(null);
  const [lastRenderMode, setLastRenderMode] = useState<RenderMode | null>(null);

  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const mosaicCanvasRef = useRef<HTMLCanvasElement>(null);
  const workersRef = useRef<Worker[]>([]);
  const workerCursorRef = useRef(0);
  const latestJobIdRef = useRef(0);
  const colorCountRef = useRef(colorCount);
  const useCustomPaletteRef = useRef(useCustomPalette);
  const cacheRef = useRef<Map<string, CachedMosaic>>(new Map());
  const latestMetaRef = useRef<MosaicMeta | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageSignatureRef = useRef("");
  const undoStackRef = useRef<SavedSettings[]>([]);
  const paletteImportInputRef = useRef<HTMLInputElement>(null);
  const renderStartRef = useRef(0);
  const renderModeRef = useRef<RenderMode>("main-thread");
  const renderCountRef = useRef(0);

  const customPaletteRgb = useMemo(() => customPalette.map((hex) => hexToRgb(hex)), [customPalette]);

  const commitRenderMetrics = useCallback((mode: RenderMode) => {
    const elapsed = Math.max(0, performance.now() - renderStartRef.current);
    const rounded = Math.round(elapsed);
    setLastRenderMs(rounded);
    setLastRenderMode(mode);
    setAvgRenderMs((prev) => {
      renderCountRef.current += 1;
      if (prev === null) {
        return rounded;
      }
      const next = prev + (rounded - prev) / renderCountRef.current;
      return Math.round(next * 10) / 10;
    });
  }, []);

  useEffect(() => {
    colorCountRef.current = colorCount;
    useCustomPaletteRef.current = useCustomPalette;
  }, [colorCount, useCustomPalette]);

  const getSettingsSnapshot = useCallback((): SavedSettings => ({
    tileSize,
    colorCount,
    showGrout,
    useCustomPalette,
    customPalette,
    lockedPalette,
    dithering,
    style,
    contrast,
    saturation,
    rotation,
    cropAspect,
    quickPreview,
    highContrast,
    largeText,
    guidedMode,
  }), [
    colorCount,
    contrast,
    cropAspect,
    customPalette,
    dithering,
    guidedMode,
    highContrast,
    largeText,
    lockedPalette,
    quickPreview,
    rotation,
    saturation,
    showGrout,
    style,
    tileSize,
    useCustomPalette,
  ]);

  const applySettings = useCallback((settings: SavedSettings) => {
    setTileSize(settings.tileSize);
    setColorCount(settings.colorCount);
    setShowGrout(settings.showGrout);
    setUseCustomPalette(settings.useCustomPalette);
    setCustomPalette(normalizePaletteLength(settings.customPalette, settings.colorCount));
    setLockedPalette(normalizeLocks(settings.lockedPalette, settings.colorCount));
    setDithering(settings.dithering);
    setStyle(settings.style);
    setContrast(settings.contrast);
    setSaturation(settings.saturation);
    setRotation(settings.rotation);
    setCropAspect(settings.cropAspect);
    setQuickPreview(settings.quickPreview);
    setHighContrast(settings.highContrast);
    setLargeText(settings.largeText);
    setGuidedMode(settings.guidedMode);
  }, []);

  const pushHistory = useCallback(() => {
    undoStackRef.current = [getSettingsSnapshot(), ...undoStackRef.current].slice(0, 30);
  }, [getSettingsSnapshot]);

  useEffect(() => {
    const saved = safeJsonParse<SavedSettings | null>(window.localStorage.getItem(SETTINGS_KEY), null);
    if (saved) {
      applySettings({
        ...DEFAULTS,
        ...saved,
        customPalette: normalizePaletteLength(saved.customPalette ?? DEFAULTS.customPalette, saved.colorCount ?? DEFAULTS.colorCount),
        lockedPalette: normalizeLocks(saved.lockedPalette ?? DEFAULTS.lockedPalette, saved.colorCount ?? DEFAULTS.colorCount),
      });
    }

    const presets = safeJsonParse<PalettePreset[]>(window.localStorage.getItem(PALETTE_PRESETS_KEY), []);
    setPalettePresets(presets);
  }, [applySettings]);

  useEffect(() => {
    const payload = getSettingsSnapshot();
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  }, [getSettingsSnapshot]);

  useEffect(() => {
    window.localStorage.setItem(PALETTE_PRESETS_KEY, JSON.stringify(palettePresets));
  }, [palettePresets]);

  useEffect(() => {
    setCustomPalette((prev) => normalizePaletteLength(prev, colorCount));
    setLockedPalette((prev) => normalizeLocks(prev, colorCount));
  }, [colorCount]);

  const redrawSourceFromImage = useCallback((maxDimension: number) => {
    const image = imageRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    const originalCanvas = originalCanvasRef.current;

    if (!image || !sourceCanvas || !originalCanvas) {
      return;
    }

    const crop = calcCropRect(image.naturalWidth, image.naturalHeight, cropAspect);
    const fit = fitDimensions(crop.sw, crop.sh, maxDimension);

    sourceCanvas.width = fit.width;
    sourceCanvas.height = fit.height;

    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      throw new Error("No se pudo inicializar el canvas de origen.");
    }

    sourceContext.clearRect(0, 0, fit.width, fit.height);
    sourceContext.filter = `contrast(${contrast}%) saturate(${saturation}%)`;
    sourceContext.translate(fit.width / 2, fit.height / 2);
    sourceContext.rotate((rotation * Math.PI) / 180);
    sourceContext.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, -fit.width / 2, -fit.height / 2, fit.width, fit.height);
    sourceContext.setTransform(1, 0, 0, 1, 0, 0);
    sourceContext.filter = "none";

    copyCanvas(sourceCanvas, originalCanvas);
  }, [contrast, cropAspect, rotation, saturation]);

  const renderCachedResult = useCallback((cached: CachedMosaic, canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const pixels = new Uint8ClampedArray(cached.pixels.length);
    pixels.set(cached.pixels);
    const imageData = new ImageData(pixels, canvas.width, canvas.height);
    context.putImageData(imageData, 0, 0);
    latestMetaRef.current = {
      palette: cached.palette,
      tileIndices: cached.tileIndices,
      tileCols: cached.tileCols,
      tileRows: cached.tileRows,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return;
    }

    const workers = [
      new Worker(new URL("../workers/mosaic.worker.ts", import.meta.url)),
      new Worker(new URL("../workers/mosaic.worker.ts", import.meta.url)),
    ];
    workersRef.current = workers;

    const onWorkerMessage = (event: MessageEvent<MosaicWorkerResponse>) => {
      const { jobId, pixels, palette, tileIndices, tileCols, tileRows, error: workerError } = event.data;
      if (jobId !== latestJobIdRef.current) {
        return;
      }

      const mosaicCanvas = mosaicCanvasRef.current;
      if (!mosaicCanvas) {
        return;
      }

      const context = mosaicCanvas.getContext("2d");
      if (!context) {
        return;
      }

      const safePixels = new Uint8ClampedArray(pixels.length);
      safePixels.set(pixels);
      context.putImageData(new ImageData(safePixels, mosaicCanvas.width, mosaicCanvas.height), 0, 0);

      latestMetaRef.current = { palette, tileIndices, tileCols, tileRows };

      const cacheKey = `${imageSignatureRef.current}|${mosaicCanvas.width}x${mosaicCanvas.height}|${tileSize}|${colorCount}|${showGrout}|${style}|${dithering}|${useCustomPalette}|${customPalette.join(",")}`;
      cacheRef.current.set(cacheKey, {
        pixels: safePixels,
        palette,
        tileIndices,
        tileCols,
        tileRows,
      });

      if (!useCustomPaletteRef.current && palette.length > 0) {
        const autoPalette = normalizePaletteLength(palette.map((color) => rgbToHex(color)), colorCountRef.current);
        setCustomPalette((prev) => mergePaletteWithLocks(autoPalette, prev, lockedPalette));
      }

      setIsProcessing(false);
      setGuidedStep((prev) => Math.max(prev, 3));
      commitRenderMetrics(renderModeRef.current);
      setError(workerError ? "No pudimos procesar la imagen en segundo plano." : null);
    };

    const onWorkerError = () => {
      setIsProcessing(false);
      setError("No pudimos procesar la imagen en segundo plano.");
    };

    workers.forEach((worker) => {
      worker.onmessage = onWorkerMessage;
      worker.onerror = onWorkerError;
    });

    return () => {
      workers.forEach((worker) => worker.terminate());
      workersRef.current = [];
    };
  }, [colorCount, commitRenderMetrics, customPalette, dithering, lockedPalette, showGrout, style, tileSize, useCustomPalette]);

  const processCurrentImage = useCallback(() => {
    const sourceCanvas = sourceCanvasRef.current;
    const mosaicCanvas = mosaicCanvasRef.current;
    if (!sourceCanvas || !mosaicCanvas || !hasImage) {
      return;
    }

    mosaicCanvas.width = sourceCanvas.width;
    mosaicCanvas.height = sourceCanvas.height;

    const cacheKey = `${imageSignatureRef.current}|${sourceCanvas.width}x${sourceCanvas.height}|${tileSize}|${colorCount}|${showGrout}|${style}|${dithering}|${useCustomPalette}|${customPalette.join(",")}`;
    renderStartRef.current = performance.now();
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      renderCachedResult(cached, mosaicCanvas);
      setIsProcessing(false);
      setGuidedStep((prev) => Math.max(prev, 3));
      commitRenderMetrics("cache");
      setError(null);
      return;
    }

    setIsProcessing(true);

    const options = {
      tileSize,
      colorCount,
      showGrout,
      style,
      dithering,
      customPalette: useCustomPalette ? customPaletteRgb : undefined,
    };

    latestJobIdRef.current += 1;
    const currentJobId = latestJobIdRef.current;

    const workers = workersRef.current;
    if (workers.length > 0) {
      const worker = workers[workerCursorRef.current % workers.length];
      workerCursorRef.current += 1;

      if (typeof createImageBitmap === "function") {
        createImageBitmap(sourceCanvas)
          .then((bitmap) => {
            if (!workersRef.current.length || currentJobId !== latestJobIdRef.current) {
              bitmap.close();
              return;
            }

            const payload: MosaicWorkerRequest = {
              jobId: currentJobId,
              mode: "bitmap",
              width: sourceCanvas.width,
              height: sourceCanvas.height,
              bitmap,
              options,
            };
            renderModeRef.current = "bitmap-worker";
            worker.postMessage(payload, [bitmap]);
          })
          .catch(() => {
            const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
            if (!context) {
              setError("No se pudo leer el canvas de origen.");
              setIsProcessing(false);
              return;
            }
            const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
            const payload: MosaicWorkerRequest = {
              jobId: currentJobId,
              mode: "pixels",
              width: sourceCanvas.width,
              height: sourceCanvas.height,
              pixels: imageData.data,
              options,
            };
            renderModeRef.current = "pixels-worker";
            worker.postMessage(payload);
          });
        return;
      }

      const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        setError("No se pudo leer el canvas de origen.");
        setIsProcessing(false);
        return;
      }
      const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const payload: MosaicWorkerRequest = {
        jobId: currentJobId,
        mode: "pixels",
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        pixels: imageData.data,
        options,
      };
      renderModeRef.current = "pixels-worker";
      worker.postMessage(payload);
      return;
    }

    try {
      renderModeRef.current = "main-thread";
      const palette = renderMosaic(sourceCanvas, mosaicCanvas, options);
      if (!useCustomPalette && palette.length > 0) {
        const nextPalette = normalizePaletteLength(palette.map((color) => rgbToHex(color)), colorCount);
        setCustomPalette((prev) => mergePaletteWithLocks(nextPalette, prev, lockedPalette));
      }
      setIsProcessing(false);
      setGuidedStep((prev) => Math.max(prev, 3));
      commitRenderMetrics("main-thread");
      setError(null);
    } catch {
      setIsProcessing(false);
      setError("No pudimos generar el mosaico.");
    }
  }, [
    commitRenderMetrics,
    colorCount,
    customPalette,
    customPaletteRgb,
    dithering,
    hasImage,
    lockedPalette,
    renderCachedResult,
    showGrout,
    style,
    tileSize,
    useCustomPalette,
  ]);

  useEffect(() => {
    if (!hasImage) {
      return;
    }
    processCurrentImage();
  }, [processCurrentImage, hasImage]);

  const handleSelectFile = useCallback(async (nextFile: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const image = await loadImage(nextFile);
      imageRef.current = image;
      imageSignatureRef.current = `${nextFile.name}-${nextFile.size}-${nextFile.lastModified}`;
      redrawSourceFromImage(quickPreview ? 900 : 1400);
      setShowOriginal(false);
      setHasImage(true);
      setHasExported(false);
      setGuidedStep(2);
    } catch {
      setHasImage(false);
      setError("No pudimos cargar esa imagen. Probá con otra.");
    } finally {
      setIsProcessing(false);
    }
  }, [quickPreview, redrawSourceFromImage]);

  useEffect(() => {
    if (!imageRef.current || !hasImage) {
      return;
    }
    redrawSourceFromImage(quickPreview ? 900 : 1400);
  }, [contrast, cropAspect, hasImage, quickPreview, redrawSourceFromImage, rotation, saturation]);

  useEffect(() => {
    if (!guidedMode) {
      return;
    }

    if (!hasImage) {
      setGuidedStep(1);
      return;
    }
    if (lastRenderMs === null) {
      setGuidedStep(2);
      return;
    }
    if (!hasExported) {
      setGuidedStep(3);
      return;
    }
    setGuidedStep(4);
  }, [guidedMode, hasExported, hasImage, lastRenderMs]);

  const handleDownload = useCallback(() => {
    const mosaicCanvas = mosaicCanvasRef.current;
    if (!mosaicCanvas || !hasImage) {
      return;
    }

    const link = document.createElement("a");
    link.download = "mosaico.png";
    link.href = mosaicCanvas.toDataURL("image/png");
    link.click();
    setHasExported(true);
    setGuidedStep(4);
  }, [hasImage]);

  const handleExportPdf = useCallback(() => {
    const mosaicCanvas = mosaicCanvasRef.current;
    if (!mosaicCanvas || !hasImage) {
      return;
    }

    setIsExportingPdf(true);
    try {
      exportCanvasAsA4Pdf(mosaicCanvas, { fileName: "mosaico-a4.pdf" });
      setHasExported(true);
      setGuidedStep(4);
      setError(null);
    } catch {
      setError("No pudimos generar el PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [hasImage]);

  const handleExportPatternPdf = useCallback(() => {
    const meta = latestMetaRef.current;
    if (!meta) {
      setError("Todavía no hay patrón disponible para exportar.");
      return;
    }

    try {
      exportPatternAsA4Pdf({
        palette: meta.palette,
        tileIndices: meta.tileIndices,
        tileCols: meta.tileCols,
        tileRows: meta.tileRows,
        fileName: "mosaico-patron-a4.pdf",
      });
      setHasExported(true);
      setGuidedStep(4);
      setError(null);
    } catch {
      setError("No pudimos generar el PDF de patrón.");
    }
  }, []);

  const handleReset = useCallback(() => {
    pushHistory();
    applySettings(DEFAULTS);
    setHasExported(false);
    setGuidedStep(1);
  }, [applySettings, pushHistory]);

  const handleUndo = useCallback(() => {
    const next = undoStackRef.current.shift();
    if (!next) {
      return;
    }
    applySettings(next);
  }, [applySettings]);

  const handleSavePalettePreset = useCallback(() => {
    const name = window.prompt("Nombre del preset de paleta:");
    if (!name) {
      return;
    }

    const preset: PalettePreset = {
      name,
      colors: customPalette,
    };

    setPalettePresets((prev) => [preset, ...prev].slice(0, 24));
  }, [customPalette]);

  const handleApplyPreset = useCallback((preset: PalettePreset) => {
    pushHistory();
    setUseCustomPalette(true);
    setCustomPalette(normalizePaletteLength(preset.colors, colorCount));
  }, [colorCount, pushHistory]);

  const handleDeletePreset = useCallback((index: number) => {
    setPalettePresets((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImportPalette = useCallback(async (fileToRead: File) => {
    try {
      const image = await loadImage(fileToRead);
      const temp = document.createElement("canvas");
      temp.width = 200;
      temp.height = 200;
      const context = temp.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("canvas");
      }
      context.drawImage(image, 0, 0, temp.width, temp.height);
      const data = context.getImageData(0, 0, temp.width, temp.height).data;
      const points: RGB[] = [];
      for (let i = 0; i < data.length; i += 4) {
        points.push([data[i], data[i + 1], data[i + 2]]);
      }

      const palette = quantizeColors(points, colorCount).map((rgb) => rgbToHex(rgb));
      pushHistory();
      setUseCustomPalette(true);
      setCustomPalette(normalizePaletteLength(palette, colorCount));
      setError(null);
    } catch {
      setError("No pudimos importar una paleta desde esa foto.");
    }
  }, [colorCount, pushHistory]);

  const handleSaveProject = useCallback(async () => {
    const sourceCanvas = sourceCanvasRef.current;
    if (!sourceCanvas || !hasImage) {
      return;
    }

    setIsSavingProject(true);
    try {
      await saveProject({
        name: `Proyecto ${new Date().toLocaleString()}`,
        createdAt: Date.now(),
        sourceDataUrl: sourceCanvas.toDataURL("image/png"),
        settings: {
          tileSize,
          colorCount,
          showGrout,
          useCustomPalette,
          customPalette,
          dithering,
          style,
          contrast,
          saturation,
          rotation,
          cropAspect,
        },
      });
      setError(null);
    } catch {
      setError("No pudimos guardar el proyecto localmente.");
    } finally {
      setIsSavingProject(false);
    }
  }, [
    colorCount,
    contrast,
    cropAspect,
    customPalette,
    dithering,
    hasImage,
    rotation,
    saturation,
    showGrout,
    style,
    tileSize,
    useCustomPalette,
  ]);

  const handleLoadLatestProject = useCallback(async () => {
    setIsProcessing(true);
    try {
      const latest = await getLatestProject();
      if (!latest) {
        setError("No hay proyectos guardados todavía.");
        setIsProcessing(false);
        return;
      }

      applySettings({
        ...DEFAULTS,
        ...latest.settings,
        customPalette: normalizePaletteLength(latest.settings.customPalette, latest.settings.colorCount),
        lockedPalette: normalizeLocks(DEFAULTS.lockedPalette, latest.settings.colorCount),
      });

      const image = await loadImageFromUrl(latest.sourceDataUrl);
      imageRef.current = image;
      imageSignatureRef.current = `project-${latest.createdAt}`;
      redrawSourceFromImage(quickPreview ? 900 : 1400);
      setHasImage(true);
      setHasExported(false);
      setShowOriginal(false);
      setGuidedStep(2);
      setError(null);
    } catch {
      setError("No pudimos cargar el último proyecto.");
    } finally {
      setIsProcessing(false);
    }
  }, [applySettings, quickPreview, redrawSourceFromImage]);

  const rootClass = [
    "min-h-screen px-4 py-6 sm:px-6",
    highContrast
      ? "bg-black text-white"
      : "bg-[radial-gradient(circle_at_top,_#f2e9d8_0%,_#f4f1eb_40%,_#eef1f3_100%)] text-slate-900",
    largeText ? "text-[18px]" : "text-base",
  ].join(" ");

  const guidedHint = !guidedMode
    ? null
    : !hasImage
      ? "Paso 1: subí una foto."
      : guidedStep < 3
        ? "Paso 2: ajustá tamaño y colores."
        : !hasExported
          ? "Paso 3: descargá PNG o PDF."
          : "Paso 4: proyecto terminado.";

  const renderModeLabel: Record<RenderMode, string> = {
    cache: "cache",
    "bitmap-worker": "worker bitmap",
    "pixels-worker": "worker pixels",
    "main-thread": "main thread",
  };

  return (
    <div className={rootClass}>
      <main className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[390px_1fr]">
        <section className="space-y-5">
          <header className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Mosaico de Foto</p>
            <h1 className="mt-1 text-3xl font-black text-slate-900">Convertí una foto en mosaico</h1>
            <p className="mt-2 text-slate-600">PWA para Android y PC, optimizada para uso simple.</p>
            {guidedMode ? (
              <div className="mt-3 space-y-2">
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  Paso {guidedStep}/4
                </p>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  {guidedHint}
                </p>
              </div>
            ) : null}
            {lastRenderMs !== null ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-700">
                <div className="rounded-lg bg-slate-100 px-2 py-2">Ultimo: {lastRenderMs} ms</div>
                <div className="rounded-lg bg-slate-100 px-2 py-2">Promedio: {avgRenderMs ?? 0} ms</div>
                <div className="rounded-lg bg-slate-100 px-2 py-2">
                  Modo: {lastRenderMode ? renderModeLabel[lastRenderMode] : "-"}
                </div>
              </div>
            ) : null}
          </header>

          <ImageUploader onSelect={handleSelectFile} disabled={isProcessing} />

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => {
                pushHistory();
                setHighContrast((prev) => !prev);
              }}
              className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-semibold text-slate-800"
            >
              {highContrast ? "Contraste normal" : "Alto contraste"}
            </button>
            <button
              type="button"
              onClick={() => {
                pushHistory();
                setLargeText((prev) => !prev);
              }}
              className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-semibold text-slate-800"
            >
              {largeText ? "Texto normal" : "Texto grande"}
            </button>
            <button
              type="button"
              onClick={() => {
                pushHistory();
                setGuidedMode((prev) => !prev);
                setGuidedStep(1);
              }}
              className="col-span-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
            >
              {guidedMode ? "Salir modo guiado" : "Activar modo guiado"}
            </button>
          </div>

          <MosaicControls
            tileSize={tileSize}
            colorCount={colorCount}
            showGrout={showGrout}
            disabled={!hasImage || isProcessing}
            onTileSizeChange={(value) => {
              pushHistory();
              setTileSize(value);
            }}
            onColorCountChange={(value) => {
              pushHistory();
              setColorCount(value);
            }}
            onShowGroutChange={(value) => {
              pushHistory();
              setShowGrout(value);
            }}
          />

          <section className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-xl font-bold text-slate-900">Ajustes pro</h2>
            <div className="grid gap-3">
              <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                Dithering
                <input type="checkbox" checked={dithering} onChange={(e) => { pushHistory(); setDithering(e.target.checked); }} className="h-5 w-5 accent-emerald-600" />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                Estilo irregular
                <input type="checkbox" checked={style === "irregular"} onChange={(e) => { pushHistory(); setStyle(e.target.checked ? "irregular" : "square"); }} className="h-5 w-5 accent-emerald-600" />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                Modo rápido
                <input type="checkbox" checked={quickPreview} onChange={(e) => { pushHistory(); setQuickPreview(e.target.checked); }} className="h-5 w-5 accent-emerald-600" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Contraste: {contrast}%
                <input type="range" min={60} max={160} step={1} value={contrast} onChange={(e) => { pushHistory(); setContrast(Number(e.target.value)); }} className="w-full accent-emerald-600" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Saturación: {saturation}%
                <input type="range" min={60} max={170} step={1} value={saturation} onChange={(e) => { pushHistory(); setSaturation(Number(e.target.value)); }} className="w-full accent-emerald-600" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Rotación: {rotation}°
                <input type="range" min={-25} max={25} step={1} value={rotation} onChange={(e) => { pushHistory(); setRotation(Number(e.target.value)); }} className="w-full accent-emerald-600" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["original", "Original"],
                  ["square", "Cuadrado"],
                  ["portrait", "Retrato"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      pushHistory();
                      setCropAspect(value as CropAspect);
                    }}
                    className={`rounded-xl px-2 py-2 text-sm font-semibold ${cropAspect === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <PaletteEditor
            enabled={useCustomPalette}
            disabled={!hasImage || isProcessing}
            palette={customPalette}
            locked={lockedPalette}
            onToggle={(enabled) => {
              pushHistory();
              setUseCustomPalette(enabled);
            }}
            onToggleLock={(index) => {
              pushHistory();
              setLockedPalette((prev) => {
                const next = [...prev];
                next[index] = !next[index];
                return next;
              });
            }}
            onColorChange={(index, value) => {
              pushHistory();
              setCustomPalette((prev) => {
                const next = [...prev];
                next[index] = value;
                return next;
              });
            }}
          />

          <section className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Presets de paleta</h3>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={handleSavePalettePreset} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Guardar preset</button>
              <button type="button" onClick={() => paletteImportInputRef.current?.click()} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Importar desde foto</button>
              <input
                ref={paletteImportInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const fileToRead = event.target.files?.[0];
                  if (fileToRead) {
                    handleImportPalette(fileToRead);
                  }
                }}
              />
            </div>
            <div className="max-h-32 space-y-1 overflow-auto">
              {palettePresets.length === 0 ? <p className="text-xs text-slate-500">Sin presets guardados.</p> : null}
              {palettePresets.map((preset, index) => (
                <div key={`${preset.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-slate-100 p-2">
                  <button type="button" onClick={() => handleApplyPreset(preset)} className="flex-1 text-left text-sm font-semibold text-slate-800">{preset.name}</button>
                  <button type="button" onClick={() => handleDeletePreset(index)} className="text-xs font-semibold text-red-600">Borrar</button>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button type="button" disabled={!hasImage} onClick={handleDownload} className="rounded-2xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white disabled:bg-slate-400">PNG</button>
            <button type="button" disabled={!hasImage || isExportingPdf} onClick={handleExportPdf} className="rounded-2xl bg-emerald-700 px-3 py-3 text-sm font-semibold text-white disabled:bg-slate-400">{isExportingPdf ? "PDF..." : "PDF A4"}</button>
            <button type="button" disabled={!hasImage} onClick={handleExportPatternPdf} className="rounded-2xl bg-indigo-700 px-3 py-3 text-sm font-semibold text-white disabled:bg-slate-400">Patrón PDF</button>
            <button type="button" disabled={!hasImage || isSavingProject} onClick={handleSaveProject} className="rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-300">{isSavingProject ? "Guardando..." : "Guardar proyecto"}</button>
            <button type="button" onClick={handleLoadLatestProject} className="rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-300">Cargar último</button>
            <button type="button" onClick={handleUndo} className="rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-300">Undo</button>
            <button type="button" onClick={handleReset} className="col-span-2 rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 sm:col-span-1">Reset</button>
            {guidedMode ? (
              <button
                type="button"
                onClick={() => setGuidedStep((prev) => Math.min(4, prev + 1))}
                className="col-span-2 rounded-2xl bg-amber-500 px-3 py-3 text-sm font-semibold text-slate-900 sm:col-span-1"
              >
                Siguiente paso
              </button>
            ) : null}
          </div>

          {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">{error}</p> : null}
        </section>

        <MosaicPreview
          originalRef={originalCanvasRef}
          mosaicRef={mosaicCanvasRef}
          hasImage={hasImage}
          isProcessing={isProcessing}
          showOriginal={showOriginal}
          onToggleView={setShowOriginal}
        />
      </main>

      <canvas ref={sourceCanvasRef} className="hidden" />
    </div>
  );
}
