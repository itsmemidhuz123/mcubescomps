const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./firebase-admin-key.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function setAdminRole(userId, role = 'ADMIN', roleLevel = 3) {
  try {
    await db.collection('users').doc(userId).set({
      role: role,
      roleLevel: roleLevel,
    }, { merge: true });
    
    console.log(`✅ Successfully set role to ${role} for user: ${userId}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit();
}

// Get userId from command line argument
const userId = process.argv[2];
if (!userId) {
  console.log('Usage: node set-admin.js <user-id> [role] [roleLevel]');
  console.log('Example: node set-admin.js abc123 ADMIN 3');
  process.exit(1);
}

const role = process.argv[3] || 'ADMIN';
const roleLevel = parseInt(process.argv[4]) || 3;

setAdminRole(userId, role, roleLevel);
