// src/app/core/services/carrito.service.ts

import { Injectable, signal, computed } from '@angular/core';
import { ItemVenta } from '../interfaces/models';

@Injectable({
  providedIn: 'root'
})
export class CarritoService {
  // Signal con los items del carrito
  private itemsCarrito = signal<ItemVenta[]>([]);

  // Computed para obtener los items (solo lectura)
  items = computed(() => this.itemsCarrito());

  // Computed para calcular el total
  total = computed(() => {
    return this.itemsCarrito().reduce((sum, item) => sum + item.subtotal, 0);
  });

  // Computed para contar items
  cantidadItems = computed(() => {
    return this.itemsCarrito().reduce((sum, item) => sum + item.cantidad, 0);
  });

  /**
   * Agregar un producto al carrito
   */
  agregarProducto(
    productoId: string,
    producto: string,
    precioUnitario: number,
    cantidad: number = 1
  ): void {
    const items = this.itemsCarrito();
    
    // Verificar si el producto ya está en el carrito
    const index = items.findIndex(item => item.productoId === productoId);

    if (index !== -1) {
      // Si ya existe, aumentar cantidad
      const nuevoItems = [...items];
      nuevoItems[index] = {
        ...nuevoItems[index],
        cantidad: nuevoItems[index].cantidad + cantidad,
        subtotal: (nuevoItems[index].cantidad + cantidad) * precioUnitario
      };
      this.itemsCarrito.set(nuevoItems);
    } else {
      // Si no existe, agregarlo
      const nuevoItem: ItemVenta = {
        productoId,
        producto,
        precio_unitario: precioUnitario,
        cantidad,
        subtotal: precioUnitario * cantidad
      };
      this.itemsCarrito.set([...items, nuevoItem]);
    }
  }

  /**
   * Actualizar cantidad de un item
   */
  actualizarCantidad(productoId: string, nuevaCantidad: number): void {
    if (nuevaCantidad <= 0) {
      this.eliminarItem(productoId);
      return;
    }

    const items = this.itemsCarrito();
    const index = items.findIndex(item => item.productoId === productoId);

    if (index !== -1) {
      const nuevoItems = [...items];
      nuevoItems[index] = {
        ...nuevoItems[index],
        cantidad: nuevaCantidad,
        subtotal: nuevaCantidad * nuevoItems[index].precio_unitario
      };
      this.itemsCarrito.set(nuevoItems);
    }
  }

  /**
   * Eliminar un item del carrito
   */
  eliminarItem(productoId: string): void {
    const items = this.itemsCarrito();
    this.itemsCarrito.set(items.filter(item => item.productoId !== productoId));
  }

  /**
   * Vaciar el carrito
   */
  vaciarCarrito(): void {
    this.itemsCarrito.set([]);
  }

  /**
   * Verificar si el carrito está vacío
   */
  estaVacio(): boolean {
    return this.itemsCarrito().length === 0;
  }
}