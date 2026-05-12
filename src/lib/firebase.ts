import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import configData from '../../firebase-applet-config.json';

const firebaseConfig = (configData as any).default || configData;

const app = initializeApp(firebaseConfig);

// Improved initialization with connectivity fallbacks for environments like iframes/proxies
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Force long polling if auto-detect fails or is slow
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);

// CRITICAL CONSTRAINT: When the application initially boots, call getFromServer to test the connection.
async function testConnection() {
  try {
    console.log("Starting Firestore connectivity test...");
    // We use a dummy path that doesn't need to exist, just to check connectivity
    // Using a very small timeout for the initial check to not block the UI for too long
    await getDocFromServer(doc(db, '_healthcheck', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code || 'unknown';
    
    // Check if it's a connectivity issue vs a permission/logic issue
    const isConnectivityError = errorCode === 'unavailable' || 
                               errorMessage.includes('the client is offline') || 
                               errorMessage.includes('unavailable') || 
                               errorMessage.includes('Backend didn\'t respond');

    if (isConnectivityError) {
      console.error(`Firestore Connectivity Error: [${errorCode}] ${errorMessage}`);
      console.error("Action Required: Please ensure Firestore is enabled in your Firebase Console and your internet connection is stable. In some corporate networks, WebSockets or long-polling might be restricted.");
    } else {
      // If we got a 'permission-denied', it means we ACTUALLY reached the server!
      console.log(`Firestore reachability confirmed. Server responded with: [${errorCode}]`);
    }
  }
}

// Only run test in browser
if (typeof window !== "undefined") {
  testConnection();
}

// Initialize Analytics only in client-side environments
export const analytics = typeof window !== "undefined" && typeof firebaseConfig.measurementId === 'string' && firebaseConfig.measurementId !== "" ? getAnalytics(app) : null;

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
  const errorCode = (error as any)?.code || 'unknown';
  
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
    console.error('ACTION REQUIRED: Your Firestore Security Rules are blocking access. Please copy the rules from `firestore.rules` and paste them into your Firebase Console.');
  } else if (errorCode === 'unavailable' || errorMessage.includes('Could not reach Cloud Firestore backend')) {
    console.error('Firestore Connection Error: The backend is unreachable. This could be due to network issues, restricted API keys, or Firestore not being enabled in the project.');
    console.error('Current Config:', {
      projectId: firebaseConfig.projectId,
      apiKey: firebaseConfig.apiKey ? 'PRESENT' : 'MISSING',
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)'
    });
  } else {
    console.warn(`Firestore Warning (${operationType} at ${path}): ${errorMessage} [Code: ${errorCode}]`);
  }
}
