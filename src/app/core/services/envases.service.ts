import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Envase, DevolucionEnvase } from '../interfaces/models';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class EnvasesService {
  private firestore = inject(Firestore);
  private envasesCollection = collection(this.firestore, 'envases');
  private devolucionesCollection = collection(this.firestore, 'devoluciones_envases');
  private injector = inject(Injector);

  /**
   * Obtener todos los envases pendientes
   */
  obtenerEnvasesPendientes(): Observable<Envase[]> {
    const q = query(
      this.envasesCollection,
      where('estado', '==', 'pendiente'),
      orderBy('fecha_registro', 'desc'),
    );
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<Envase[]>;
    });
  }

  /**
   * Obtener envases pendientes de un cliente específico
   */
  obtenerEnvasesCliente(clienteId: string): Observable<Envase[]> {
    const q = query(
      this.envasesCollection,
      where('clienteId', '==', clienteId),
      where('estado', '==', 'pendiente'),
      orderBy('fecha_registro', 'desc'),
    );
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<Envase[]>;
    });
  }

  /**
   * Obtener historial de devoluciones
   */
  obtenerHistorialDevoluciones(): Observable<DevolucionEnvase[]> {
    const q = query(this.devolucionesCollection, orderBy('fecha_devolucion', 'desc'));
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<DevolucionEnvase[]>;
    });
  }

  /**
   * Registrar un nuevo envase/depósito
   */
  async registrarEnvase(
    clienteId: string,
    nombreCliente: string,
    tipo: 'botella' | 'caja_cerveza' | 'otro',
    descripcion: string,
    cantidad: number,
    montoPorUnidad: number,
  ): Promise<void> {
    try {
      await addDoc(this.envasesCollection, {
        clienteId,
        nombre_cliente: nombreCliente,
        tipo,
        descripcion,
        cantidad,
        monto_por_unidad: montoPorUnidad,
        monto_total: cantidad * montoPorUnidad,
        fecha_registro: Timestamp.now(),
        estado: 'pendiente',
      });

      Swal.fire({
        icon: 'success',
        title: 'Envase registrado',
        text: `${cantidad} ${descripcion} - Total: S/ ${(cantidad * montoPorUnidad).toFixed(2)}`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar el envase',
      });
    }
  }

  /**
   * Registrar devolución de envase
   */
  async devolverEnvase(envase: Envase, cantidadDevuelta: number): Promise<void> {
    try {
      const envaseRef = doc(this.firestore, 'envases', envase.id);

      if (cantidadDevuelta >= envase.cantidad) {
        // Devuelve todo - marcar como devuelto
        await updateDoc(envaseRef, {
          estado: 'devuelto',
          cantidad: 0,
        });
      } else {
        // Devuelve parcial - actualizar cantidad
        await updateDoc(envaseRef, {
          cantidad: envase.cantidad - cantidadDevuelta,
          monto_total: (envase.cantidad - cantidadDevuelta) * envase.monto_por_unidad,
        });
      }

      // Registrar la devolución en el historial
      await addDoc(this.devolucionesCollection, {
        clienteId: envase.clienteId,
        nombre_cliente: envase.nombre_cliente,
        envaseId: envase.id,
        descripcion: envase.descripcion,
        cantidad_devuelta: cantidadDevuelta,
        monto_devuelto: cantidadDevuelta * envase.monto_por_unidad,
        fecha_devolucion: Timestamp.now(),
      });

      Swal.fire({
        icon: 'success',
        title: 'Devolución registrada',
        html: `
          <p>${cantidadDevuelta} ${envase.descripcion} devuelto(s)</p>
          <p style="font-size: 1.5rem; color: #16a34a; font-weight: 700;">
            Devolver: S/ ${(cantidadDevuelta * envase.monto_por_unidad).toFixed(2)}
          </p>
        `,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar la devolución',
      });
    }
  }

  /**
   * Eliminar un envase (solo si fue un error de registro)
   */
  async eliminarEnvase(id: string): Promise<void> {
    const confirmacion = await Swal.fire({
      title: '¿Eliminar envase?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f56565',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const envaseRef = doc(this.firestore, 'envases', id);
      await deleteDoc(envaseRef);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Envase eliminado',
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo eliminar el envase',
      });
    }
  }
}
