// src/app/formulario/formulario.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common'; // Para *ngIf en el HTML
import { FormsModule } from '@angular/forms'; // Para [(ngModel)] y ngSubmit

// Importaciones de Firestore
import { Firestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';

@Component({
  selector: 'app-formulario',
  standalone: true,
  imports: [
    CommonModule, // Necesario para directivas de Angular como *ngIf
    FormsModule   // Necesario para [(ngModel)] y (ngSubmit)
  ],
  templateUrl: './formulario.html',
  styleUrl: './formulario.css'
})
export class Formulario {
  // Propiedades para los datos del formulario (deben coincidir con 'name' en el HTML)
  formData = {
    nombres: '',
    apellidos: '',
    correo: '',
    tipoDocumento: '',
    numeroDocumento: '',
    telefono: '',
    password: '',
    privacyPolicy: false,
    // ¡NUEVO CAMPO: rol!
    rol: 'usuario' // Valor predeterminado
  };

  // Propiedades para mensajes y estado de carga
  message: string = '';
  isSuccess: boolean = false;
  isLoading: boolean = false;

  // Propiedad para buscar/actualizar/eliminar por número de documento
  searchNumeroDocumento: string = '';
  foundRecord: any = null; // Para almacenar el registro encontrado

  // Opciones para el campo 'rol'
  roles = ['usuario', 'administrador']; // Definimos las opciones aquí

  constructor(
    private router: Router,
    private firestore: Firestore // Inyecta Firestore
  ) {}

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Método para registrar (crear) un nuevo cliente en Firestore.
   */
  async onSubmit() {
    this.isLoading = true;
    this.message = ''; // Limpiar mensajes previos

    // Validar checkbox de política de privacidad
    if (!this.formData.privacyPolicy) {
      this.message = 'Debe aceptar la política de privacidad para registrarse.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    // Validaciones adicionales antes de enviar a Firebase
    if (!this.formData.nombres || !this.formData.apellidos || !this.formData.correo ||
        !this.formData.tipoDocumento || !this.formData.numeroDocumento ||
        !this.formData.telefono || !this.formData.password || !this.formData.rol) { // Añadido !this.formData.rol
      this.message = 'Por favor, complete todos los campos obligatorios.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    // Validar formatos (aunque HTML lo hace, es buena práctica validarlo en TS)
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(this.formData.nombres) ||
        !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(this.formData.apellidos)) {
      this.message = 'Nombre y Apellido solo deben contener letras y espacios.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/.test(this.formData.correo)) {
      this.message = 'El correo electrónico debe ser válido (Gmail o Hotmail).';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^\d+$/.test(this.formData.numeroDocumento)) {
        this.message = 'El número de documento solo debe contener números.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
    }

    if (!/^\d{7,}$/.test(this.formData.telefono)) {
      this.message = 'El número telefónico solo debe contener números y tener al menos 7 dígitos.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(this.formData.password)) {
      this.message = 'La contraseña debe tener mínimo 8 caracteres con mayúsculas, minúsculas, números y símbolos.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    // Validar que el rol sea una de las opciones permitidas
    if (!this.roles.includes(this.formData.rol)) {
        this.message = 'El rol seleccionado no es válido.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
    }

    try {
      // Verificar si ya existe un usuario con el mismo número de documento
      const q = query(collection(this.firestore, 'clientes'), where('numeroDocumento', '==', this.formData.numeroDocumento));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        this.message = 'Ya existe un registro con este número de documento.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
      }

      const docRef = await addDoc(collection(this.firestore, 'clientes'), {
        nombres: this.formData.nombres,
        apellidos: this.formData.apellidos,
        correo: this.formData.correo,
        tipoDocumento: this.formData.tipoDocumento,
        numeroDocumento: this.formData.numeroDocumento,
        telefono: this.formData.telefono,
        rol: this.formData.rol // ¡AQUÍ se guarda el nuevo campo 'rol'!
      });

      this.message = `¡Registro exitoso! ID de documento: ${docRef.id}`;
      this.isSuccess = true;
      this.resetForm();
    } catch (e) {
      console.error('Error al añadir documento: ', e);
      this.message = 'Error al registrar los datos. Inténtelo de nuevo.';
      this.isSuccess = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Método para buscar un cliente por número de documento (READ).
   */
  async searchClient() {
    if (!this.searchNumeroDocumento) {
      this.message = 'Ingrese un número de documento para buscar.';
      this.isSuccess = false;
      this.foundRecord = null;
      return;
    }

    this.isLoading = true;
    this.message = '';
    this.foundRecord = null; // Limpiar registro previo

    try {
      const q = query(collection(this.firestore, 'clientes'), where('numeroDocumento', '==', this.searchNumeroDocumento));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        this.foundRecord = { id: docSnapshot.id, ...docSnapshot.data() };
        this.message = 'Cliente encontrado.';
        this.isSuccess = true;

        // Precargar el formulario con los datos encontrados para facilitar la edición
        this.formData.nombres = this.foundRecord.nombres;
        this.formData.apellidos = this.foundRecord.apellidos;
        this.formData.correo = this.foundRecord.correo;
        this.formData.tipoDocumento = this.foundRecord.tipoDocumento;
        this.formData.numeroDocumento = this.foundRecord.numeroDocumento;
        this.formData.telefono = this.foundRecord.telefono;
        this.formData.password = '';
        this.formData.privacyPolicy = true;
        this.formData.rol = this.foundRecord.rol || 'usuario'; // Precarga el rol, si no existe, por defecto 'usuario'
      } else {
        this.message = 'No se encontró ningún cliente con ese número de documento.';
        this.isSuccess = false;
        this.foundRecord = null;
        this.resetForm();
      }
    } catch (e) {
      console.error('Error al buscar cliente: ', e);
      this.message = 'Error al buscar el cliente. Inténtelo de nuevo.';
      this.isSuccess = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Método para actualizar un cliente existente (UPDATE).
   */
  async updateClient() {
    if (!this.foundRecord || !this.foundRecord.id) {
      this.message = 'Primero busque un cliente para actualizar.';
      this.isSuccess = false;
      return;
    }

    this.isLoading = true;
    this.message = '';

    // Validaciones antes de actualizar
    if (!this.formData.nombres || !this.formData.apellidos || !this.formData.correo ||
        !this.formData.tipoDocumento || !this.formData.numeroDocumento || !this.formData.telefono || !this.formData.rol) { // Añadido !this.formData.rol
      this.message = 'Por favor, complete todos los campos obligatorios para actualizar.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }
    // Añade el resto de validaciones de formato aquí si es necesario (igual que en onSubmit)
    if (!/^\d+$/.test(this.formData.numeroDocumento)) {
        this.message = 'El número de documento solo debe contener números.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
    }

    if (!/^\d{7,}$/.test(this.formData.telefono)) {
      this.message = 'El número telefónico solo debe contener números y tener al menos 7 dígitos.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    // Validar que el rol sea una de las opciones permitidas
    if (!this.roles.includes(this.formData.rol)) {
        this.message = 'El rol seleccionado no es válido.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
    }

    try {
      const docRef = doc(this.firestore, 'clientes', this.foundRecord.id);
      await updateDoc(docRef, {
        nombres: this.formData.nombres,
        apellidos: this.formData.apellidos,
        correo: this.formData.correo,
        tipoDocumento: this.formData.tipoDocumento,
        numeroDocumento: this.formData.numeroDocumento,
        telefono: this.formData.telefono,
        rol: this.formData.rol // ¡AQUÍ se actualiza el nuevo campo 'rol'!
      });

      this.message = 'Cliente actualizado exitosamente.';
      this.isSuccess = true;
      this.resetForm();
      this.foundRecord = null;
      this.searchNumeroDocumento = '';
    } catch (e) {
      console.error('Error al actualizar cliente: ', e);
      this.message = 'Error al actualizar el cliente. Inténtelo de nuevo.';
      this.isSuccess = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Método para eliminar un cliente (DELETE).
   */
  async deleteClient() {
    if (!this.foundRecord || !this.foundRecord.id) {
      this.message = 'Primero busque un cliente para eliminar.';
      this.isSuccess = false;
      return;
    }

    if (!confirm(`¿Está seguro de que desea eliminar al cliente ${this.foundRecord.nombres} ${this.foundRecord.apellidos}?`)) {
      return;
    }

    this.isLoading = true;
    this.message = '';

    try {
      const docRef = doc(this.firestore, 'clientes', this.foundRecord.id);
      await deleteDoc(docRef);

      this.message = 'Cliente eliminado exitosamente.';
      this.isSuccess = true;
      this.resetForm();
      this.foundRecord = null;
      this.searchNumeroDocumento = '';
    } catch (e) {
      console.error('Error al eliminar cliente: ', e);
      this.message = 'Error al eliminar el cliente. Inténtelo de nuevo.';
      this.isSuccess = false;
    } finally {
      this.isLoading = false;
    }
  }


  /**
   * Método para limpiar el formulario.
   */
  resetForm(): void {
    this.formData = {
      nombres: '',
      apellidos: '',
      correo: '',
      tipoDocumento: '',
      numeroDocumento: '',
      telefono: '',
      password: '',
      privacyPolicy: false,
      rol: 'usuario' // Restablece el rol a su valor predeterminado
    };
  }
}