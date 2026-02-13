'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
let app;
let auth;
let db;
let storage;

if (typeof window !== 'undefined') {
  // Client-side initialization
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  // Server-side - initialize without persistence
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { auth, db, storage };
export default app;
