import { getApps, initializeApp } from 'firebase/app';
import { getAI, GoogleAIBackend } from 'firebase/ai';

const firebaseConfig = {
  apiKey: 'AIzaSyDNQtvhT-J9x0Lh8YX_I421dWDwkCtVHko',
  authDomain: 'apps-showcase-a8f91.firebaseapp.com',
  projectId: 'apps-showcase-a8f91',
  storageBucket: 'apps-showcase-a8f91.firebasestorage.app',
  messagingSenderId: '168815262727',
  appId: '1:168815262727:web:d8ddb796d6137bc8c0fea2',
};

export const firebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

// TODO: Add Firebase App Check with ReCaptchaV3Provider here once a reCAPTCHA v3 site key is provisioned:
// import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
// initializeAppCheck(firebaseApp, { provider: new ReCaptchaV3Provider('<SITE_KEY>'), isTokenAutoRefreshEnabled: true });

export const firebaseAI = getAI(firebaseApp, {
  backend: new GoogleAIBackend(),
});
