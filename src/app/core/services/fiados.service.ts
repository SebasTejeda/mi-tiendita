import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Fiado, PagoFiado } from '../interfaces/models';
import Swal from 'sweetalert2';
import { getDocs } from 'firebase/firestore';

@Injectable({
  providedIn: 'root',
})
export class FiadosService {
  private firestore = inject(Firestore);
  private fiadosCollection = collection(this.firestore, 'fiados');
  private injector = inject(Injector);
  private pagosFiadosCollection = collection(this.firestore, 'pagos_fiados');

  /**
   * Obtener todos los fiados pendientes
   */
  obtenerFiadosPendientes(): Observable<Fiado[]> {
    const q = query(
      this.fiadosCollection,
      where('estado', '==', 'pendiente'),
      orderBy('fecha_fiado', 'desc'),
    );
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<Fiado[]>;
    });
  }

  /**
   * Obtener fiados de un cliente específico
   */
  obtenerFiadosPorCliente(clienteId: string): Observable<Fiado[]> {
    const q = query(
      this.fiadosCollection,
      where('clienteId', '==', clienteId),
      where('estado', '==', 'pendiente'),
      orderBy('fecha_fiado', 'desc'),
    );
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<Fiado[]>;
    });
  }

  /**
   * Obtener historial de pagos
   */
  obtenerHistorialPagos(): Observable<PagoFiado[]> {
    const q = query(this.pagosFiadosCollection, orderBy('fecha_pago', 'desc'));
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<PagoFiado[]>;
    });
  }

  /**
   * Pagar un ticket de fiado completo
   */
  async pagarTicket(
    fiadoId: string,
    nombreCliente: string,
    clienteId: string,
    monto: number,
  ): Promise<void> {
    try {
      Swal.fire({
        title: 'Procesando pago...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // Marcar el fiado como pagado
      const fiadoRef = doc(this.firestore, 'fiados', fiadoId);
      await updateDoc(fiadoRef, { estado: 'pagado' });

      // Registrar el pago en historial
      await addDoc(this.pagosFiadosCollection, {
        clienteId,
        nombre_cliente: nombreCliente,
        monto_pagado: monto,
        fecha_pago: Timestamp.now(),
        tipo_pago: 'Pago de Ticket',
        tickets_pagados: [fiadoId],
      });

      Swal.close();
      Swal.fire({
        icon: 'success',
        title: 'Pago registrado',
        text: `Monto: S/ ${monto.toFixed(2)}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.close();
      console.error('Error al pagar ticket:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar el pago',
      });
      throw error;
    }
  }

  /**
   * Pagar toda la deuda de un cliente
   */
  async pagarDeudaTotal(
    clienteId: string,
    nombreCliente: string,
    fiados: Fiado[],
    metodoPago?: 'efectivo' | 'yape' | 'plin',
    receptor?: string,
  ): Promise<void> {
    try {
      Swal.fire({
        title: 'Procesando pago total...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const montoTotal = fiados.reduce((sum, f) => sum + f.monto_deuda, 0);
      const ticketsIds = fiados.map((f) => f.id);

      // Marcar todos los fiados como pagados
      for (const fiado of fiados) {
        const fiadoRef = doc(this.firestore, 'fiados', fiado.id);
        await updateDoc(fiadoRef, { estado: 'pagado' });
      }

      // Registrar el pago
      await addDoc(this.pagosFiadosCollection, {
        clienteId,
        nombre_cliente: nombreCliente,
        monto_pagado: montoTotal,
        fecha_pago: Timestamp.now(),
        tipo_pago: 'Pago Total',
        tickets_pagados: ticketsIds,
        metodoPago: metodoPago,
        receptor: receptor,
      });

      Swal.close();
      Swal.fire({
        icon: 'success',
        title: '¡Deuda liquidada!',
        text: `Total pagado: S/ ${montoTotal.toFixed(2)}`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.close();
      console.error('Error al pagar deuda total:', error);
      throw error;
    }
  }

  /**
   * Registrar un abono parcial
   */
  /**
   * Registrar un abono parcial y descontar de los tickets
   */
  async abonarParcial(
    clienteId: string,
    nombreCliente: string,
    monto: number,
    metodoPago: 'efectivo' | 'yape' | 'plin',
    receptor?: string,
  ): Promise<void> {
    try {
      Swal.fire({
        title: 'Procesando pago...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // 1. Obtener todos los fiados pendientes del cliente
      const fiadosRef = collection(this.firestore, 'fiados');
      const q = query(
        fiadosRef,
        where('clienteId', '==', clienteId),
        where('estado', '==', 'pendiente'),
      );

      const querySnapshot = await getDocs(q);
      let fiadosPendientes = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Fiado[];

      // ✅ ORDENAR DEL MÁS BARATO AL MÁS CARO
      fiadosPendientes = fiadosPendientes.sort((a, b) => a.monto_deuda - b.monto_deuda);

      let montoRestante = monto;
      const ticketsPagados: string[] = [];
      let ticketsActualizados = 0;

      // 2. Ir descontando del monto de cada ticket
      for (const fiado of fiadosPendientes) {
        if (montoRestante <= 0) break;

        const fiadoRef = doc(this.firestore, 'fiados', fiado.id);

        if (montoRestante >= fiado.monto_deuda) {
          // El abono cubre todo este ticket
          montoRestante -= fiado.monto_deuda;

          await updateDoc(fiadoRef, {
            estado: 'pagado',
            monto_deuda: 0,
          });

          ticketsPagados.push(fiado.id);
        } else {
          // El abono solo cubre parte de este ticket
          const nuevoMonto = fiado.monto_deuda - montoRestante;

          await updateDoc(fiadoRef, {
            monto_deuda: nuevoMonto,
          });

          ticketsActualizados++;
          montoRestante = 0;
          break;
        }
      }

      // 3. Registrar el pago en el historial
      await addDoc(this.pagosFiadosCollection, {
        clienteId,
        nombre_cliente: nombreCliente,
        monto_pagado: monto,
        fecha_pago: Timestamp.now(),
        tipo_pago: 'Abono Parcial',
        tickets_pagados: ticketsPagados,
        metodo_pago: metodoPago,
        receptor: receptor,
      });

      Swal.close();

      const mensajeResultado = [];
      if (ticketsPagados.length > 0) {
        mensajeResultado.push(`✅ ${ticketsPagados.length} ticket(s) liquidado(s)`);
      }
      if (ticketsActualizados > 0) {
        mensajeResultado.push(`📝 ${ticketsActualizados} ticket(s) con saldo actualizado`);
      }

      Swal.fire({
        icon: 'success',
        title: 'Pago registrado',
        html: `
        <p>Monto pagado: <strong>S/ ${monto.toFixed(2)}</strong></p>
        ${mensajeResultado.map((m) => `<p>${m}</p>`).join('')}
      `,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.close();
      console.error('Error al registrar abono:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar el pago',
      });
      throw error;
    }
  }

  /**
   * Obtener pagos de fiados del día actual
   */
  obtenerPagosFiadosHoy(): Observable<PagoFiado[]> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const q = query(
      this.pagosFiadosCollection,
      where('fecha_pago', '>=', Timestamp.fromDate(hoy)),
      orderBy('fecha_pago', 'desc'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<PagoFiado[]>;
  }
}
