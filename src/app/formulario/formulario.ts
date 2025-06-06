// src/app/formulario/formulario.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Importaciones de Firestore
import { Firestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';

// Para Firebase Authentication
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';

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

  // Propiedades para los datos del formulario de voucher
  formDataVoucher = {
    valorConsignacion: '',
    numeroVoucher: '',
    fechaConsignacion: '',
    proyecto: ''
  };

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
    // No hay lógica de inicialización específica ya que todo estará visible
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Método para registrar (crear) un nuevo cliente o manejar un cliente existente.
   */
  async onSubmitClient() { // Renombrado de nuevo a onSubmitClient
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

    // Validaciones de campos obligatorios
    if (!this.formData.nombres || !this.formData.apellidos || !this.formData.correo ||
        !this.formData.numeroDocumento || !this.formData.telefono || !this.formData.password || !this.formData.rol ||
        !this.formData.whatsapp || !this.formData.pais || !this.formData.ciudad || !this.formData.departamento ||
        !this.formData.usuarioTelegram) {
      this.message = 'Por favor, complete todos los campos obligatorios.';
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

    if (this.formData.pasaporte && !/^[a-zA-Z0-9]+$/.test(this.formData.pasaporte)) {
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
        this.message = 'Cliente existente: Los datos se actualizarán. Si desea modificar datos del voucher, hágalo en la sección correspondiente.';
        this.isSuccess = false; // No es un "registro nuevo exitoso"

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
          numeroDocumento: this.formData.numeroDocumento, // Mantener el mismo número de documento
          telefono: this.formData.telefono,
          whatsapp: this.formData.whatsapp,
          pasaporte: this.formData.pasaporte,
          pais: this.formData.pais,
          ciudad: this.formData.ciudad,
          departamento: this.formData.departamento,
          fechaRegistro: this.formData.fechaRegistro, // Actualizar fecha de registro si se quiere
          usuarioTelegram: this.formData.usuarioTelegram.startsWith('@') ? this.formData.usuarioTelegram.substring(1) : this.formData.usuarioTelegram,
          rol: this.formData.rol
          // Los campos de voucher no se tocan aquí, se manejan en onSubmitVoucher
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
          // Inicializar campos de voucher como null para que existan en el documento
          valorConsignacion: null,
          numeroVoucher: null,
          fechaConsignacion: null,
          proyecto: null
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
      this.resetForm(); // Opcional: limpiar el formulario principal después de un registro/actualización exitoso.

    } catch (e: any) {
      console.error('Error al registrar/procesar cliente:', e);
      this.isSuccess = false;

      if (e.code === 'auth/email-already-in-use') { // Removida la condición !userCreatedInAuth
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
      this.resetFormVoucher(); // Limpiar formulario de voucher
      this.clienteDocId = null;
      return;
    }

    this.isLoading = true;
    this.message = '';
    this.foundRecord = null;
    this.clienteDocId = null; // Resetear el ID del documento
    this.resetForm(); // Limpiar el formulario de cliente antes de cargar datos
    this.resetFormVoucher(); // Limpiar el formulario de voucher antes de cargar datos

    try {
      const q = query(collection(this.firestore, 'clientes'), where('numeroDocumento', '==', this.searchNumeroDocumento));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        this.foundRecord = { id: docSnapshot.id, ...docSnapshot.data() };
        this.clienteDocId = docSnapshot.id; // Almacenar el ID del documento
        this.message = 'Cliente encontrado. Puede actualizar sus datos o sus datos de voucher.';
        this.isSuccess = true;

        // Precargar el formulario principal con los datos encontrados para facilitar la edición
        this.formData.nombres = this.foundRecord.nombres;
        this.formData.apellidos = this.foundRecord.apellidos;
        this.formData.correo = this.foundRecord.correo;
        this.formData.numeroDocumento = this.foundRecord.numeroDocumento;
        this.formData.telefono = this.foundRecord.telefono;
        this.formData.password = this.foundRecord.numeroDocumento; // Precargar contraseña (si se usa numeroDocumento como tal)
        this.formData.privacyPolicy = true; // Asumimos que ya aceptó
        this.formData.rol = this.foundRecord.rol || 'usuario';

        this.formData.pasaporte = this.foundRecord.pasaporte || '';
        this.formData.whatsapp = this.foundRecord.whatsapp || '';
        this.formData.pais = this.foundRecord.pais || '';
        this.formData.ciudad = this.foundRecord.ciudad || '';
        this.formData.departamento = this.foundRecord.departamento || '';
        this.formData.fechaRegistro = this.foundRecord.fechaRegistro || '';
        this.formData.usuarioTelegram = this.foundRecord.usuarioTelegram ? `@${this.foundRecord.usuarioTelegram}` : '';

        // Precargar los datos del voucher si existen
        this.formDataVoucher.valorConsignacion = String(this.foundRecord.valorConsignacion || '');
        this.formDataVoucher.numeroVoucher = this.foundRecord.numeroVoucher || '';
        this.formDataVoucher.fechaConsignacion = this.foundRecord.fechaConsignacion || '';
        this.formDataVoucher.proyecto = this.foundRecord.proyecto || '';

      } else {
        this.message = 'No se encontró ningún cliente con ese número de documento.';
        this.isSuccess = false;
        this.foundRecord = null;
        this.resetForm(); // Limpiar el formulario de cliente
        this.resetFormVoucher(); // Limpiar el formulario de voucher
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
    if (this.formData.pasaporte && !/^[a-zA-Z0-9]+$/.test(this.formData.pasaporte)) {
      this.message = 'El pasaporte debe contener solo letras y números.';
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
    if (/\s/.test(this.formData.usuarioTelegram)) {
        this.message = 'El usuario de Telegram no debe contener espacios.';
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
      // No reseteamos el formulario completo para que puedan seguir editando si lo desean
      // this.resetForm();
      // this.foundRecord = null;
      // this.searchNumeroDocumento = '';
    } catch (e) {
      console.error('Error al actualizar cliente: ', e);
      this.message = 'Error al actualizar los datos del cliente. Inténtelo de nuevo.';
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
      this.resetFormVoucher(); // También limpiar el formulario de voucher
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
   * Método para registrar (actualizar) los datos del voucher en el cliente existente.
   */
  async onSubmitVoucher() {
    this.isLoading = true;
    this.message = '';

    if (!this.clienteDocId) {
      this.message = 'Error: No se ha seleccionado o registrado un cliente para registrar el voucher. Use el buscador o registre un cliente primero.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    // Validaciones específicas para los campos de voucher
    if (!this.formDataVoucher.valorConsignacion || !this.formDataVoucher.numeroVoucher ||
        !this.formDataVoucher.fechaConsignacion || !this.formDataVoucher.proyecto) {
      this.message = 'Por favor, complete todos los campos de consignación obligatorios.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(this.formDataVoucher.valorConsignacion) || parseFloat(this.formDataVoucher.valorConsignacion) <= 0) {
      this.message = 'El valor de consignación es obligatorio y debe ser un número positivo (puede tener decimales).';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(this.formDataVoucher.numeroVoucher)) {
      this.message = 'El número de voucher es obligatorio y debe ser alfanumérico.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.formDataVoucher.fechaConsignacion)) {
      this.message = 'La fecha de consignación debe tener el formato AAAA-MM-DD.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    if (!this.proyectos.includes(this.formDataVoucher.proyecto)) {
      this.message = 'El proyecto seleccionado no es válido.';
      this.isSuccess = false;
      this.isLoading = false;
      return;
    }

    try {
      const docRef = doc(this.firestore, 'clientes', this.clienteDocId);
      await updateDoc(docRef, {
        valorConsignacion: parseFloat(this.formDataVoucher.valorConsignacion),
        numeroVoucher: this.formDataVoucher.numeroVoucher,
        fechaConsignacion: this.formDataVoucher.fechaConsignacion,
        proyecto: this.formDataVoucher.proyecto
      });

      this.message = 'Datos de consignación registrados/actualizados exitosamente.';
      this.isSuccess = true;
      this.resetFormVoucher(); // Limpiar el formulario de voucher después de registrarlo
      // Mantener los datos del cliente principal y foundRecord si se habían buscado
      // para que el usuario pueda seguir interactuando con ese cliente.
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
   */
  async findClientDocIdAndLoadVoucherData(numeroDocumento: string) {
    this.isLoading = true;
    this.message = '';
    this.clienteDocId = null; // Reiniciar el ID del cliente antes de buscar

    try {
      const q = query(collection(this.firestore, 'clientes'), where('numeroDocumento', '==', numeroDocumento));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        this.clienteDocId = docSnapshot.id;
        const data = docSnapshot.data();

        // Precargar datos del voucher si existen
        this.formDataVoucher.valorConsignacion = String(data['valorConsignacion'] || '');
        this.formDataVoucher.numeroVoucher = data['numeroVoucher'] || '';
        this.formDataVoucher.fechaConsignacion = data['fechaConsignacion'] || '';
        this.formDataVoucher.proyecto = data['proyecto'] || '';

      } else {
        // Esto podría ocurrir si se llama después de un registro, pero el ID no se propagó correctamente.
        // O si el cliente fue eliminado.
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
   * Método para limpiar el formulario de voucher.
   */
  resetFormVoucher(): void {
    this.formDataVoucher = {
      valorConsignacion: '',
      numeroVoucher: '',
      fechaConsignacion: '',
      proyecto: ''
    };
  }
}