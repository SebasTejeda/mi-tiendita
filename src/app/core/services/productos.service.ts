// src/app/core/services/productos.service.ts

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
  orderBy,
  Timestamp,
  where,
  getDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Producto } from '../interfaces/models';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private productosCollection = collection(this.firestore, 'productos');

  /**
   * Obtener todos los productos ordenados por nombre
   */
  obtenerProductos(): Observable<Producto[]> {
    const q = query(this.productosCollection, orderBy('nombre', 'asc'));
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<Producto[]>;
    });
  }

  /**
   * Obtener productos con stock bajo (faltantes)
   */
  obtenerProductosFaltantes(): Observable<Producto[]> {
    const q = query(
      this.productosCollection,
      where('es_faltante', '==', true),
      orderBy('nombre', 'asc')
    );
    return runInInjectionContext(this.injector, () => {
    return collectionData(q, { idField: 'id' }) as Observable<Producto[]>;
    })
  }

  /**
   * Crear un nuevo producto
   */
  async crearProducto(producto: Omit<Producto, 'id'>): Promise<void> {
    try {
      const nuevoProducto = {
        ...producto,
        fecha_creacion: Timestamp.now(),
        es_faltante: producto.stock < producto.stock_minimo
      };

      await addDoc(this.productosCollection, nuevoProducto);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Producto creado exitosamente',
        showConfirmButton: false,
        timer: 2000
      });

    } catch (error) {
      console.error('Error al crear producto:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear el producto'
      });
      throw error;
    }
  }

  /**
   * Actualizar un producto existente
   */
  async actualizarProducto(id: string, producto: Partial<Producto>): Promise<void> {
    try {
      const productoRef = doc(this.firestore, 'productos', id);
      
      // Calcular si es faltante si se actualiza stock o stock_minimo
      const actualizacion: any = { ...producto };
      if ('stock' in producto || 'stock_minimo' in producto) {
        const stockActual = producto.stock ?? 0;
        const stockMinimo = producto.stock_minimo ?? 0;
        actualizacion.es_faltante = stockActual < stockMinimo;
      }

      await updateDoc(productoRef, actualizacion);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Producto actualizado',
        showConfirmButton: false,
        timer: 2000
      });

    } catch (error) {
      console.error('Error al actualizar producto:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo actualizar el producto'
      });
      throw error;
    }
  }

  /**
   * Eliminar un producto
   */
  async eliminarProducto(id: string): Promise<void> {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f56565',
      cancelButtonColor: '#a0aec0',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      const productoRef = doc(this.firestore, 'productos', id);
      await deleteDoc(productoRef);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Producto eliminado',
        showConfirmButton: false,
        timer: 2000
      });

    } catch (error) {
      console.error('Error al eliminar producto:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo eliminar el producto'
      });
      throw error;
    }
  }

  /**
   * Descontar stock de un producto
   */
async descontarStock(productoId: string, cantidad: number): Promise<void> {
  try {
    const productoRef = doc(this.firestore, 'productos', productoId);
    const productoSnap = await getDoc(productoRef);
    
    if (!productoSnap.exists()) {
      throw new Error('Producto no encontrado');
    }
    
    const productoData = productoSnap.data();
    const nuevoStock = productoData['stock'] - cantidad;
    const stockMinimo = productoData['stock_minimo'];
    
    await updateDoc(productoRef, {
      stock: nuevoStock,
      es_faltante: nuevoStock < stockMinimo
    });
    
  } catch (error) {
    console.error('Error al descontar stock:', error);
    throw error;
  }
}
}