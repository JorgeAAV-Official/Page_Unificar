// src/app/formulario/formulario.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Importaciones de Firestore
import { Firestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';

// Para Firebase Authentication
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';

// Definición de la interfaz para un Voucher
interface VoucherData {
  valorConsignacion: number | null;
  numeroVoucher: string;
  fechaConsignacion: string;
  proyecto: string;
}

@Component({
  selector: 'app-formulario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './formulario.html',
  styleUrl: './formulario.css'
})
export class Formulario implements OnInit {

  // Propiedades para los datos del formulario principal (cliente)
  formData = {
    nombres: '',
    apellidos: '',
    correo: '',
    numeroDocumento: '',
    telefono: '',
    password: '', // Será el número de documento
    privacyPolicy: false,
    rol: 'usuario', // Valor predeterminado

    pasaporte: '',
    whatsapp: '',
    pais: '',
    ciudad: '',
    departamento: '',
    fechaRegistro: '', // Se llenará automáticamente
    usuarioTelegram: ''
  };

  // --- NUEVAS PROPIEDADES PARA VOUCHERS DINÁMICOS ---
  cantidadVouchers: number = 1; // Controla cuántos formularios de voucher se muestran
  vouchers: VoucherData[] = []; // Array para almacenar los datos de múltiples vouchers
  // --- FIN NUEVAS PROPIEDADES ---

  // Propiedades para mensajes y estado de carga
  message: string = '';
  isSuccess: boolean = false;
  isLoading: boolean = false;

  // Propiedad para buscar/actualizar/eliminar por número de documento
  searchNumeroDocumento: string = '';
  foundRecord: any = null; // Para almacenar el registro encontrado

  // ID del documento del cliente en Firestore, crucial para operaciones de actualización/voucher
  clienteDocId: string | null = null;

  // Opciones para los campos 'rol' y 'proyecto'
  roles = ['usuario', 'administrador'];
  proyectos = ['Unificar', 'Cristal', 'Cristal S.O.S.'];

  constructor(
    private router: Router,
    private firestore: Firestore,
    private auth: Auth
  ) {}

  ngOnInit(): void {
    this.generateVoucherForms(); // Inicializa al menos un formulario de voucher al cargar
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Genera o ajusta la cantidad de formularios de voucher según `cantidadVouchers`.
   */
  generateVoucherForms(): void {
    if (this.cantidadVouchers < 1) {
      this.cantidadVouchers = 1; // Asegura que siempre haya al menos un formulario
    }

    const currentLength = this.vouchers.length;
    if (this.cantidadVouchers > currentLength) {
      // Añadir nuevos vouchers si la cantidad aumenta
      for (let i = currentLength; i < this.cantidadVouchers; i++) {
        this.vouchers.push({
          valorConsignacion: null,
          numeroVoucher: '',
          fechaConsignacion: '',
          proyecto: ''
        });
      }
    } else if (this.cantidadVouchers < currentLength) {
      // Remover vouchers si la cantidad disminuye
      this.vouchers = this.vouchers.slice(0, this.cantidadVouchers);
    }
  }

  /**
   * Elimina un formulario de voucher específico por su índice.
   * @param index El índice del voucher a eliminar.
   */
  removeVoucherForm(index: number): void {
    if (this.vouchers.length > 1) { // Asegura que siempre quede al menos un voucher
      this.vouchers.splice(index, 1);
      this.cantidadVouchers--; // Ajusta la cantidad para reflejar el cambio
    } else {
      this.message = 'Debe haber al menos un formulario de voucher.';
      this.isSuccess = false;
    }
  }

  /**
   * Método para registrar (crear) un nuevo cliente o manejar un cliente existente.
   */
  async onSubmitClient() {
    this.isLoading = true;
    this.message = ''; // Limpiar mensajes previos

    // Generar fecha de registro automáticamente
    this.formData.fechaRegistro = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD

    // Validar checkbox de política de privacidad
    if (!this.formData.privacyPolicy) {
      this.message = 'Debe aceptar la política de privacidad para registrarse.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    // Validaciones de campos obligatorios (cliente)
    // Se asume que el HTML ya maneja `required` y `pattern` para una pre-validación visual
    // Pero es buena práctica tener validación también en el TS.
    if (!this.formData.nombres || !this.formData.apellidos || !this.formData.correo ||
        !this.formData.numeroDocumento || !this.formData.telefono || !this.formData.password || !this.formData.rol ||
        !this.formData.whatsapp || !this.formData.pais || !this.formData.ciudad || !this.formData.departamento ||
        !this.formData.usuarioTelegram) {
      this.message = 'Por favor, complete todos los campos obligatorios del cliente.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    // Validaciones de formato (las mismas que ya tenías)
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
      this.message = 'El número telefónico es obligatorio y debe contener al menos 7 dígitos numéricos.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^\d{7,}$/.test(this.formData.whatsapp)) {
      this.message = 'El número de Whatsapp es obligatorio y debe contener al menos 7 dígitos numéricos.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (this.formData.pasaporte && !/^[a-zA-Z0-9]*$/.test(this.formData.pasaporte)) { // Ajustado el patrón para ser opcional
      this.message = 'El pasaporte debe contener solo letras y números.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^\d+$/.test(this.formData.password)) {
      this.message = 'La contraseña debe contener solo números.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }
    if (this.formData.password !== this.formData.numeroDocumento) {
        this.message = 'La contraseña debe ser igual al número de documento.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
    }

    if (/\s/.test(this.formData.usuarioTelegram)) {
        this.message = 'El usuario de Telegram no debe contener espacios.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
    }

    if (!this.roles.includes(this.formData.rol)) {
      this.message = 'El rol seleccionado no es válido.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    let userCreatedInAuth = false;

    try {
      const clientesCollection = collection(this.firestore, 'clientes');
      const q = query(clientesCollection, where('numeroDocumento', '==', this.formData.numeroDocumento));
      const querySnapshot = await getDocs(q);

      let docRefId: string | null = null;

      if (!querySnapshot.empty) {
        // Cliente ya existe en Firestore
        const existingDoc = querySnapshot.docs[0];
        docRefId = existingDoc.id;
        this.clienteDocId = docRefId; // Almacenar el ID del documento

        // Intentar crear/obtener el usuario en Auth. Si ya existe, no hay problema.
        try {
          await createUserWithEmailAndPassword(this.auth, this.formData.correo, this.formData.password);
          userCreatedInAuth = true;
        } catch (e: any) {
          if (e.code === 'auth/email-already-in-use') {
            console.warn('El correo electrónico ya está en uso en Auth. Continuamos.');
          } else {
            throw e; // Relanzar otros errores de autenticación críticos
          }
        }

        // Actualizar el documento existente en Firestore
        const docRef = doc(this.firestore, 'clientes', docRefId);
        await updateDoc(docRef, {
          nombres: this.formData.nombres,
          apellidos: this.formData.apellidos,
          correo: this.formData.correo,
          numeroDocumento: this.formData.numeroDocumento,
          telefono: this.formData.telefono,
          whatsapp: this.formData.whatsapp,
          pasaporte: this.formData.pasaporte,
          pais: this.formData.pais,
          ciudad: this.formData.ciudad,
          departamento: this.formData.departamento,
          fechaRegistro: this.formData.fechaRegistro,
          usuarioTelegram: this.formData.usuarioTelegram.startsWith('@') ? this.formData.usuarioTelegram.substring(1) : this.formData.usuarioTelegram,
          rol: this.formData.rol
        });
        this.message = 'Datos del cliente actualizados exitosamente.';
        this.isSuccess = true;

      } else {
        // Cliente NO existe en Firestore, crear nuevo
        const userCredential = await createUserWithEmailAndPassword(this.auth, this.formData.correo, this.formData.password);
        console.log('Usuario creado en Firebase Auth:', userCredential.user);
        userCreatedInAuth = true;

        const newDocRef = await addDoc(clientesCollection, {
          nombres: this.formData.nombres,
          apellidos: this.formData.apellidos,
          correo: this.formData.correo,
          numeroDocumento: this.formData.numeroDocumento,
          telefono: this.formData.telefono,
          whatsapp: this.formData.whatsapp,
          pasaporte: this.formData.pasaporte,
          pais: this.formData.pais,
          ciudad: this.formData.ciudad,
          departamento: this.formData.departamento,
          fechaRegistro: this.formData.fechaRegistro,
          usuarioTelegram: this.formData.usuarioTelegram.startsWith('@') ? this.formData.usuarioTelegram.substring(1) : this.formData.usuarioTelegram,
          rol: this.formData.rol,
          vouchers: [] // Inicializar vouchers como un array vacío
        });
        docRefId = newDocRef.id;
        this.clienteDocId = docRefId; // Almacenar el ID del documento
        this.message = `¡Registro inicial de cliente exitoso! Ahora puede registrar los datos del voucher.`;
        this.isSuccess = true;
      }

      // Después de registrar/actualizar un cliente, precarga los datos del voucher
      // para que el usuario pueda verlos o modificarlos si aplica.
      // Usa el numeroDocumento para la búsqueda, ya que es el identificador clave.
      this.findClientDocIdAndLoadVoucherData(this.formData.numeroDocumento);
      this.resetForm(); // Limpiar el formulario principal después de un registro/actualización exitoso.

    } catch (e: any) {
      console.error('Error al registrar/procesar cliente:', e);
      this.isSuccess = false;

      if (e.code === 'auth/email-already-in-use') {
        this.message = 'El correo electrónico ya está registrado por otra cuenta. Por favor, intente con otro correo.';
      } else if (e.code === 'auth/weak-password') {
        this.message = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres (aunque sea un número).';
      } else {
        this.message = 'Error al procesar el registro del cliente. Inténtelo de nuevo.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Método para buscar un cliente por número de documento (READ).
   * Precarga todos los campos del cliente principal y los de voucher si existen.
   */
  async searchClient() {
    if (!this.searchNumeroDocumento) {
      this.message = 'Ingrese un número de documento para buscar.';
      this.isSuccess = false;
      this.foundRecord = null;
      this.resetForm(); // Limpiar formulario principal
      this.resetVouchersForms(); // Limpiar formularios de voucher
      this.clienteDocId = null;
      return;
    }

    this.isLoading = true;
    this.message = '';
    this.foundRecord = null;
    this.clienteDocId = null; // Resetear el ID del documento
    this.resetForm(); // Limpiar el formulario de cliente antes de cargar datos
    this.resetVouchersForms(); // Limpiar los formularios de voucher antes de cargar datos

    try {
      const q = query(collection(this.firestore, 'clientes'), where('numeroDocumento', '==', this.searchNumeroDocumento));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        const data = docSnapshot.data();
        this.foundRecord = { id: docSnapshot.id, ...data };
        this.clienteDocId = docSnapshot.id; // Almacenar el ID del documento
        this.message = 'Cliente encontrado. Puede actualizar sus datos o sus datos de voucher.';
        this.isSuccess = true;

        // Precargar el formulario principal con los datos encontrados para facilitar la edición
        this.formData.nombres = data['nombres'];
        this.formData.apellidos = data['apellidos'];
        this.formData.correo = data['correo'];
        this.formData.numeroDocumento = data['numeroDocumento'];
        this.formData.telefono = data['telefono'];
        this.formData.password = data['numeroDocumento']; // Precargar contraseña (si se usa numeroDocumento como tal)
        this.formData.privacyPolicy = true; // Asumimos que ya aceptó
        this.formData.rol = data['rol'] || 'usuario';

        this.formData.pasaporte = data['pasaporte'] || '';
        this.formData.whatsapp = data['whatsapp'] || '';
        this.formData.pais = data['pais'] || '';
        this.formData.ciudad = data['ciudad'] || '';
        this.formData.departamento = data['departamento'] || '';
        this.formData.fechaRegistro = data['fechaRegistro'] || '';
        this.formData.usuarioTelegram = data['usuarioTelegram'] ? `@${data['usuarioTelegram']}` : '';

        // Precargar los datos de los vouchers si existen
        if (data['vouchers'] && Array.isArray(data['vouchers'])) {
          this.vouchers = data['vouchers'].map((v: any) => ({
            valorConsignacion: v.valorConsignacion !== undefined ? parseFloat(v.valorConsignacion) : null,
            numeroVoucher: v.numeroVoucher || '',
            fechaConsignacion: v.fechaConsignacion || '',
            proyecto: v.proyecto || ''
          }));
          this.cantidadVouchers = this.vouchers.length > 0 ? this.vouchers.length : 1;
        } else {
          this.vouchers = []; // Asegurarse de que sea un array vacío si no hay vouchers
          this.cantidadVouchers = 1;
          this.generateVoucherForms(); // Generar un formulario vacío por defecto
        }

      } else {
        this.message = 'No se encontró ningún cliente con ese número de documento.';
        this.isSuccess = false;
        this.foundRecord = null;
        this.resetForm(); // Limpiar el formulario de cliente
        this.resetVouchersForms(); // Limpiar los formularios de voucher
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
   * Método para actualizar un cliente existente (UPDATE) - SOLO CAMPOS PRINCIPALES.
   * Este método ahora es similar a la parte de actualización dentro de onSubmitClient
   * pero se ejecuta de forma explícita desde el botón "Actualizar Datos".
   */
  // Este método fue eliminado en el HTML, por lo que su uso aquí no es directo.
  // Si deseas mantenerlo como una función separada, considera su invocación.
  /*
  async updateClient() {
    if (!this.foundRecord || !this.foundRecord.id) {
      this.message = 'Primero busque un cliente para actualizar.';
      this.isSuccess = false;
      return;
    }

    this.isLoading = true;
    this.message = '';

    // Validaciones antes de actualizar (las mismas que en onSubmitClient)
    if (!this.formData.nombres || !this.formData.apellidos || !this.formData.correo ||
        !this.formData.numeroDocumento || !this.formData.telefono || !this.formData.rol ||
        !this.formData.whatsapp || !this.formData.pais || !this.formData.ciudad || !this.formData.departamento ||
        !this.formData.usuarioTelegram) {
      this.message = 'Por favor, complete todos los campos obligatorios para actualizar.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }
    // ... (otras validaciones de formato)

    try {
      const docRef = doc(this.firestore, 'clientes', this.foundRecord.id);
      await updateDoc(docRef, {
        nombres: this.formData.nombres,
        apellidos: this.formData.apellidos,
        correo: this.formData.correo,
        numeroDocumento: this.formData.numeroDocumento,
        telefono: this.formData.telefono,
        whatsapp: this.formData.whatsapp,
        pasaporte: this.formData.pasaporte,
        pais: this.formData.pais,
        ciudad: this.formData.ciudad,
        departamento: this.formData.departamento,
        usuarioTelegram: this.formData.usuarioTelegram.startsWith('@') ? this.formData.usuarioTelegram.substring(1) : this.formData.usuarioTelegram,
        rol: this.formData.rol
      });

      this.message = 'Datos del cliente actualizados exitosamente.';
      this.isSuccess = true;
    } catch (e) {
      console.error('Error al actualizar cliente: ', e);
      this.message = 'Error al actualizar los datos del cliente. Inténtelo de nuevo.';
      this.isSuccess = false;
    } finally {
      this.isLoading = false;
    }
  }
  */

  /**
   * Método para eliminar un cliente (DELETE).
   */
  async deleteClient() {
    if (!this.foundRecord || !this.foundRecord.id) {
      this.message = 'Primero busque un cliente para eliminar.';
      this.isSuccess = false;
      return;
    }

    if (!confirm(`¿Está seguro de que desea eliminar al cliente ${this.foundRecord.nombres} ${this.foundRecord.apellidos} y sus datos de voucher?`)) {
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
      this.resetVouchersForms(); // También limpiar los formularios de voucher
      this.foundRecord = null;
      this.searchNumeroDocumento = '';
      this.clienteDocId = null; // Reiniciar el ID del cliente
    } catch (e) {
      console.error('Error al eliminar cliente: ', e);
      this.message = 'Error al eliminar el cliente. Inténtelo de nuevo.';
      this.isSuccess = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Método para registrar (actualizar) los datos de múltiples vouchers en el cliente existente.
   */
  async onSubmitVouchers() {
    this.isLoading = true;
    this.message = '';

    if (!this.clienteDocId) {
      this.message = 'Error: No se ha seleccionado o registrado un cliente para registrar los vouchers. Use el buscador o registre un cliente primero.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    // Validaciones para cada voucher
    for (const voucher of this.vouchers) {
      if (!voucher.valorConsignacion || !voucher.numeroVoucher ||
          !voucher.fechaConsignacion || !voucher.proyecto) {
        this.message = 'Por favor, complete todos los campos de todos los vouchers obligatorios.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
      }

      if (typeof voucher.valorConsignacion !== 'number' || voucher.valorConsignacion <= 0 || !/^\d+(\.\d{1,2})?$/.test(voucher.valorConsignacion.toString())) {
        this.message = 'El valor de consignación debe ser un número positivo (puede tener decimales).';
        this.isSuccess = false;
        this.isLoading = false;
        return;
      }

      if (!/^[a-zA-Z0-9]+$/.test(voucher.numeroVoucher)) {
        this.message = 'El número de voucher debe ser alfanumérico.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(voucher.fechaConsignacion)) {
        this.message = 'La fecha de consignación debe tener el formato AAAA-MM-DD.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
      }

      if (!this.proyectos.includes(voucher.proyecto)) {
        this.message = 'Uno de los proyectos seleccionados no es válido.';
        this.isSuccess = false;
        this.isLoading = false;
        return;
      }
    }

    try {
      const docRef = doc(this.firestore, 'clientes', this.clienteDocId);
      await updateDoc(docRef, {
        vouchers: this.vouchers // Guarda todo el array de vouchers
      });

      this.message = 'Datos de consignación registrados/actualizados exitosamente.';
      this.isSuccess = true;
      this.resetVouchersForms(); // Limpiar los formularios de voucher después de registrar
      // Opcional: Podrías buscar de nuevo el cliente para que el "foundRecord" refleje los nuevos vouchers.
      this.searchClient();
    } catch (e) {
      console.error('Error al registrar datos de consignación: ', e);
      this.message = 'Error al registrar los datos de consignación. Inténtelo de nuevo.';
      this.isSuccess = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Carga los datos del voucher para un cliente específico (utilizado después del registro principal o la búsqueda).
   * Esto es útil si el cliente ya tenía datos de voucher y quieres precargarlos.
   * Ahora carga un array de vouchers.
   */
  async findClientDocIdAndLoadVoucherData(numeroDocumento: string) {
    this.isLoading = true;
    this.message = '';
    this.clienteDocId = null; // Reiniciar el ID del cliente antes de buscar
    this.vouchers = []; // Limpiar vouchers existentes antes de cargar

    try {
      const q = query(collection(this.firestore, 'clientes'), where('numeroDocumento', '==', numeroDocumento));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        this.clienteDocId = docSnapshot.id;
        const data = docSnapshot.data();

        // Precargar datos de los vouchers si existen
        if (data['vouchers'] && Array.isArray(data['vouchers'])) {
          this.vouchers = data['vouchers'].map((v: any) => ({
            valorConsignacion: v.valorConsignacion !== undefined ? parseFloat(v.valorConsignacion) : null,
            numeroVoucher: v.numeroVoucher || '',
            fechaConsignacion: v.fechaConsignacion || '',
            proyecto: v.proyecto || ''
          }));
          this.cantidadVouchers = this.vouchers.length > 0 ? this.vouchers.length : 1;
        } else {
          this.vouchers = []; // Asegurarse de que sea un array vacío si no hay vouchers
          this.cantidadVouchers = 1;
          this.generateVoucherForms(); // Generar un formulario vacío por defecto
        }

      } else {
        this.message = 'Error interno: Cliente no encontrado para cargar/asociar datos de voucher.';
        this.isSuccess = false;
        this.clienteDocId = null;
      }
    } catch (e) {
      console.error('Error al buscar cliente por numeroDocumento para voucher:', e);
      this.message = 'Error al cargar datos del voucher.';
      this.isSuccess = false;
    } finally {
      this.isLoading = false;
    }
  }


  /**
   * Método para limpiar el formulario de cliente.
   */
  resetForm(): void {
    this.formData = {
      nombres: '',
      apellidos: '',
      correo: '',
      numeroDocumento: '',
      telefono: '',
      password: '',
      privacyPolicy: false,
      rol: 'usuario',

      pasaporte: '',
      whatsapp: '',
      pais: '',
      ciudad: '',
      departamento: '',
      fechaRegistro: '',
      usuarioTelegram: ''
    };
  }

  /**
   * Método para limpiar los formularios de vouchers y resetear la cantidad a 1.
   */
  resetVouchersForms(): void {
    this.cantidadVouchers = 1;
    this.vouchers = [];
    this.generateVoucherForms(); // Asegura que siempre haya un formulario vacío
  }
}