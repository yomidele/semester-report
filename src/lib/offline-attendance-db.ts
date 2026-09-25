// Minimal IndexedDB wrapper for offline attendance marking. No extra
// dependency — just the browser's built-in IndexedDB — so it works from a
// cold load with zero network, as long as the page shell itself was cached
// by the service worker (see public/sw.js) on a previous online visit.
//
// Two stores:
//  - "roster"  — the last-synced class roster + today's attendance, cached
//                on every successful online load so it's available offline.
//  - "outbox"  — attendance marks made while offline (or while a save
//                request failed), waiting to be pushed to Supabase.

const DB_NAME = "attendance-offline";
const DB_VERSION = 1;
const ROSTER_STORE = "roster";
const OUTBOX_STORE = "outbox";

export interface RosterCache {
  class_arm_id: string;
  cached_at: string;
  students: { id: string; full_name: string }[];
  marks: Record<string, { status: string; notes: string | null }>;
}

export interface OutboxEntry {
  key: string; // `${class_arm_id}:${student_id}:${attendance_date}`
  class_arm_id: string;
  student_id: string;
  session_id: string;
  term: string;
  attendance_date: string;
  status: string;
  notes: string | null;
  marked_by: string | null;
  queued_at: string;
}

function isSupported() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isSupported()) { reject(new Error("IndexedDB not available in this browser")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROSTER_STORE)) db.createObjectStore(ROSTER_STORE, { keyPath: "class_arm_id" });
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveRosterCache(cache: RosterCache): Promise<void> {
  if (!isSupported()) return;
  await withStore(ROSTER_STORE, "readwrite", (s) => s.put(cache));
}

export async function loadRosterCache(class_arm_id: string): Promise<RosterCache | undefined> {
  if (!isSupported()) return undefined;
  return withStore<RosterCache | undefined>(ROSTER_STORE, "readonly", (s) => s.get(class_arm_id));
}

export async function queueAttendanceMark(entry: OutboxEntry): Promise<void> {
  if (!isSupported()) throw new Error("Offline storage isn't available in this browser");
  await withStore(OUTBOX_STORE, "readwrite", (s) => s.put(entry));
}

export async function listQueuedMarks(): Promise<OutboxEntry[]> {
  if (!isSupported()) return [];
  return withStore<OutboxEntry[]>(OUTBOX_STORE, "readonly", (s) => s.getAll());
}

export async function listQueuedMarksForClass(class_arm_id: string): Promise<OutboxEntry[]> {
  const all = await listQueuedMarks();
  return all.filter((e) => e.class_arm_id === class_arm_id);
}

export async function removeQueuedMark(key: string): Promise<void> {
  if (!isSupported()) return;
  await withStore(OUTBOX_STORE, "readwrite", (s) => s.delete(key));
}

export async function countQueuedMarks(): Promise<number> {
  const all = await listQueuedMarks();
  return all.length;
}
