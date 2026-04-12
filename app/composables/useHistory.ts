import { openDB, type DBSchema } from "idb";
import { ref, onMounted } from "vue";

export interface HistoryItem {
  id: string; // source + mangaHref
  source: string;
  mangaHref: string;
  mangaTitle: string;
  chapterHref: string;
  chapterTitle: string;
  updatedAt: number;
}

interface MangaDB extends DBSchema {
  history: {
    key: string;
    value: HistoryItem;
    indexes: {
      "by-updated": number;
      "by-source": string;
    };
  };
}

const DB_NAME = "mangaloom-db";
const DB_VERSION = 1;

let dbPromise: Promise<import("idb").IDBPDatabase<MangaDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<MangaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("history")) {
          const store = db.createObjectStore("history", { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
          store.createIndex("by-source", "source");
        }
      },
    });
  }
  return dbPromise;
}

export function useHistory() {
  const history = ref<HistoryItem[]>([]);
  const loading = ref(true);

  async function loadHistory() {
    loading.value = true;
    try {
      const db = await getDB();
      if (!db) return;
      const tx = db.transaction("history", "readonly");
      const store = tx.objectStore("history");
      const index = store.index("by-updated");
      const items = await index.getAll();
      history.value = items.reverse(); // Newest first
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      loading.value = false;
    }
  }

  async function saveHistory(item: Omit<HistoryItem, "updatedAt" | "id">) {
    try {
      const db = await getDB();
      if (!db) return;
      
      const id = `${item.source}-${item.mangaHref}`;
      const historyItem: HistoryItem = {
        ...item,
        id,
        updatedAt: Date.now(),
      };

      await db.put("history", historyItem);
      
      // Update local state if it's already loaded
      const existingIndex = history.value.findIndex(h => h.id === id);
      if (existingIndex >= 0) {
        history.value.splice(existingIndex, 1);
      }
      history.value.unshift(historyItem);
    } catch (error) {
      console.error("Failed to save history", error);
    }
  }

  async function removeHistory(source: string, mangaHref: string) {
    try {
      const db = await getDB();
      if (!db) return;
      
      const id = `${source}-${mangaHref}`;
      await db.delete("history", id);
      
      history.value = history.value.filter(h => h.id !== id);
    } catch (error) {
      console.error("Failed to remove history", error);
    }
  }
  
  async function clearHistory() {
    try {
      const db = await getDB();
      if (!db) return;
      await db.clear("history");
      history.value = [];
    } catch (error) {
      console.error("Failed to clear history", error);
    }
  }

  onMounted(() => {
    loadHistory();
  });

  return {
    history,
    loading,
    loadHistory,
    saveHistory,
    removeHistory,
    clearHistory
  };
}
