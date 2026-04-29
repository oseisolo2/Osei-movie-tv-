import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC-8FW7yoB6z3igpwleNxUjU1thMLuX0Mk",
  authDomain: "osei-movie-tv.firebaseapp.com",
  databaseURL: "https://osei-movie-tv-default-rtdb.firebaseio.com",
  projectId: "osei-movie-tv",
  storageBucket: "osei-movie-tv.firebasestorage.app",
  messagingSenderId: "420461350561",
  appId: "1:420461350561:web:85100a8aa0acaafa2ceae0",
  measurementId: "G-G19L98QDZE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
// Initialize Analytics only in client-side environments
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  
  if (errorMessage.includes('permission-denied') || errorMessage.includes('Missing or insufficient permissions')) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // Provide a helpful log for the user
    console.error('ACTION REQUIRED: Your Firestore Security Rules are blocking access. Please copy the rules from `firestore.rules` and paste them into your Firebase Console.');
  } else {
    console.warn(`Firestore Warning (${operationType}): ${errorMessage}`);
  }
}
