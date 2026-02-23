"use client";

type PaletteEditorProps = {
  enabled: boolean;
  disabled?: boolean;
  palette: string[];
  locked?: boolean[];
  onToggle: (enabled: boolean) => void;
  onColorChange: (index: number, value: string) => void;
  onToggleLock?: (index: number) => void;
};

export default function PaletteEditor({
  enabled,
  disabled = false,
  palette,
  locked = [],
  onToggle,
  onColorChange,
  onToggleLock,
}: PaletteEditorProps) {
  return (
    <section className="rounded-2xl bg-white/85 p-5 shadow-sm ring-1 ring-slate-200 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">3. Paleta real</h2>
          <p className="text-sm text-slate-600">Usar colores fijos para acercarte a materiales reales.</p>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-5 w-5 accent-emerald-600"
          aria-label="Usar paleta real"
        />
      </div>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {palette.map((value, index) => {
          const isLocked = locked[index] ?? false;
          return (
            <div key={`palette-${index}`} className="flex flex-col items-center gap-1 text-xs text-slate-500">
              <input
                type="color"
                value={value}
                disabled={disabled || !enabled}
                onChange={(event) => onColorChange(index, event.target.value)}
                className="h-10 w-full cursor-pointer rounded border border-slate-300 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Color ${index + 1}`}
              />
              <button
                type="button"
                disabled={disabled || !enabled}
                onClick={() => onToggleLock?.(index)}
                className={`rounded px-1 py-0.5 ${isLocked ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"} disabled:opacity-40`}
                aria-label={`Bloquear color ${index + 1}`}
              >
                {isLocked ? "Fijo" : "Libre"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
