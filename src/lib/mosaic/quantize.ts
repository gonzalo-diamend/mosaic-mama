export type RGB = [number, number, number];

function squaredDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function nearestCentroidIndex(color: RGB, centroids: RGB[]): number {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < centroids.length; i += 1) {
    const distance = squaredDistance(color, centroids[i]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

export function nearestPaletteColor(color: RGB, palette: RGB[]): RGB {
  if (palette.length === 0) {
    return color;
  }

  const index = nearestCentroidIndex(color, palette);
  return palette[index];
}

export function quantizeColors(points: RGB[], colorCount: number, maxIterations = 10): RGB[] {
  if (points.length === 0) {
    return [];
  }

  const k = Math.max(1, Math.min(colorCount, points.length));
  const centroids: RGB[] = [];
  const seedStep = Math.max(1, Math.floor(points.length / k));

  for (let i = 0; i < k; i += 1) {
    const seed = points[(i * seedStep) % points.length];
    centroids.push([seed[0], seed[1], seed[2]]);
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const sums = new Array(k).fill(null).map(() => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (const point of points) {
      const index = nearestCentroidIndex(point, centroids);
      sums[index][0] += point[0];
      sums[index][1] += point[1];
      sums[index][2] += point[2];
      counts[index] += 1;
    }

    let changed = false;

    for (let i = 0; i < k; i += 1) {
      if (counts[i] === 0) {
        const fallback = points[(i * 997) % points.length];
        centroids[i] = [fallback[0], fallback[1], fallback[2]];
        changed = true;
        continue;
      }

      const next: RGB = [
        Math.round(sums[i][0] / counts[i]),
        Math.round(sums[i][1] / counts[i]),
        Math.round(sums[i][2] / counts[i]),
      ];

      if (squaredDistance(next, centroids[i]) > 0) {
        changed = true;
      }

      centroids[i] = next;
    }

    if (!changed) {
      break;
    }
  }

  return centroids;
}
