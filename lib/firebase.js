import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBUH2hL2lR-nNi2jnWQWeeX00z8N-MQqO0",
  authDomain: "texcads-670e0.firebaseapp.com",
  databaseURL: "https://texcads-670e0-default-rtdb.firebaseio.com",
  projectId: "texcads-670e0",
  storageBucket: "texcads-670e0.firebasestorage.app",
  messagingSenderId: "586899233238",
  appId: "1:586899233238:web:9dbee74e14cd95f23f2c77"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// Initialize Firestore with persistent cache for offline support
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);

export default app;
