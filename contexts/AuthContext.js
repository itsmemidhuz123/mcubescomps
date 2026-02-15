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
            const parsed = JSON.parse(cachedProfile);
            if (parsed.uid === firebaseUser.uid) {
              setUserProfile(parsed);
            }
          } catch (e) {
            console.error('Failed to parse cached profile');
          }
        }
        
        // Then try to fetch from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (mounted) {
            if (userDoc.exists()) {
              const profileData = { ...userDoc.data(), uid: firebaseUser.uid };
              
              // SUSPENSION CHECK
              if (profileData.status === 'SUSPENDED') {
                await firebaseSignOut(auth);
                setUser(null);
                setUserProfile(null);
                localStorage.removeItem('mcubes_profile');
                setAuthError('Your account has been suspended.');
                return;
              }

              setUserProfile(profileData);
              localStorage.setItem('mcubes_profile', JSON.stringify(profileData));
            } else {
              // User doesn't exist in Firestore - create profile
              const isAdmin = firebaseUser.email?.toLowerCase() === 'midhun.speedcuber@gmail.com';
              const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
              const wcaStyleId = await generateWCAId(displayName.split(' ')[0] || 'User', displayName.split(' ')[1] || 'Name');
              
              const newProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: displayName,
                photoURL: firebaseUser.photoURL || '',
                role: isAdmin ? 'ADMIN' : 'USER',
                wcaStyleId: wcaStyleId,
                wcaId: '',
                country: 'Unknown',
                createdAt: new Date().toISOString(),
                totalCompetitions: 0,
                status: 'ACTIVE'
              };
              
              // FORCE SAVE to ensure Admin Stats picks it up
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              setUserProfile(newProfile);
              localStorage.setItem('mcubes_profile', JSON.stringify(newProfile));
            }
          }
        } catch (firestoreError) {
          console.warn('Could not fetch/create profile from Firestore:', firestoreError.message);
          // Create minimal profile for offline use
          if (mounted && !userProfile) {
            const minimalProfile = {
              uid: firebaseUser.uid,
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

  const signUp = async (email, password, firstName, lastName, country, wcaId = '') => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Generate WCA-style ID
      const wcaStyleId = await generateWCAId(firstName, lastName);
      
      // Check if admin
      const isAdmin = email.toLowerCase() === 'midhun.speedcuber@gmail.com';
      
      // Create user profile
      const userProfileData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: isAdmin ? 'ADMIN' : 'USER',
        wcaStyleId,
        wcaId: wcaId || '',
        displayName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        username: wcaStyleId.toLowerCase(),
        country: country || 'Unknown',
        photoURL: firebaseUser.photoURL || '',
        createdAt: new Date().toISOString(),
        totalCompetitions: 0
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);
      setUserProfile(userProfileData);
      localStorage.setItem('mcubes_profile', JSON.stringify(userProfileData));
      
      return { user: firebaseUser, userProfile: userProfileData };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signIn = async (email, password) => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
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
      return userCredential.user;
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

  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      // First check if document exists
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Create the document first
        const newProfile = {
          uid: user.uid,
          email: user.email,
          displayName: updates.displayName || user.displayName || 'User',
          role: user.email?.toLowerCase() === 'midhun.speedcuber@gmail.com' ? 'ADMIN' : 'USER',
          createdAt: new Date().toISOString(),
          ...updates
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
        localStorage.setItem('mcubes_profile', JSON.stringify(newProfile));
        return newProfile;
      } else {
        // Update existing document
        const currentData = userDoc.data();
        const updatedProfile = { ...currentData, ...updates, uid: user.uid };
        await setDoc(userRef, updatedProfile, { merge: true });
        setUserProfile(updatedProfile);
        localStorage.setItem('mcubes_profile', JSON.stringify(updatedProfile));
        return updatedProfile;
      }
    } catch (error) {
      console.error('Update profile error:', error);
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
    updateProfile,
    isAdmin: userProfile?.role === 'ADMIN'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
