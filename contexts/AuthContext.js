'use client'

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { generateWCAId } from '@/lib/wcaId';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Try to get profile from localStorage first (fast)
        const cachedProfile = localStorage.getItem('mcubes_profile');
        if (cachedProfile) {
          try {
            setUserProfile(JSON.parse(cachedProfile));
          } catch (e) {
            console.error('Failed to parse cached profile');
          }
        }
        
        // Then try to fetch from Firestore (might fail if offline)
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (mounted && userDoc.exists()) {
            const profileData = userDoc.data();
            setUserProfile(profileData);
            localStorage.setItem('mcubes_profile', JSON.stringify(profileData));
          }
        } catch (firestoreError) {
          console.warn('Could not fetch profile from Firestore:', firestoreError.message);
          // Continue with cached profile or create minimal profile
          if (!cachedProfile && mounted) {
            const minimalProfile = {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: firebaseUser.email?.toLowerCase() === 'midhun.speedcuber@gmail.com' ? 'ADMIN' : 'USER'
            };
            setUserProfile(minimalProfile);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
        localStorage.removeItem('mcubes_profile');
      }
      
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signUp = async (email, password, firstName, lastName, country) => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Generate WCA-style ID
      const wcaStyleId = await generateWCAId(firstName, lastName);
      
      // Check if admin
      const isAdmin = email.toLowerCase() === 'midhun.speedcuber@gmail.com';
      
      // Create user profile
      const userProfileData = {
        email: user.email,
        role: isAdmin ? 'ADMIN' : 'USER',
        wcaStyleId,
        displayName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        username: wcaStyleId.toLowerCase(),
        country: country || 'Unknown',
        photoURL: user.photoURL || '',
        createdAt: new Date().toISOString(),
        totalCompetitions: 0
      };
      
      // Try to save to Firestore
      try {
        await setDoc(doc(db, 'users', user.uid), userProfileData);
      } catch (e) {
        console.warn('Could not save profile to Firestore:', e.message);
      }
      
      // Always save to localStorage
      setUserProfile(userProfileData);
      localStorage.setItem('mcubes_profile', JSON.stringify(userProfileData));
      
      return { user, userProfile: userProfileData };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signIn = async (email, password) => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Create a basic profile immediately
      const basicProfile = {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        role: firebaseUser.email?.toLowerCase() === 'midhun.speedcuber@gmail.com' ? 'ADMIN' : 'USER'
      };
      
      setUserProfile(basicProfile);
      localStorage.setItem('mcubes_profile', JSON.stringify(basicProfile));
      
      // Try to get full profile from Firestore (non-blocking)
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const fullProfile = userDoc.data();
          setUserProfile(fullProfile);
          localStorage.setItem('mcubes_profile', JSON.stringify(fullProfile));
        }
      } catch (e) {
        console.warn('Could not fetch full profile:', e.message);
      }
      
      return firebaseUser;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;
      
      // Create basic profile immediately
      const basicProfile = {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || 'User',
        photoURL: firebaseUser.photoURL || '',
        role: firebaseUser.email?.toLowerCase() === 'midhun.speedcuber@gmail.com' ? 'ADMIN' : 'USER'
      };
      
      setUserProfile(basicProfile);
      localStorage.setItem('mcubes_profile', JSON.stringify(basicProfile));
      
      // Try to get/create Firestore profile
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        
        if (userDoc.exists()) {
          const fullProfile = userDoc.data();
          setUserProfile(fullProfile);
          localStorage.setItem('mcubes_profile', JSON.stringify(fullProfile));
        } else {
          // Create new profile for Google user
          const nameParts = (firebaseUser.displayName || 'User Name').split(' ');
          const firstName = nameParts[0] || 'User';
          const lastName = nameParts.slice(1).join(' ') || 'Name';
          const wcaStyleId = await generateWCAId(firstName, lastName);
          
          const newProfile = {
            ...basicProfile,
            wcaStyleId,
            firstName,
            lastName,
            username: wcaStyleId.toLowerCase(),
            country: 'Unknown',
            createdAt: new Date().toISOString(),
            totalCompetitions: 0
          };
          
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setUserProfile(newProfile);
          localStorage.setItem('mcubes_profile', JSON.stringify(newProfile));
        }
      } catch (e) {
        console.warn('Firestore error during Google sign in:', e.message);
      }
      
      return firebaseUser;
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      localStorage.removeItem('mcubes_profile');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    authError,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    isAdmin: userProfile?.role === 'ADMIN'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
