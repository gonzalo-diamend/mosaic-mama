export type StoredProject = {
  id?: number;
  name: string;
  createdAt: number;
  sourceDataUrl: string;
  settings: {
    tileSize: number;
    colorCount: number;
    showGrout: boolean;
    useCustomPalette: boolean;
    customPalette: string[];
    dithering: boolean;
    style: "square" | "irregular";
    contrast: number;
    saturation: number;
    rotation: number;
    cropAspect: "original" | "square" | "portrait";
  };
};

const DB_NAME = "mosaic-mama-db";
const STORE_NAME = "projects";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProject(project: StoredProject): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(project);

    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function listProjects(limit = 20): Promise<StoredProject[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const rows = (req.result as StoredProject[]).sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows.slice(0, limit));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getLatestProject(): Promise<StoredProject | null> {
  const projects = await listProjects(1);
  return projects[0] ?? null;
}
