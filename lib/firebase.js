import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAvkA4-zCoBqwwgsenGyzJGzsRkwtF73co",
  authDomain: "mcubes-otp.firebaseapp.com",
  databaseURL: "https://mcubes-otp.firebaseio.com",
  projectId: "mcubes-otp",
  storageBucket: "mcubes-otp.appspot.com",
  messagingSenderId: "328685645463",
  appId: "1:328685645463:web:5ead7bc6c09241c4b503d2",
  measurementId: "G-48P21MMXXC"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
