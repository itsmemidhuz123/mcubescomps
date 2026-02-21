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

const ROLE_LEVELS = {
    USER: 0,
    SUPPORT: 1,
    MODERATOR: 2,
    ADMIN: 3,
    SUPER_ADMIN: 4
};

const DEFAULT_PERMISSIONS = {
    USER: {
        canCreateCompetition: false,
        canManageResults: false,
        canVerifyVideo: false,
        canPromoteRound: false,
        canBanUser: false,
        canViewPayments: false,
        canAccessAuditLogs: false,
        canAssignRoles: false,
        canDeleteCompetition: false,
        canAccessSettings: false
    },
    SUPPORT: {
        canCreateCompetition: false,
        canManageResults: false,
        canVerifyVideo: false,
        canPromoteRound: false,
        canBanUser: false,
        canViewPayments: true,
        canAccessAuditLogs: false,
        canAssignRoles: false,
        canDeleteCompetition: false,
        canAccessSettings: false
    },
    MODERATOR: {
        canCreateCompetition: false,
        canManageResults: true,
        canVerifyVideo: true,
        canPromoteRound: false,
        canBanUser: false,
        canViewPayments: false,
        canAccessAuditLogs: false,
        canAssignRoles: false,
        canDeleteCompetition: false,
        canAccessSettings: false
    },
    ADMIN: {
        canCreateCompetition: true,
        canManageResults: true,
        canVerifyVideo: true,
        canPromoteRound: true,
        canBanUser: true,
        canViewPayments: true,
        canAccessAuditLogs: true,
        canAssignRoles: false,
        canDeleteCompetition: false,
        canAccessSettings: false
    },
    SUPER_ADMIN: {
        canCreateCompetition: true,
        canManageResults: true,
        canVerifyVideo: true,
        canPromoteRound: true,
        canBanUser: true,
        canViewPayments: true,
        canAccessAuditLogs: true,
        canAssignRoles: true,
        canDeleteCompetition: true,
        canAccessSettings: true
    }
};

function getRoleForEmail(email) {
    const superAdminEmail = 'midhun.speedcuber@gmail.com';
    return email?.toLowerCase() === superAdminEmail ? 'SUPER_ADMIN' : 'USER';
}

function getPermissionsForRole(role) {
    return DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.USER;
}

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

                            // Ensure roleLevel exists for existing users (backwards compatibility)
                            if (profileData.roleLevel === undefined) {
                                if (profileData.role === 'ADMIN' || profileData.role === 'admin') {
                                    profileData.roleLevel = 3;
                                } else {
                                    profileData.roleLevel = 0;
                                }
                            }

                            // Ensure permissions exist for existing users (backwards compatibility)
                            if (!profileData.permissions) {
                                profileData.permissions = getPermissionsForRole(profileData.role);
                            }

                            // Update Firestore with missing fields if needed
                            const needsUpdate = !profileData.permissions || profileData.roleLevel === undefined;

                            // Check if user should be SUPER_ADMIN based on email
                            const expectedRole = getRoleForEmail(firebaseUser.email);
                            const shouldBeSuperAdmin = expectedRole === 'SUPER_ADMIN' && profileData.role !== 'SUPER_ADMIN';

                            if (needsUpdate || shouldBeSuperAdmin) {
                                try {
                                    const updates = {};
                                    if (needsUpdate) {
                                        updates.roleLevel = profileData.roleLevel;
                                        updates.permissions = profileData.permissions;
                                    }
                                    if (shouldBeSuperAdmin) {
                                        updates.role = 'SUPER_ADMIN';
                                        updates.roleLevel = 4;
                                        updates.permissions = getPermissionsForRole('SUPER_ADMIN');
                                    }
                                    await updateDoc(doc(db, 'users', firebaseUser.uid), updates);
                                    profileData = { ...profileData, ...updates };
                                } catch (e) {
                                    console.warn('Could not update user profile with roleLevel/permissions');
                                }
                            }

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
                            const role = getRoleForEmail(firebaseUser.email);
                            const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                            const wcaStyleId = await generateWCAId(displayName.split(' ')[0] || 'User', displayName.split(' ')[1] || 'Name');

                            const sessionId = localStorage.getItem('mcubes_session_id') || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                            localStorage.setItem('mcubes_session_id', sessionId);

                            const newProfile = {
                                uid: firebaseUser.uid,
                                email: firebaseUser.email,
                                displayName: displayName,
                                photoURL: firebaseUser.photoURL || '',
                                role: role,
                                roleLevel: ROLE_LEVELS[role],
                                permissions: getPermissionsForRole(role),
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
                    if (mounted && !userProfile) {
                        const role = getRoleForEmail(firebaseUser.email);
                        const minimalProfile = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                            role: role,
                            roleLevel: ROLE_LEVELS[role],
                            permissions: getPermissionsForRole(role)
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

            const role = getRoleForEmail(email);

            const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('mcubes_session_id', sessionId);

            const userProfileData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: role,
                roleLevel: ROLE_LEVELS[role],
                permissions: getPermissionsForRole(role),
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
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                const role = getRoleForEmail(user.email);
                const newProfile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: updates.displayName || user.displayName || 'User',
                    role: role,
                    roleLevel: ROLE_LEVELS[role],
                    permissions: getPermissionsForRole(role),
                    createdAt: new Date().toISOString(),
                    ...updates
                };
                await setDoc(userRef, newProfile);
                setUserProfile(newProfile);
                localStorage.setItem('mcubes_profile', JSON.stringify(newProfile));
                return newProfile;
            } else {
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

    const updateUserRole = async (targetUserId, newRole) => {
        if (!user) throw new Error('Not authenticated');
        if (userProfile?.role !== 'SUPER_ADMIN') throw new Error('Only SUPER_ADMIN can assign roles');
        if (!ROLE_LEVELS[newRole]) throw new Error('Invalid role');

        const superAdminEmail = 'midhun.speedcuber@gmail.com';
        const targetUserRef = doc(db, 'users', targetUserId);
        const targetUserDoc = await getDoc(targetUserRef);

        if (!targetUserDoc.exists()) throw new Error('User not found');

        const targetData = targetUserDoc.data();

        if (targetData.email?.toLowerCase() === superAdminEmail && newRole !== 'SUPER_ADMIN') {
            throw new Error('Cannot change SUPER_ADMIN role');
        }

        const updatedData = {
            role: newRole,
            roleLevel: ROLE_LEVELS[newRole],
            permissions: getPermissionsForRole(newRole),
            roleUpdatedAt: serverTimestamp(),
            roleUpdatedBy: user.uid
        };

        await updateDoc(targetUserRef, updatedData);

        return { uid: targetUserId, ...updatedData };
    };

    // Helper to check if user is SUPER_ADMIN (supports both new roleLevel and legacy/email-based)
    const checkIsSuperAdmin = (profile) => {
        if (!profile) return false;
        const superAdminEmail = 'midhun.speedcuber@gmail.com';
        if (profile.email?.toLowerCase() === superAdminEmail) return true;
        if (profile.roleLevel !== undefined) return profile.roleLevel >= 4;
        return profile.role?.toUpperCase() === 'SUPER_ADMIN';
    };

    // Helper to check if user is ADMIN or higher
    const checkIsAdmin = (profile) => {
        if (!profile) return false;
        const superAdminEmail = 'midhun.speedcuber@gmail.com';
        if (profile.email?.toLowerCase() === superAdminEmail) return true;
        if (profile.roleLevel !== undefined) return profile.roleLevel >= 3;
        const role = profile.role?.toUpperCase();
        return role === 'ADMIN' || role === 'SUPER_ADMIN';
    };

    // Helper to check if user is MODERATOR or higher
    const checkIsModerator = (profile) => {
        if (!profile) return false;
        const superAdminEmail = 'midhun.speedcuber@gmail.com';
        if (profile.email?.toLowerCase() === superAdminEmail) return true;
        if (profile.roleLevel !== undefined) return profile.roleLevel >= 2;
        const role = profile.role?.toUpperCase();
        return role === 'MODERATOR' || role === 'ADMIN' || role === 'SUPER_ADMIN';
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
        updateUserRole,
        isAdmin: checkIsAdmin(userProfile),
        isSuperAdmin: checkIsSuperAdmin(userProfile),
        isModerator: checkIsModerator(userProfile),
        isSupport: userProfile?.roleLevel >= ROLE_LEVELS.SUPPORT || userProfile?.role?.toUpperCase() === 'SUPPORT',
        hasRole: (minRole) => userProfile?.roleLevel >= ROLE_LEVELS[minRole],
        hasPermission: (permission) => userProfile?.permissions?.[permission] === true,
        ROLE_LEVELS
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}