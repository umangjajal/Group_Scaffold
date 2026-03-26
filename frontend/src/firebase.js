import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
};

const missingFirebaseConfig = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const isFirebaseConfigured = missingFirebaseConfig.length === 0;
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

function assertFirebaseConfigured() {
  if (isFirebaseConfigured) {
    return;
  }

  throw new Error(
    `Firebase web config is incomplete. Missing: ${missingFirebaseConfig.join(', ')}.`,
  );
}

function getFirebaseAuthErrorMessage(error) {
  const code = error?.code;

  switch (code) {
    case 'auth/invalid-api-key':
      return 'Firebase API key is invalid or missing.';
    case 'auth/network-request-failed':
      return 'Firebase could not complete Google sign-in. Check the Firebase web config and authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Authentication.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Authentication.';
    case 'auth/popup-blocked':
      return 'The Google sign-in popup was blocked by the browser.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in popup was closed before login completed.';
    default:
      return error?.response?.data?.error || error?.message || 'Google login failed.';
  }
}

export {
  auth,
  googleProvider,
  signInWithPopup,
  assertFirebaseConfigured,
  getFirebaseAuthErrorMessage,
  isFirebaseConfigured,
};
