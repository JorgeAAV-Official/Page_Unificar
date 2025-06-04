// src/app/firebase-config.ts
import { initializeApp } from 'firebase/app';
// import { getAnalytics } from 'firebase/analytics'; // NO IMPORTES getAnalytics aquí directamente
import { getFirestore } from 'firebase/firestore';

// Configuración de Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyDKPIBDxqohKdb7URXaFt6QXIZNhEfI0_A",
  authDomain: "registros-page-unificar.firebaseapp.com",
  projectId: "registros-page-unificar",
  storageBucket: "registros-page-unificar.firebasestorage.app",
  messagingSenderId: "557646286663",
  appId: "1:557646286663:web:4af33dfa35c91f5b754662",
  measurementId: "G-N3M47T8P9G"
};

// Inicializar Firebase
export const app = initializeApp(firebaseConfig);

// Inicializar Firestore
export const db = getFirestore(app);

// Inicializar Analytics solo en el navegador
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

// Define analytics como null por defecto o de tipo Analytics | null
export let analytics: any = null; // Puedes tiparlo mejor si tienes @angular/fire/analytics instalado

@Injectable({ providedIn: 'root' })
export class AnalyticsInitializer {
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Importa getAnalytics solo cuando estás en el navegador
      import('firebase/analytics').then(({ getAnalytics }) => {
        analytics = getAnalytics(app);
        console.log('Firebase Analytics inicializado en el navegador.');
      }).catch(e => console.error('Error al inicializar Firebase Analytics:', e));
    }
  }
}

// Ahora, en tu app.config.ts, asegúrate de que AnalyticsInitializer se provea