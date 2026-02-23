"use client";

import type { RefObject } from "react";

type MosaicPreviewProps = {
  originalRef: RefObject<HTMLCanvasElement | null>;
  mosaicRef: RefObject<HTMLCanvasElement | null>;
  hasImage: boolean;
  isProcessing: boolean;
  showOriginal: boolean;
  onToggleView: (value: boolean) => void;
};

export default function MosaicPreview({
  originalRef,
  mosaicRef,
  hasImage,
  isProcessing,
  showOriginal,
  onToggleView,
}: MosaicPreviewProps) {
  if (!hasImage) {
    return (
      <section className="rounded-2xl bg-white/85 p-8 text-center shadow-sm ring-1 ring-slate-200 backdrop-blur">
        <h2 className="mb-2 text-xl font-bold text-slate-900">4. Resultado</h2>
        <p className="text-slate-600">Cuando subas una foto, acá vas a ver el mosaico.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white/85 p-5 shadow-sm ring-1 ring-slate-200 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-900">4. Resultado</h2>
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onToggleView(true)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              showOriginal ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Antes
          </button>
          <button
            type="button"
            onClick={() => onToggleView(false)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              !showOriginal ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Después
          </button>
        </div>
      </div>

      {isProcessing ? <p className="mb-3 text-sm font-semibold text-emerald-700">Procesando...</p> : null}

      <canvas
        ref={originalRef}
        className={`w-full rounded-xl border border-slate-200 bg-white ${showOriginal ? "block" : "hidden"}`}
      />
      <canvas
        ref={mosaicRef}
        className={`w-full rounded-xl border border-slate-200 bg-white ${showOriginal ? "hidden" : "block"}`}
      />
    </section>
  );
}
