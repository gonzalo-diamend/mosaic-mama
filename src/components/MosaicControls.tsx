"use client";

type MosaicControlsProps = {
  tileSize: number;
  colorCount: number;
  showGrout: boolean;
  disabled?: boolean;
  onTileSizeChange: (value: number) => void;
  onColorCountChange: (value: number) => void;
  onShowGroutChange: (value: boolean) => void;
};

const colorOptions = [6, 10, 16, 24];

export default function MosaicControls({
  tileSize,
  colorCount,
  showGrout,
  disabled = false,
  onTileSizeChange,
  onColorCountChange,
  onShowGroutChange,
}: MosaicControlsProps) {
  return (
    <section className="rounded-2xl bg-white/85 p-5 shadow-sm ring-1 ring-slate-200 backdrop-blur">
      <h2 className="mb-4 text-xl font-bold text-slate-900">2. Ajustes del mosaico</h2>

      <label className="mb-3 block text-base font-semibold text-slate-700" htmlFor="tile-size">
        Tamaño de tesela: <span className="text-slate-900">{tileSize}</span>
      </label>
      <input
        id="tile-size"
        type="range"
        min={4}
        max={50}
        step={1}
        value={tileSize}
        disabled={disabled}
        onChange={(event) => onTileSizeChange(Number(event.target.value))}
        className="mb-6 w-full accent-emerald-600"
      />

      <p className="mb-2 text-base font-semibold text-slate-700">Cantidad de colores</p>
      <div className="mb-6 grid grid-cols-4 gap-2">
        {colorOptions.map((option) => {
          const isActive = colorCount === option;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onColorCountChange(option)}
              className={`rounded-xl px-3 py-3 text-lg font-semibold transition ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200"
              } disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <label className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-base font-semibold text-slate-800">
        Mostrar líneas de junta
        <input
          type="checkbox"
          checked={showGrout}
          disabled={disabled}
          onChange={(event) => onShowGroutChange(event.target.checked)}
          className="h-5 w-5 accent-emerald-600"
        />
      </label>
    </section>
  );
}
