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
    browserSessionPersistence,
    setPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
                                localStorage.removeItem('mcubes_session_id');
                                setAuthError('Your account has been suspended.');
                                return;
                            }

                            // SINGLE DEVICE SESSION CHECK
                            const currentSessionId = localStorage.getItem('mcubes_session_id');
                            const storedSessionId = profileData.currentSessionId;

                            if (storedSessionId && currentSessionId && currentSessionId !== storedSessionId) {
                                await firebaseSignOut(auth);
                                setUser(null);
                                setUserProfile(null);
                                localStorage.removeItem('mcubes_profile');
                                localStorage.removeItem('mcubes_session_id');
                                setAuthError('You have been logged out because you signed in from another device.');
                                return;
                            }

                            setUserProfile(profileData);
                            localStorage.setItem('mcubes_profile', JSON.stringify(profileData));
                        } else {
                            // User doesn't exist in Firestore - create profile
                            const isAdmin = firebaseUser.email?.toLowerCase() === 'midhun.speedcuber@gmail.com';
                            const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                            const wcaStyleId = await generateWCAId(displayName.split(' ')[0] || 'User', displayName.split(' ')[1] || 'Name');

                            const sessionId = localStorage.getItem('mcubes_session_id') || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                            localStorage.setItem('mcubes_session_id', sessionId);

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
                                status: 'ACTIVE',
                                currentSessionId: sessionId,
                                lastLoginAt: serverTimestamp()
                            };

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
                localStorage.removeItem('mcubes_session_id');
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

            const wcaStyleId = await generateWCAId(firstName, lastName);

            const isAdmin = email.toLowerCase() === 'midhun.speedcuber@gmail.com';

            const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('mcubes_session_id', sessionId);

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
                totalCompetitions: 0,
                currentSessionId: sessionId,
                lastLoginAt: serverTimestamp()
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

    const signIn = async (email, password, rememberMe = true) => {
        try {
            if (rememberMe) {
                await setPersistence(auth, browserLocalPersistence);
            } else {
                await setPersistence(auth, browserSessionPersistence);
            }
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('mcubes_session_id', sessionId);

            await updateDoc(doc(db, 'users', userCredential.user.uid), {
                currentSessionId: sessionId,
                lastLoginAt: serverTimestamp()
            });

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

            const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('mcubes_session_id', sessionId);

            try {
                await updateDoc(doc(db, 'users', userCredential.user.uid), {
                    currentSessionId: sessionId,
                    lastLoginAt: serverTimestamp()
                });
            } catch (e) {
                console.warn('Could not update session for Google sign in:', e.message);
            }

            return userCredential.user;
        } catch (error) {
            console.error('Google sign in error:', error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            if (user) {
                try {
                    await updateDoc(doc(db, 'users', user.uid), {
                        currentSessionId: null
                    });
                } catch (e) {
                    console.warn('Could not clear session on sign out:', e.message);
                }
            }
            await firebaseSignOut(auth);
            setUser(null);
            setUserProfile(null);
            localStorage.removeItem('mcubes_profile');
            localStorage.removeItem('mcubes_session_id');
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
        isAdmin: userProfile?.role === 'ADMIN' || userProfile?.role === 'admin'
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}