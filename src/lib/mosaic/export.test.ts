import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfInstances: Array<Record<string, ReturnType<typeof vi.fn>>> = [];

vi.mock("jspdf", () => {
  const JsPdfMock = vi.fn(function JsPdfMock() {
    const instance = {
      addPage: vi.fn(),
      addImage: vi.fn(),
      save: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      text: vi.fn(),
      setFillColor: vi.fn(),
      rect: vi.fn(),
      setDrawColor: vi.fn(),
      setTextColor: vi.fn(),
    };
    pdfInstances.push(instance);
    return instance;
  });

  return {
    jsPDF: JsPdfMock,
  };
});

import { exportCanvasAsA4Pdf, exportPatternAsA4Pdf } from "./export";

function createFakeCanvas(width: number, height: number): HTMLCanvasElement {
  const context = {
    drawImage: vi.fn(),
  };

  return {
    width,
    height,
    getContext: vi.fn(() => context),
    toDataURL: vi.fn(() => "data:image/png;base64,fake"),
  } as unknown as HTMLCanvasElement;
}

describe("export pdf", () => {
  beforeEach(() => {
    pdfInstances.length = 0;

    const fakeDocument = {
      createElement: vi.fn(() => createFakeCanvas(1, 1)),
    };
    (globalThis as { document?: object }).document = fakeDocument;
  });

  it("paginates tall canvas for A4 export", () => {
    const source = createFakeCanvas(1000, 5000);

    exportCanvasAsA4Pdf(source, { fileName: "test-a4.pdf" });

    const pdf = pdfInstances.at(-1);
    expect(pdf).toBeTruthy();
    expect(pdf?.addImage).toHaveBeenCalledTimes(4);
    expect(pdf?.addPage).toHaveBeenCalledTimes(3);
    expect(pdf?.save).toHaveBeenCalledWith("test-a4.pdf");
  });

  it("generates pattern pdf with legend and multiple pages", () => {
    const tileCols = 80;
    const tileRows = 120;
    const tileIndices = new Array(tileCols * tileRows).fill(0).map((_, i) => i % 4);

    exportPatternAsA4Pdf({
      fileName: "pattern.pdf",
      palette: [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0],
      ],
      tileIndices,
      tileCols,
      tileRows,
    });

    const pdf = pdfInstances.at(-1);
    expect(pdf).toBeTruthy();
    expect(pdf?.addPage).toHaveBeenCalled();
    expect(pdf?.text).toHaveBeenCalledWith(expect.stringContaining("Leyenda"), expect.any(Number), expect.any(Number));
    expect(pdf?.save).toHaveBeenCalledWith("pattern.pdf");
  });

  it("throws if pattern metadata is empty", () => {
    expect(() =>
      exportPatternAsA4Pdf({
        palette: [[255, 0, 0]],
        tileIndices: [],
        tileCols: 0,
        tileRows: 0,
      }),
    ).toThrow("No hay datos de patrón para exportar.");
  });
});
