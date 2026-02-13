# 🐛 MCUBES - Login Issue Troubleshooting

## Problem: "Doesn't work after login"

This typically means Firebase Authentication or Firestore isn't fully configured. Here's how to fix it:

---

## ✅ Solution Steps

### Step 1: Enable Firebase Authentication

**THIS IS REQUIRED - The app cannot work without it!**

1. Go to: https://console.firebase.google.com
2. Select project: **texcads-670e0**
3. Click **Build** → **Authentication**
4. Click **"Get started"** button
5. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle it ON
   - Click "Save"
6. Enable **Google**:
   - Click on "Google"
   - Toggle it ON
   - Enter support email (your email)
   - Click "Save"

**Without this step, login will not work!**

---

### Step 2: Create Firestore Index

After login, the app tries to query competitions. This needs an index:

**Option A: Automatic (Recommended)**
1. Try to login
2. Check browser console (F12)
3. Look for Firestore error with a link
4. Click the link to create index automatically

**Option B: Manual**
1. Go to Firebase Console → Firestore Database
2. Click **Indexes** tab
3. Click **Add Index**
4. Collection: `competitions`
5. Fields:
   - `startDate` - Descending
6. Click **Create**

---

### Step 3: Test Without Firestore (Temporary Fix)

If you want to test login immediately without waiting for indexes, I can modify the homepage to skip the competitions query temporarily.

Would you like me to:
1. Add error handling to show what's failing
2. Create a simple test page after login
3. Add loading states with error messages

---

## 🔍 Check What's Actually Failing

**Open Browser Console (F12) and look for:**

### Expected Errors:

**1. Firebase Auth Error:**
```
Firebase: Error (auth/...)
```
**Solution:** Enable Authentication in Firebase Console (Step 1 above)

**2. Firestore Index Error:**
```
The query requires an index. You can create it here: https://...
```
**Solution:** Click the link or create index manually (Step 2 above)

**3. Firestore Permission Error:**
```
Missing or insufficient permissions
```
**Solution:** Deploy security rules (see below)

---

## 🔐 Deploy Firestore Security Rules

**Method 1: Via Firebase Console**
1. Go to Firestore Database → Rules
2. Copy this and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMIN';
    }
    
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAuthenticated() && request.auth.uid == userId;
      allow delete: if isAdmin();
    }
    
    match /competitions/{competitionId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    
    match /registrations/{registrationId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }
    
    match /solves/{solveId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }
    
    match /results/{resultId} {
      allow read: if true;
      allow create, update: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
      allow delete: if false;
    }
    
    match /payments/{paymentId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }
  }
}
```

3. Click **Publish**

**Method 2: Via Firebase CLI**
```bash
cd /app
firebase deploy --only firestore:rules
```

---

## 🧪 Quick Test

**Test if Firebase is working:**

1. Open browser console (F12)
2. Go to: https://solve-tracker.preview.emergentagent.com
3. Type in console:
```javascript
// Check if Firebase initialized
console.log(firebase)
```

4. Try to register:
   - Email: test@test.com
   - Password: test123
   - Name: Test User
   - Country: India

5. Check console for errors

---

## 📝 Common Error Messages & Solutions

### Error: "auth/email-already-in-use"
**Solution:** Email already registered. Try login instead or use different email.

### Error: "auth/invalid-email"
**Solution:** Enter valid email format.

### Error: "auth/weak-password"
**Solution:** Password must be at least 6 characters.

### Error: "auth/operation-not-allowed"
**Solution:** Email/Password not enabled in Firebase Console. Go to Step 1.

### Error: "Firestore: Missing or insufficient permissions"
**Solution:** Deploy security rules (see above).

### Error: "The query requires an index"
**Solution:** Click the link in error message to create index.

---

## 🚀 If All Else Fails

Let me know which specific error you're seeing and I'll fix it immediately. Common scenarios:

**Scenario 1: Login works, but homepage blank/loading forever**
- Issue: Firestore index missing
- Solution: Create index for competitions collection

**Scenario 2: Login button does nothing**
- Issue: Firebase Auth not enabled
- Solution: Enable Email/Password in Firebase Console

**Scenario 3: Error message shown**
- Issue: Depends on message
- Solution: Share the error message with me

---

## 📞 Next Steps

**Please tell me:**
1. What happens when you click login? (Error message? Blank page? Loading forever?)
2. Open browser console (F12) - what errors do you see?
3. Have you enabled Firebase Authentication? (Yes/No)
4. Have you created Firestore database? (Yes/No)

Then I can fix the exact issue immediately!

---

**Firebase Console:** https://console.firebase.google.com
**Your Project:** texcads-670e0
