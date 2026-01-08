import { openDB, DBSchema } from 'idb';
import { Dataset, DashboardPage } from '../types';

interface ExcelDB extends DBSchema {
  datasets: {
    key: string;
    value: Dataset;
  };
  pages: {
    key: string;
    value: DashboardPage;
  };
}

const DB_NAME = 'excel-analyst-db';
const DATASET_STORE = 'datasets';
const PAGE_STORE = 'pages';

// Initialize DB
const dbPromise = openDB<ExcelDB>(DB_NAME, 2, { // Bumped version to 2
  upgrade(db, oldVersion, newVersion, transaction) {
    if (!db.objectStoreNames.contains(DATASET_STORE)) {
      db.createObjectStore(DATASET_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(PAGE_STORE)) {
      db.createObjectStore(PAGE_STORE, { keyPath: 'id' });
    }
  },
});

// --- Dataset Operations ---

export const saveDatasetToDB = async (dataset: Dataset) => {
  try {
    const db = await dbPromise;
    await db.put(DATASET_STORE, dataset);
    return true;
  } catch (error) {
    console.error("Failed to save dataset", error);
    return false;
  }
};

export const getAllDatasetsFromDB = async (): Promise<Dataset[]> => {
  try {
    const db = await dbPromise;
    const datasets = await db.getAll(DATASET_STORE);
    return datasets.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Failed to get datasets", error);
    return [];
  }
};

export const deleteDatasetFromDB = async (id: string) => {
  try {
    const db = await dbPromise;
    await db.delete(DATASET_STORE, id);
    return true;
  } catch (error) {
    console.error("Failed to delete dataset", error);
    return false;
  }
};

// --- Page Operations ---

export const savePageToDB = async (page: DashboardPage) => {
  try {
    const db = await dbPromise;
    await db.put(PAGE_STORE, page);
    return true;
  } catch (error) {
    console.error("Failed to save page", error);
    return false;
  }
};

export const getAllPagesFromDB = async (): Promise<DashboardPage[]> => {
  try {
    const db = await dbPromise;
    const pages = await db.getAll(PAGE_STORE);
    return pages.sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error("Failed to get pages", error);
    return [];
  }
};

export const deletePageFromDB = async (id: string) => {
  try {
    const db = await dbPromise;
    await db.delete(PAGE_STORE, id);
    return true;
  } catch (error) {
    console.error("Failed to delete page", error);
    return false;
  }
};