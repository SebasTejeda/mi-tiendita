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
  orderBy
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Cliente } from '../interfaces/models';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class ClientesService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private clientesCollection = collection(this.firestore, 'clientes');

  obtenerClientes(): Observable<Cliente[]> {
    const q = query(this.clientesCollection, orderBy('nombre', 'asc'));
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<Cliente[]>;
    });
  }

  async crearCliente(cliente: Omit<Cliente, 'id'>): Promise<void> {
    try {
      await addDoc(this.clientesCollection, cliente);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Cliente creado',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (error) {
      console.error('Error al crear cliente:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear el cliente'
      });
      throw error;
    }
  }

  async actualizarCliente(id: string, cliente: Partial<Cliente>): Promise<void> {
    try {
      const clienteRef = doc(this.firestore, 'clientes', id);
      await updateDoc(clienteRef, cliente);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Cliente actualizado',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
      throw error;
    }
  }

  async eliminarCliente(id: string): Promise<void> {
    const result = await Swal.fire({
      title: '¿Eliminar cliente?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f56565',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Eliminar'
    });

    if (!result.isConfirmed) return;

    try {
      const clienteRef = doc(this.firestore, 'clientes', id);
      await deleteDoc(clienteRef);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Cliente eliminado',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      throw error;
    }
  }
}