import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Generate WCA-style ID
 * Format: YYYY + First3LettersFirstName + FirstLetterLastName + Number
 * Example: 2026RAHK1, 2026RAHK2 (if duplicate)
 */
export async function generateWCAId(firstName, lastName) {
  const year = new Date().getFullYear();
  
  // Clean and format names
  const cleanFirst = firstName.trim().toUpperCase().replace(/[^A-Z]/g, '');
  const cleanLast = lastName.trim().toUpperCase().replace(/[^A-Z]/g, '');
  
  // Take first 3 letters of first name, pad if needed
  const firstPart = cleanFirst.substring(0, 3).padEnd(3, 'X');
  
  // Take first letter of last name
  const lastPart = cleanLast.substring(0, 1) || 'X';
  
  // Base ID without number
  const baseId = `${year}${firstPart}${lastPart}`;
  
  // Find existing IDs with same base
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('wcaStyleId', '>=', baseId), where('wcaStyleId', '<=', baseId + '\uf8ff'));
  const snapshot = await getDocs(q);
  
  // Find the highest number
  let maxNumber = 0;
  snapshot.forEach(doc => {
    const existingId = doc.data().wcaStyleId;
    if (existingId.startsWith(baseId)) {
      const numPart = existingId.substring(baseId.length);
      const num = parseInt(numPart) || 0;
      if (num > maxNumber) maxNumber = num;
    }
  });
  
  // Return next available ID
  return `${baseId}${maxNumber + 1}`;
}
