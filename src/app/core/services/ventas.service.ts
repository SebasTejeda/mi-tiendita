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
  writeBatch
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Venta, ItemVenta, CuadreCaja, PagoFiado } from '../interfaces/models';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private ventasCollection = collection(this.firestore, 'ventas');

  /**
   * Obtener ventas de hoy
   */
  obtenerVentasHoy(): Observable<Venta[]> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const q = query(
      this.ventasCollection,
      where('fecha', '>=', Timestamp.fromDate(hoy)),
      orderBy('fecha', 'desc')
    );
    
    return runInInjectionContext(this.injector, ()=> {
      return collectionData(q, { idField: 'id' }) as Observable<Venta[]>;
  })
  }

  /**
   * Registrar una venta completa
   */
  async registrarVenta(
    items: ItemVenta[],
    metodoPago: 'efectivo' | 'yape' | 'plin' | 'fiado',
    receptor?: string,
    clienteId?: string,
    nombreCliente?: string
  ): Promise<string> {
    try {
      Swal.fire({
        title: 'Procesando venta...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const batch = writeBatch(this.firestore);
      
      // 1. Descontar stock de cada producto
      for (const item of items) {
        const productoRef = doc(this.firestore, 'productos', item.productoId);
        const productoSnap = await getDoc(productoRef);
        
        if (productoSnap.exists()) {
          const productoData = productoSnap.data();
          const nuevoStock = productoData['stock'] - item.cantidad;
          const stockMinimo = productoData['stock_minimo'];
          
          batch.update(productoRef, {
            stock: nuevoStock,
            es_faltante: nuevoStock < stockMinimo
          });
        }
      }

      // 2. Crear documento de venta
      const total = items.reduce((sum, item) => sum + item.subtotal, 0);
      
      const ventaData: Omit<Venta, 'id'> = {
        fecha: Timestamp.now(),
        total,
        metodo_pago: metodoPago,
        items
      };

      if (receptor) ventaData.receptor = receptor;
      if (clienteId) ventaData.clienteId = clienteId;
      if (nombreCliente) ventaData.nombre_cliente = nombreCliente;

      const ventaRef = await addDoc(this.ventasCollection, ventaData);

      // 3. Si es fiado, crear documento en colección fiados
      if (metodoPago === 'fiado' && clienteId && nombreCliente) {
        const fiadosCollection = collection(this.firestore, 'fiados');
        await addDoc(fiadosCollection, {
          clienteId,
          nombre_cliente: nombreCliente,
          monto_deuda: total,
          fecha_fiado: Timestamp.now(),
          estado: 'pendiente',
          productos_llevados: items
        });
      }

      // 4. Commit del batch
      await batch.commit();

      Swal.close();

      Swal.fire({
        icon: 'success',
        title: '¡Venta registrada!',
        text: `Total: S/ ${total.toFixed(2)}`,
        timer: 2000,
        showConfirmButton: false
      });

      return ventaRef.id;

    } catch (error) {
      Swal.close();
      console.error('Error al registrar venta:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar la venta'
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
  ventas.forEach(venta => {
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
  });

  // 2. Procesar PAGOS DE FIADOS del día
  pagosFiados.forEach(pago => {
    switch (pago.metodo_pago) {
      case 'efectivo':
        pagosFiadosEfectivo += pago.monto_pagado;
        totalEfectivo += pago.monto_pagado; // ✅ Sumar al total de efectivo
        break;
      case 'yape':
        pagosFiadosYape += pago.monto_pagado;
        totalYape += pago.monto_pagado; // ✅ Sumar al total de Yape
        if (pago.receptor) {
          transferencias[pago.receptor] = (transferencias[pago.receptor] || 0) + pago.monto_pagado;
        }
        break;
      case 'plin':
        pagosFiadosPlin += pago.monto_pagado;
        totalPlin += pago.monto_pagado; // ✅ Sumar al total de Plin
        if (pago.receptor) {
          transferencias[pago.receptor] = (transferencias[pago.receptor] || 0) + pago.monto_pagado;
        }
        break;
    }
  });

  const desgloseTransferencias = Object.entries(transferencias).map(([receptor, monto]) => ({
    receptor,
    monto
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
    desglose_transferencias: desgloseTransferencias
  };
}
}