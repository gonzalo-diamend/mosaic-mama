"use client";

import { useRef } from "react";

type ImageUploaderProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
};

export default function ImageUploader({ onSelect, disabled = false }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-2xl bg-white/85 p-5 shadow-sm ring-1 ring-slate-200 backdrop-blur">
      <h2 className="mb-3 text-xl font-bold text-slate-900">1. Elegir foto</h2>
      <p className="mb-4 text-sm text-slate-600">Podés subir una imagen o sacar una foto con la cámara.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onSelect(file);
          }
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        Sacar o subir foto
      </button>
    </section>
  );
}
