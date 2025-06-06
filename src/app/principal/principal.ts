// src/app/principal/principal.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, NgIf, NgForOf, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Importaciones de Firebase
import { Auth, signOut, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, doc, updateDoc } from '@angular/fire/firestore';
import { Observable, Subscriber } from 'rxjs'; // <--- IMPORTAR Subscriber de rxjs

@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    FormsModule
  ],
  templateUrl: './principal.html',
  styleUrl: './principal.css'
})
export class Principal implements OnInit {
  userData: any | null = null;
  editableUserData: any | null = null;
  isLoading: boolean = true;
  errorMessage: string = '';
  successMessage: string = '';
  isEditing: boolean = false;

  private userDocId: string | null = null;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('ngOnInit: Initial isLoading =', this.isLoading);
    this.isLoading = true;

    new Observable<User | null>((subscriber: Subscriber<User | null>) => { // <--- Tipo explícito para 'subscriber'
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        subscriber.next(user);
      }, (error: any) => { // <--- Tipo explícito para 'error'
        subscriber.error(error);
      });
      return unsubscribe;
    }).subscribe(async (user: User | null) => {
      console.log('Auth state changed: user =', user ? user.email : 'null');
      if (user && user.email) {
        this.errorMessage = '';
        this.successMessage = '';
        console.log('Auth state changed: User found, calling fetchUserData...');
        await this.fetchUserData(user.email);
        console.log('Auth state changed: fetchUserData finished. Current isLoading AFTER await =', this.isLoading);
      } else {
        console.log('Auth state changed: No user found, redirecting to login.');
        this.isLoading = false;
        this.userData = null;
        this.editableUserData = null;
        this.errorMessage = 'No se pudo cargar el perfil. Por favor, inicie sesión nuevamente.';
        this.router.navigate(['/login']);
        console.log('Auth state changed: isLoading after no user logic =', this.isLoading);
      }
    }, (error: any) => { // <--- Tipo explícito para 'error'
      console.error('Error al observar el estado de autenticación:', error);
      this.isLoading = false;
      this.errorMessage = 'Error al verificar la sesión. Por favor, intente de nuevo.';
      this.router.navigate(['/login']);
      console.log('Auth state changed: isLoading on error =', this.isLoading);
    });
  }

  async fetchUserData(email: string): Promise<void> {
    try {
      console.log('fetchUserData: Inside try block, setting isLoading = true');
      this.isLoading = true;
      this.errorMessage = '';

      const q = query(collection(this.firestore, 'clientes'), where('correo', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        this.userData = docSnapshot.data();
        this.userDocId = docSnapshot.id;
        this.editableUserData = { ...this.userData };
        console.log('Datos del usuario cargados:', this.userData);
      } else {
        console.log('No se encontró el documento del perfil para el correo:', email);
        this.errorMessage = 'No se encontró su información de perfil. Contacte a soporte.';
        this.userData = null;
        this.editableUserData = null;
        this.userDocId = null;
      }
    } catch (error: any) { // <--- Tipo explícito para 'error'
      console.error('Error en fetchUserData:', error);
      this.errorMessage = 'Error al cargar su perfil. Por favor, inténtelo de nuevo más tarde.';
      this.userData = null;
      this.editableUserData = null;
    } finally {
      console.log('fetchUserData: Inside finally block, setting isLoading = false');
      this.isLoading = false;
      console.log('fetchUserData: isLoading value AFTER setting to false =', this.isLoading);
      this.cdr.detectChanges();
    }
  }

  enableEditing(): void {
    this.isEditing = true;
    this.editableUserData = { ...this.userData };
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditing(): void {
    this.isEditing = false;
    this.editableUserData = { ...this.userData };
    this.errorMessage = '';
    this.successMessage = '';
  }

  async saveProfileChanges(): Promise<void> {
    if (!this.userDocId) {
      this.errorMessage = 'No se pudo encontrar el ID del documento para actualizar.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const userRef = doc(this.firestore, 'clientes', this.userDocId);
      const dataToUpdate: any = {
        nombres: this.editableUserData.nombres,
        apellidos: this.editableUserData.apellidos,
        pasaporte: this.editableUserData.pasaporte,
        telefono: this.editableUserData.telefono,
        whatsapp: this.editableUserData.whatsapp,
        usuarioTelegram: this.editableUserData.usuarioTelegram,
        pais: this.editableUserData.pais,
        departamento: this.editableUserData.departamento,
        ciudad: this.editableUserData.ciudad,
        valorConsignacion: this.editableUserData.valorConsignacion,
        numerovoucher: this.editableUserData.numerovoucher,
        proyecto: this.editableUserData.proyecto
      };

      for (const key in dataToUpdate) {
        if (dataToUpdate[key] === null || dataToUpdate[key] === undefined || dataToUpdate[key] === '') {
            delete dataToUpdate[key];
        }
      }

      await updateDoc(userRef, dataToUpdate);
      this.userData = { ...this.editableUserData };
      this.isEditing = false;
      this.successMessage = '¡Perfil actualizado exitosamente!';
      console.log('Perfil actualizado con éxito:', this.userData);
    } catch (error: any) { // <--- Tipo explícito para 'error'
      console.error('Error al actualizar el perfil:', error);
      this.errorMessage = 'Error al actualizar el perfil. Por favor, inténtelo de nuevo.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error: any) { // <--- Tipo explícito para 'error'
      console.error('Error al cerrar sesión:', error);
      this.errorMessage = 'Error al cerrar sesión. Por favor, inténtelo de nuevo.';
    }
  }
}