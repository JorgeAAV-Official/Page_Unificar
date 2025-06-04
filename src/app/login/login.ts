// src/app/login/login.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Importaciones de Firebase Authentication
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';

// Importaciones de Firestore para buscar el rol
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  loginData = {
    correo: '',
    password: ''
  };

  message: string = '';
  isSuccess: boolean = false;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private auth: Auth, // Inyecta Firebase Auth
    private firestore: Firestore // Inyecta Firestore
  ) {}

  goToRegistro(): void {
    this.router.navigate(['/formulario']);
  }

  async onLogin() {
    this.isLoading = true;
    this.message = ''; // Limpiar mensajes previos

    if (!this.loginData.correo || !this.loginData.password) {
      this.message = 'Por favor, ingrese su correo y contraseña.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/.test(this.loginData.correo)) {
      this.message = 'El correo electrónico debe ser válido (Gmail o Hotmail).';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    try {
      // 1. **Autenticar con Firebase Authentication**
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        this.loginData.correo,
        this.loginData.password
      );

      const user = userCredential.user;
      console.log('Usuario autenticado:', user);

      // 2. **Buscar el rol del usuario en Firestore**
      // Usamos el correo electrónico (que sabemos que es único por Firebase Auth) para encontrar el documento del cliente en Firestore.
      const q = query(collection(this.firestore, 'clientes'), where('correo', '==', this.loginData.correo));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        const userData = docSnapshot.data();
        const userRol = userData['rol']; // Obtenemos el campo 'rol'

        this.message = `¡Inicio de sesión exitoso! Su rol es: ${userRol}`;
        this.isSuccess = true;

        // 3. **Redirigir según el rol**
        if (userRol === 'administrador') {
          // Si es administrador, redirigimos al componente formulario (que es tu panel de administración)
          this.router.navigate(['/formulario']);
        } else {
          // Si es usuario normal, lo enviamos a una página aún no definida (ej. /user-dashboard)
          this.router.navigate(['/principal']); // Necesitarás crear este componente y ruta
        }

      } else {
        // Esto es un caso anómalo: el usuario se autenticó en Firebase Auth,
        // pero no tiene un registro de perfil correspondiente en tu colección 'clientes' de Firestore.
        // Esto no debería pasar si tu proceso de registro es el único.
        this.message = 'Error: No se encontró el perfil de usuario en nuestra base de datos. Por favor, contacte a soporte.';
        this.isSuccess = false;
        // Opcional: Desautenticar al usuario de Firebase Auth si su perfil de Firestore no existe
        await this.auth.signOut();
      }

    } catch (error: any) {
      console.error('Error al iniciar sesión:', error.code, error.message);
      this.isSuccess = false;

      // Manejo de errores específicos de Firebase Auth
      switch (error.code) {
        case 'auth/invalid-email':
          this.message = 'El formato del correo electrónico es inválido.';
          break;
        case 'auth/user-disabled':
          this.message = 'Este usuario ha sido deshabilitado.';
          break;
        case 'auth/user-not-found':
          this.message = 'No existe un usuario con este correo electrónico.';
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential': // Para versiones más recientes de Firebase SDK
          this.message = 'Credenciales inválidas. Por favor, revise su correo y contraseña.';
          break;
        default:
          this.message = 'Error al iniciar sesión. Por favor, inténtelo de nuevo.';
          break;
      }
    } finally {
      this.isLoading = false;
    }
  }
}