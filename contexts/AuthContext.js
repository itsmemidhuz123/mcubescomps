'use client'

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail
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
      
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          // Fetch user profile from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (mounted) {
              if (userDoc.exists()) {
                setUserProfile(userDoc.data());
              } else {
                // User exists in Auth but not in Firestore - might be new Google user
                setUserProfile(null);
              }
            }
          } catch (firestoreError) {
            console.error('Error fetching user profile:', firestoreError);
            // Set user anyway - they're authenticated even if profile fetch fails
            if (mounted) {
              setAuthError(firestoreError.message);
            }
          }
        } else {
          setUser(null);
          setUserProfile(null);
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Generate WCA-style ID
      const wcaStyleId = await generateWCAId(firstName, lastName);
      
      // Check if admin
      const isAdmin = email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      
      // Create user profile in Firestore
      const userProfile = {
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
      
      await setDoc(doc(db, 'users', user.uid), userProfile);
      setUserProfile(userProfile);
      
      return { user, userProfile };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signIn = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
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
        const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        
        const userProfile = {
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
        
        await setDoc(doc(db, 'users', user.uid), userProfile);
        setUserProfile(userProfile);
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
