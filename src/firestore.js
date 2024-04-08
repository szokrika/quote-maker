import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCELEaJE9dBiNpSW2VYvDG1fD6DoiZ_hgM',
  authDomain: 'invoice-7ff51.firebaseapp.com',
  projectId: 'invoice-7ff51',
  storageBucket: 'invoice-7ff51.appspot.com',
  messagingSenderId: '667942035013',
  appId: '1:667942035013:web:6c609454fc2f3066c50d2c',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
