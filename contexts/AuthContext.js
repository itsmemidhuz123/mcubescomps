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

  // Set persistence on mount
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .catch((error) => {
        console.error('Failed to set persistence:', error);
      });
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          // Fetch user profile from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (mounted) {
              if (userDoc.exists()) {
                const profileData = userDoc.data();
                setUserProfile(profileData);
                // Store in localStorage for quick access
                localStorage.setItem('userProfile', JSON.stringify(profileData));
              } else {
                // User exists in Auth but not in Firestore
                setUserProfile(null);
                localStorage.removeItem('userProfile');
              }
            }
          } catch (firestoreError) {
            console.error('Error fetching user profile:', firestoreError);
            // Try to get from localStorage
            const cached = localStorage.getItem('userProfile');
            if (cached && mounted) {
              setUserProfile(JSON.parse(cached));
            }
            if (mounted) {
              setAuthError(firestoreError.message);
            }
          }
        } else {
          setUser(null);
          setUserProfile(null);
          localStorage.removeItem('userProfile');
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        if (mounted) {
          setAuthError(error.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signUp = async (email, password, firstName, lastName, country) => {
    try {
      // Set persistence before sign up
      await setPersistence(auth, browserLocalPersistence);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Generate WCA-style ID
      const wcaStyleId = await generateWCAId(firstName, lastName);
      
      // Check if admin
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'midhun.speedcuber@gmail.com';
      const isAdmin = email.toLowerCase() === adminEmail.toLowerCase();
      
      // Create user profile in Firestore
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
        bestSingle: null,
        bestAo5: null,
        totalCompetitions: 0
      };
      
      await setDoc(doc(db, 'users', user.uid), userProfileData);
      setUserProfile(userProfileData);
      localStorage.setItem('userProfile', JSON.stringify(userProfileData));
      
      return { user, userProfile: userProfileData };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signIn = async (email, password) => {
    try {
      // Set persistence before sign in
      await setPersistence(auth, browserLocalPersistence);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch and set user profile
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        const profileData = userDoc.data();
        setUserProfile(profileData);
        localStorage.setItem('userProfile', JSON.stringify(profileData));
      }
      
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Set persistence before sign in
      await setPersistence(auth, browserLocalPersistence);
      
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Create profile for new Google user
        const nameParts = (user.displayName || 'User Name').split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || 'Name';
        
        const wcaStyleId = await generateWCAId(firstName, lastName);
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'midhun.speedcuber@gmail.com';
        const isAdmin = user.email.toLowerCase() === adminEmail.toLowerCase();
        
        const userProfileData = {
          email: user.email,
          role: isAdmin ? 'ADMIN' : 'USER',
          wcaStyleId,
          displayName: user.displayName || wcaStyleId,
          firstName,
          lastName,
          username: wcaStyleId.toLowerCase(),
          country: 'Unknown',
          photoURL: user.photoURL || '',
          createdAt: new Date().toISOString(),
          bestSingle: null,
          bestAo5: null,
          totalCompetitions: 0
        };
        
        await setDoc(doc(db, 'users', user.uid), userProfileData);
        setUserProfile(userProfileData);
        localStorage.setItem('userProfile', JSON.stringify(userProfileData));
      } else {
        const profileData = userDoc.data();
        setUserProfile(profileData);
        localStorage.setItem('userProfile', JSON.stringify(profileData));
      }
      
      return user;
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
      localStorage.removeItem('userProfile');
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
