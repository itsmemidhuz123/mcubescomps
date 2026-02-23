const DB_NAME = 'mcubes_timer';
const DB_VERSION = 1;

const STORES = {
    SESSIONS: 'timerSessions',
    SOLVES: 'timerSolves',
    SETTINGS: 'timerSettings'
};

let dbInstance = null;

const initDB = () => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
                const sessionsStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'sessionId' });
                sessionsStore.createIndex('eventId', 'eventId', { unique: false });
                sessionsStore.createIndex('userId', 'userId', { unique: false });
                sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.SOLVES)) {
                const solvesStore = db.createObjectStore(STORES.SOLVES, { keyPath: 'id', autoIncrement: true });
                solvesStore.createIndex('sessionId', 'sessionId', { unique: false });
                solvesStore.createIndex('eventId', 'eventId', { unique: false });
                solvesStore.createIndex('createdAt', 'createdAt', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }
        };
    });
};

const getStore = async (storeName, mode = 'readonly') => {
    const db = await initDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
};

export const saveSession = async (session) => {
    const store = await getStore(STORES.SESSIONS, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put({
            ...session,
            updatedAt: Date.now()
        });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getSession = async (sessionId) => {
    const store = await getStore(STORES.SESSIONS);
    return new Promise((resolve, reject) => {
        const request = store.get(sessionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getSessionsByEvent = async (eventId) => {
    const store = await getStore(STORES.SESSIONS);
    const index = store.index('eventId');
    return new Promise((resolve, reject) => {
        const request = index.getAll(eventId);
        request.onsuccess = () => {
            const sessions = request.result || [];
            sessions.sort((a, b) => b.updatedAt - a.updatedAt);
            resolve(sessions);
        };
        request.onerror = () => reject(request.error);
    });
};

export const getLatestSession = async (eventId) => {
    const sessions = await getSessionsByEvent(eventId);
    return sessions[0] || null;
};

export const deleteSession = async (sessionId) => {
    const store = await getStore(STORES.SESSIONS, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(sessionId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getAllSessions = async () => {
    const store = await getStore(STORES.SESSIONS);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const saveSetting = async (key, value) => {
    const store = await getStore(STORES.SETTINGS, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put({ key, value });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getSetting = async (key, defaultValue = null) => {
    const store = await getStore(STORES.SETTINGS);
    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.value ?? defaultValue);
        request.onerror = () => reject(request.error);
    });
};

export const clearAllTimerData = async () => {
    const db = await initDB();
    const transaction = db.transaction([STORES.SESSIONS, STORES.SOLVES, STORES.SETTINGS], 'readwrite');

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        transaction.objectStore(STORES.SESSIONS).clear();
        transaction.objectStore(STORES.SOLVES).clear();
        transaction.objectStore(STORES.SETTINGS).clear();
    });
};

export const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};