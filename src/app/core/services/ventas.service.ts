// src/app/core/services/ventas.service.ts

import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  getDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Venta, ItemVenta, CuadreCaja, PagoFiado, PagoVenta } from '../interfaces/models';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class VentasService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private ventasCollection = collection(this.firestore, 'ventas');
  private productosCollection = collection(this.firestore, 'productos');
  private fiadosCollection = collection(this.firestore, 'fiados');

  /**
   * Registrar una venta completa
   */
  async registrarVenta(
    items: ItemVenta[],
    metodoPago: 'efectivo' | 'yape' | 'plin' | 'fiado',
    receptor?: string,
    clienteId?: string,
    nombreCliente?: string,
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    try {
      // Validar stock
      for (const item of items) {
        const productoRef = doc(this.firestore, 'productos', item.productoId!);
        const producto = await this.obtenerProductoPorId(item.productoId!);

        if (!producto || producto.stock < item.cantidad) {
          throw new Error(`Stock insuficiente para ${item.producto}`);
        }

        const nuevoStock = producto.stock - item.cantidad;
        batch.update(productoRef, {
          stock: nuevoStock,
          es_faltante: nuevoStock <= producto.stock_minimo,
        });
      }

      // Registrar venta
      if (metodoPago === 'fiado') {
        if (!clienteId || !nombreCliente) {
          throw new Error('Se requiere cliente para ventas fiadas');
        }

        const fiadoRef = doc(this.fiadosCollection);
        batch.set(fiadoRef, {
          clienteId,
          nombre_cliente: nombreCliente,
          monto_deuda: total,
          fecha_fiado: Timestamp.now(),
          estado: 'pendiente',
          productos_llevados: items.map((item) => ({
            producto: item.producto,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.subtotal,
          })),
        });
      }

      const ventaRef = doc(this.ventasCollection);
      batch.set(ventaRef, {
        fecha: Timestamp.now(),
        total,
        metodo_pago: metodoPago,
        receptor: receptor || null,
        items,
        clienteId: clienteId || null,
        nombre_cliente: nombreCliente || null,
      });

      await batch.commit();

      Swal.fire({
        icon: 'success',
        title: '¡Venta registrada!',
        text: `Total: S/ ${total.toFixed(2)}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Error al registrar venta:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar la venta',
      });
      throw error;
    }
  }

async registrarVentaMixta(
    items: ItemVenta[],
    pagos: any[], // Usamos any o PagoVenta extendido para soportar clienteId
    clienteId?: string,
    nombreCliente?: string,
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalPagado = pagos.reduce((sum, pago) => sum + pago.monto, 0);

    try {
      // ✅ Validar que la suma de pagos coincida con el total
      if (Math.abs(totalPagado - total) > 0.01) {
        throw new Error(
          `El total de pagos (S/ ${totalPagado.toFixed(2)}) no coincide con el total (S/ ${total.toFixed(2)})`,
        );
      }

      // Validar stock y actualizar
      for (const item of items) {
        const productoRef = doc(this.firestore, 'productos', item.productoId!);
        const producto = await this.obtenerProductoPorId(item.productoId!);

        if (!producto || producto.stock < item.cantidad) {
          throw new Error(`Stock insuficiente para ${item.producto}`);
        }

        const nuevoStock = producto.stock - item.cantidad;
        batch.update(productoRef, {
          stock: nuevoStock,
          es_faltante: nuevoStock <= producto.stock_minimo,
        });
      }

      // ✅ NUEVO: Verificar si dentro de los pagos mixtos hay un fiado
      const pagoFiado = pagos.find((p) => p.metodo === 'fiado');
      
      if (pagoFiado) {
        if (!pagoFiado.clienteId || !pagoFiado.nombreCliente) {
          throw new Error('Se requiere cliente para la parte fiada');
        }

        // Crear el registro de la deuda por el monto exacto que se fió
        const fiadoRef = doc(this.fiadosCollection);
        batch.set(fiadoRef, {
          clienteId: pagoFiado.clienteId,
          nombre_cliente: pagoFiado.nombreCliente,
          monto_deuda: pagoFiado.monto, // Solo el monto fiado, no el total de la venta
          fecha_fiado: Timestamp.now(),
          estado: 'pendiente',
          productos_llevados: items.map((item) => ({
            producto: item.producto,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.subtotal,
          })),
        });
      }

      // Registrar venta con pagos múltiples
      const ventaRef = doc(this.ventasCollection);
      batch.set(ventaRef, {
        fecha: Timestamp.now(),
        total,
        pagos, 
        items,
        // Si hay fiado mixto, guardamos el cliente en la venta general también
        clienteId: pagoFiado ? pagoFiado.clienteId : (clienteId || null),
        nombre_cliente: pagoFiado ? pagoFiado.nombreCliente : (nombreCliente || null),
      });

      await batch.commit();

      // Mostrar resumen de pagos
      const resumenPagos = pagos
        .map(
          (p) =>
            `${p.metodo.toUpperCase()}: S/ ${p.monto.toFixed(2)}${p.receptor ? ` (${p.receptor})` : ''}${p.nombreCliente ? ` (${p.nombreCliente})` : ''}`,
        )
        .join('<br>');

      Swal.fire({
        icon: 'success',
        title: '¡Venta registrada!',
        html: `
          <p><strong>Total:</strong> S/ ${total.toFixed(2)}</p>
          <hr style="margin: 1rem 0;">
          <p style="text-align: left;">${resumenPagos}</p>
        `,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error('Error al registrar venta mixta:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo registrar la venta',
      });
      throw error;
    }
  }

  /**
   * Calcular cuadre de caja del día
   */
  /**
   * Calcular cuadre de caja del día (ventas + pagos de fiados)
   */
  async calcularCuadreCaja(ventas: Venta[], pagosFiados: PagoFiado[]): Promise<CuadreCaja> {
    let totalEfectivo = 0;
    let totalYape = 0;
    let totalPlin = 0;
    let totalFiados = 0;

    // ✅ NUEVOS: Pagos de fiados
    let pagosFiadosEfectivo = 0;
    let pagosFiadosYape = 0;
    let pagosFiadosPlin = 0;

    const transferencias: { [key: string]: number } = {};

    // 1. Procesar VENTAS del día
    // 1. Procesar VENTAS del día
    ventas.forEach((venta) => {
      // ✅ NUEVO: Si es una venta mixta (tiene el array de pagos)
      if (venta.pagos && venta.pagos.length > 0) {
        venta.pagos.forEach((pago: any) => {
          if (pago.metodo === 'efectivo') {
            totalEfectivo += pago.monto;
          } else if (pago.metodo === 'yape') {
            totalYape += pago.monto;
            if (pago.receptor) {
              transferencias[pago.receptor] = (transferencias[pago.receptor] || 0) + pago.monto;
            }
          } else if (pago.metodo === 'plin') {
            totalPlin += pago.monto;
            if (pago.receptor) {
              transferencias[pago.receptor] = (transferencias[pago.receptor] || 0) + pago.monto;
            }
          }
          else if (pago.metodo === 'fiado') {
            totalFiados += pago.monto;
          }
        });
      }
      // Lógica original para ventas de un solo método
      else {
        switch (venta.metodo_pago) {
          case 'efectivo':
            totalEfectivo += venta.total;
            break;
          case 'yape':
            totalYape += venta.total;
            if (venta.receptor) {
              transferencias[venta.receptor] = (transferencias[venta.receptor] || 0) + venta.total;
            }
            break;
          case 'plin':
            totalPlin += venta.total;
            if (venta.receptor) {
              transferencias[venta.receptor] = (transferencias[venta.receptor] || 0) + venta.total;
            }
            break;
          case 'fiado':
            totalFiados += venta.total;
            break;
        }
      }
    });

    // 2. Procesar PAGOS DE FIADOS del día
    pagosFiados.forEach((pago) => {
      switch (pago.metodo_pago) {
        case 'efectivo':
          pagosFiadosEfectivo += pago.monto_pagado;
          totalEfectivo += pago.monto_pagado; // ✅ Sumar al total de efectivo
          break;
        case 'yape':
          pagosFiadosYape += pago.monto_pagado;
          totalYape += pago.monto_pagado; // ✅ Sumar al total de Yape
          if (pago.receptor) {
            transferencias[pago.receptor] =
              (transferencias[pago.receptor] || 0) + pago.monto_pagado;
          }
          break;
        case 'plin':
          pagosFiadosPlin += pago.monto_pagado;
          totalPlin += pago.monto_pagado; // ✅ Sumar al total de Plin
          if (pago.receptor) {
            transferencias[pago.receptor] =
              (transferencias[pago.receptor] || 0) + pago.monto_pagado;
          }
          break;
      }
    });

    const desgloseTransferencias = Object.entries(transferencias).map(([receptor, monto]) => ({
      receptor,
      monto,
    }));

    return {
      total_efectivo: totalEfectivo,
      total_yape: totalYape,
      total_plin: totalPlin,
      total_fiados: totalFiados,
      // ✅ NUEVOS
      pagos_fiados_efectivo: pagosFiadosEfectivo,
      pagos_fiados_yape: pagosFiadosYape,
      pagos_fiados_plin: pagosFiadosPlin,
      desglose_transferencias: desgloseTransferencias,
    };
  }

  obtenerVentas(): Observable<Venta[]> {
    const q = query(this.ventasCollection, orderBy('fecha', 'desc'));
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<Venta[]>;
    });
  }

  obtenerVentasHoy(): Observable<Venta[]> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioDia = Timestamp.fromDate(hoy);

    const q = query(
      this.ventasCollection,
      where('fecha', '>=', inicioDia),
      orderBy('fecha', 'desc'),
    );
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<Venta[]>;
    });
  }

  private async obtenerProductoPorId(id: string): Promise<any> {
    const productoRef = doc(this.firestore, 'productos', id);
    const productoSnap = await getDoc(productoRef);

    if (productoSnap.exists()) {
      return { id: productoSnap.id, ...productoSnap.data() };
    }
    return null;
  }
}
