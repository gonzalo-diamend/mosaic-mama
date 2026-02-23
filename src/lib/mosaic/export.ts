import { jsPDF } from "jspdf";
import type { RGB } from "./quantize";

type PdfOptions = {
  fileName?: string;
  marginMm?: number;
};

function canvasSlice(source: HTMLCanvasElement, y: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo inicializar el canvas para PDF.");
  }

  context.drawImage(source, 0, y, source.width, height, 0, 0, source.width, height);
  return canvas;
}

export function exportCanvasAsA4Pdf(sourceCanvas: HTMLCanvasElement, options: PdfOptions = {}): void {
  const marginMm = options.marginMm ?? 10;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const availableWidthMm = pageWidthMm - marginMm * 2;
  const availableHeightMm = pageHeightMm - marginMm * 2;

  const mmPerPixel = availableWidthMm / sourceCanvas.width;
  const pagePixelHeight = Math.max(1, Math.floor(availableHeightMm / mmPerPixel));

  let y = 0;
  let pageNumber = 0;

  while (y < sourceCanvas.height) {
    if (pageNumber > 0) {
      pdf.addPage("a4", "portrait");
    }

    const sliceHeight = Math.min(pagePixelHeight, sourceCanvas.height - y);
    const slice = canvasSlice(sourceCanvas, y, sliceHeight);
    const dataUrl = slice.toDataURL("image/png");
    const renderHeightMm = sliceHeight * mmPerPixel;

    pdf.addImage(dataUrl, "PNG", marginMm, marginMm, availableWidthMm, renderHeightMm, undefined, "FAST");
    y += sliceHeight;
    pageNumber += 1;
  }

  pdf.save(options.fileName ?? "mosaico-a4.pdf");
}

type PatternPdfOptions = {
  fileName?: string;
  palette: RGB[];
  tileIndices: number[];
  tileCols: number;
  tileRows: number;
  startNumberAt?: number;
};

function rgbToHex([r, g, b]: RGB): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function exportPatternAsA4Pdf(options: PatternPdfOptions): void {
  const {
    fileName = "mosaico-patron-a4.pdf",
    palette,
    tileIndices,
    tileCols,
    tileRows,
    startNumberAt = 1,
  } = options;

  if (tileCols <= 0 || tileRows <= 0 || tileIndices.length === 0) {
    throw new Error("No hay datos de patrón para exportar.");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const marginMm = 10;
  const legendWidthMm = 38;
  const gridWidthMm = pageWidthMm - marginMm * 2 - legendWidthMm - 4;
  const gridHeightMm = pageHeightMm - marginMm * 2;

  const cellSizeMm = Math.min(6, Math.max(2.4, Math.min(gridWidthMm / tileCols, gridHeightMm / tileRows)));
  const colsPerPage = Math.max(1, Math.floor(gridWidthMm / cellSizeMm));
  const rowsPerPage = Math.max(1, Math.floor(gridHeightMm / cellSizeMm));
  const pagesX = Math.ceil(tileCols / colsPerPage);
  const pagesY = Math.ceil(tileRows / rowsPerPage);

  const usage = new Array(palette.length).fill(0);
  for (const index of tileIndices) {
    if (index >= 0 && index < usage.length) {
      usage[index] += 1;
    }
  }

  let pageCounter = 0;
  for (let py = 0; py < pagesY; py += 1) {
    for (let px = 0; px < pagesX; px += 1) {
      if (pageCounter > 0) {
        pdf.addPage("a4", "portrait");
      }
      pageCounter += 1;

      const startCol = px * colsPerPage;
      const startRow = py * rowsPerPage;
      const endCol = Math.min(startCol + colsPerPage, tileCols);
      const endRow = Math.min(startRow + rowsPerPage, tileRows);
      const visibleCols = endCol - startCol;
      const visibleRows = endRow - startRow;

      const offsetX = marginMm;
      const offsetY = marginMm;
      const pageGridWidth = visibleCols * cellSizeMm;
      const pageGridHeight = visibleRows * cellSizeMm;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`Patron mosaico - hoja ${pageCounter}/${pagesX * pagesY}`, marginMm, 7);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(`Rango: col ${startCol + 1}-${endCol}, fila ${startRow + 1}-${endRow}`, marginMm, 12);

      for (let row = startRow; row < endRow; row += 1) {
        for (let col = startCol; col < endCol; col += 1) {
          const localX = col - startCol;
          const localY = row - startRow;
          const x = offsetX + localX * cellSizeMm;
          const y = offsetY + localY * cellSizeMm;
          const tileIndex = row * tileCols + col;
          const colorIndex = tileIndices[tileIndex] ?? 0;
          const color = palette[colorIndex] ?? [204, 204, 204];
          const number = colorIndex + startNumberAt;

          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.rect(x, y, cellSizeMm, cellSizeMm, "F");
          pdf.setDrawColor(120);
          pdf.rect(x, y, cellSizeMm, cellSizeMm, "S");

          pdf.setTextColor(20, 20, 20);
          pdf.setFontSize(6);
          pdf.text(String(number), x + cellSizeMm / 2, y + cellSizeMm / 2 + 1.8, { align: "center" });
        }
      }

      const legendX = offsetX + pageGridWidth + 4;
      const legendY = offsetY + 2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Leyenda", legendX, legendY);

      let legendCursorY = legendY + 4;
      for (let i = 0; i < palette.length; i += 1) {
        if (legendCursorY > pageHeightMm - marginMm - 2) {
          break;
        }
        const color = palette[i];
        const hex = rgbToHex(color);
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(legendX, legendCursorY - 2.5, 5, 5, "F");
        pdf.setDrawColor(120);
        pdf.rect(legendX, legendCursorY - 2.5, 5, 5, "S");

        pdf.setTextColor(10, 10, 10);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.text(`${i + startNumberAt}. ${hex} (${usage[i] ?? 0})`, legendX + 7, legendCursorY + 1);
        legendCursorY += 6;
      }

      pdf.setDrawColor(0);
      pdf.rect(offsetX, offsetY, pageGridWidth, pageGridHeight, "S");
    }
  }

  pdf.save(fileName);
}
