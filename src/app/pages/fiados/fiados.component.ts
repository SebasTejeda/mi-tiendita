import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiadosService } from '../../core/services/fiados.service';
import { ClientesService } from '../../core/services/clientes.service';
import { ConfiguracionService } from '../../core/services/configuracion.service'; // ✅ Nuevo
import { Fiado, PagoFiado, Cliente, Receptor } from '../../core/interfaces/models'; // ✅ Agregar Receptor
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

interface ClienteFiado {
  clienteId: string;
  nombre: string;
  fiados: Fiado[];
  deuda_total: number;
  cantidad_tickets: number;
}

@Component({
  selector: 'app-fiados',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fiados.component.html',
  styleUrl: './fiados.component.scss'
})
export class FiadosComponent implements OnInit, OnDestroy {
  fiadosService = inject(FiadosService);
  clientesService = inject(ClientesService);
  configuracionService = inject(ConfiguracionService); // ✅ Nuevo

  fiados: Fiado[] = [];
  historial: PagoFiado[] = [];
  clientes: Cliente[] = [];
  receptores: Receptor[] = []; // ✅ Nuevo
  isLoading = true;

  modalAbierto = signal(false);
  clienteSeleccionado: ClienteFiado | null = null;
  pestanaActiva = 'deudas';

  private fiadosSubscription?: Subscription;
  private historialSubscription?: Subscription;
  private clientesSubscription?: Subscription;
  private receptoresSubscription?: Subscription; // ✅ Nuevo

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.fiadosSubscription?.unsubscribe();
    this.historialSubscription?.unsubscribe();
    this.clientesSubscription?.unsubscribe();
    this.receptoresSubscription?.unsubscribe(); // ✅ Nuevo
  }

  cargarDatos(): void {
    this.isLoading = true;

    this.fiadosSubscription?.unsubscribe();
    this.historialSubscription?.unsubscribe();
    this.clientesSubscription?.unsubscribe();
    this.receptoresSubscription?.unsubscribe(); // ✅ Nuevo

    this.fiadosSubscription = this.fiadosService.obtenerFiadosPendientes().subscribe(fiados => {
      this.fiados = fiados;
      this.isLoading = false;

      if (this.modalAbierto() && this.clienteSeleccionado) {
        const clienteActualizado = this.clientesAgrupados.find(
          c => c.clienteId === this.clienteSeleccionado!.clienteId
        );

        if (clienteActualizado && clienteActualizado.deuda_total > 0) {
          this.clienteSeleccionado = clienteActualizado;
        } else {
          this.cerrarModal();
        }
      }
    });

    this.historialSubscription = this.fiadosService.obtenerHistorialPagos().subscribe(historial => {
      this.historial = historial;
    });

    this.clientesSubscription = this.clientesService.obtenerClientes().subscribe(clientes => {
      this.clientes = clientes;
    });

    // ✅ Cargar receptores activos
    this.receptoresSubscription = this.configuracionService.obtenerReceptoresActivos().subscribe(receptores => {
      this.receptores = receptores;
    });
  }

  get clientesAgrupados(): ClienteFiado[] {
    const grupos = new Map<string, ClienteFiado>();

    this.fiados.forEach(fiado => {
      if (!grupos.has(fiado.clienteId)) {
        grupos.set(fiado.clienteId, {
          clienteId: fiado.clienteId,
          nombre: fiado.nombre_cliente,
          fiados: [],
          deuda_total: 0,
          cantidad_tickets: 0
        });
      }

      const grupo = grupos.get(fiado.clienteId)!;
      grupo.fiados.push(fiado);
      grupo.deuda_total += fiado.monto_deuda;
      grupo.cantidad_tickets++;
    });

    return Array.from(grupos.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }

  verDetalles(cliente: ClienteFiado): void {
    this.clienteSeleccionado = cliente;
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.clienteSeleccionado = null;
    this.pestanaActiva = 'deudas';
  }

  async abrirModalAbono(): Promise<void> {
    if (!this.clienteSeleccionado) return;

    // Paso 1: Pedir el monto
    const { value: montoAbono } = await Swal.fire({
      title: '💵 Monto del Pago',
      html: `
        <p style="margin-bottom: 1rem;">Deuda Total: <strong style="color: #dc2626; font-size: 1.25rem;">S/ ${this.clienteSeleccionado.deuda_total.toFixed(2)}</strong></p>
        <input 
          id="monto-abono" 
          type="number" 
          class="swal2-input" 
          placeholder="Ingresa el monto pagado"
          step="0.01"
          min="0.01"
          max="${this.clienteSeleccionado.deuda_total}"
          style="width: 90%; font-size: 1.1rem;"
        />
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
      focusConfirm: false,
      preConfirm: () => {
        const input = document.getElementById('monto-abono') as HTMLInputElement;
        const monto = parseFloat(input.value);

        if (!monto || monto <= 0) {
          Swal.showValidationMessage('Ingresa un monto válido');
          return false;
        }

        if (monto > this.clienteSeleccionado!.deuda_total) {
          Swal.showValidationMessage(`El monto no puede ser mayor a S/ ${this.clienteSeleccionado!.deuda_total.toFixed(2)}`);
          return false;
        }

        return monto;
      }
    });

    if (!montoAbono) return;

    // Paso 2: Pedir el método de pago con iconos
    let selectedMethod = '';

    const { value: metodoPago } = await Swal.fire({
      title: '¿Cómo pagó?',
      html: `
        <style>
          .payment-option {
            display: flex;
            align-items: center;
            padding: 1rem;
            margin: 0.5rem 0;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
          }
          .payment-option:hover {
            border-color: #667eea;
            background: #f9fafb;
            transform: translateX(5px);
          }
          .payment-option img {
            width: 32px;
            height: 32px;
            margin-right: 1rem;
          }
          .payment-option span {
            font-size: 1.1rem;
            font-weight: 600;
            color: #374151;
          }
          .payment-option.selected {
            border-color: #667eea;
            background: #eef2ff;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
          }
        </style>
        
        <div id="payment-options">
          <div class="payment-option" data-value="efectivo">
            <img src="https://cdn-icons-png.flaticon.com/512/438/438526.png" alt="Efectivo">
            <span>Efectivo</span>
          </div>
          <div class="payment-option" data-value="yape">
            <img src="https://vectorseek.com/wp-content/uploads/2023/09/Yape-App-Logo-Vector.svg-.png" alt="Yape">
            <span>Yape</span>
          </div>
          <div class="payment-option" data-value="plin">
            <img src="https://images.seeklogo.com/logo-png/38/2/plin-logo-png_seeklogo-386806.png" alt="Plin">
            <span>Plin</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
      didOpen: () => {
        const options = document.querySelectorAll('.payment-option');

        options.forEach(option => {
          option.addEventListener('click', () => {
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedMethod = option.getAttribute('data-value') || '';
          });
        });
      },
      preConfirm: () => {
        if (!selectedMethod) {
          Swal.showValidationMessage('Debes seleccionar un método de pago');
          return false;
        }
        return selectedMethod;
      }
    });

    if (!metodoPago) return;

    let receptor: string | undefined;

    // Paso 3: Si es Yape o Plin, preguntar a quién le pagó (DINÁMICO)
    if (metodoPago === 'yape' || metodoPago === 'plin') {
      let selectedReceptor = '';

      // ✅ Usar receptores dinámicos
      const opcionesReceptores = this.receptores.map(r =>
        `<div class="receptor-option" data-value="${r.nombre}">${r.nombre}</div>`
      ).join('');

      const { value: receptorInput } = await Swal.fire({
        title: '¿A quién le llegó el dinero?',
        html: `
          <style>
            .receptor-option {
              display: flex;
              align-items: center;
              padding: 0.75rem 1rem;
              margin: 0.5rem 0;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              background: white;
              font-size: 1rem;
              font-weight: 500;
            }
            .receptor-option:hover {
              border-color: #667eea;
              background: #f9fafb;
            }
            .receptor-option.selected {
              border-color: #667eea;
              background: #eef2ff;
              font-weight: 600;
            }
          </style>
          
          <div id="receptor-options">
            ${opcionesReceptores}
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#48bb78',
        didOpen: () => {
          const options = document.querySelectorAll('.receptor-option');

          options.forEach(option => {
            option.addEventListener('click', () => {
              options.forEach(opt => opt.classList.remove('selected'));
              option.classList.add('selected');
              selectedReceptor = option.getAttribute('data-value') || '';
            });
          });
        },
        preConfirm: () => {
          if (!selectedReceptor) {
            Swal.showValidationMessage('Debes seleccionar un receptor');
            return false;
          }
          return selectedReceptor;
        }
      });

      if (!receptorInput) return;
      receptor = receptorInput;
    }

    // Paso 4: Confirmar el pago
    const confirmacion = await Swal.fire({
      title: 'Confirmar Pago',
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p><strong>Cliente:</strong> ${this.clienteSeleccionado.nombre}</p>
          <p><strong>Monto:</strong> S/ ${montoAbono.toFixed(2)}</p>
          <p><strong>Método:</strong> ${metodoPago.toUpperCase()}</p>
          ${receptor ? `<p><strong>Receptor:</strong> ${receptor}</p>` : ''}
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ Registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      if (montoAbono === this.clienteSeleccionado.deuda_total) {
        await this.fiadosService.pagarDeudaTotal(
          this.clienteSeleccionado.clienteId,
          this.clienteSeleccionado.nombre,
          this.clienteSeleccionado.fiados,
          metodoPago as any,
          receptor
        );
      } else {
        await this.fiadosService.abonarParcial(
          this.clienteSeleccionado.clienteId,
          this.clienteSeleccionado.nombre,
          montoAbono,
          metodoPago as any,
          receptor
        );
      }
    } catch (error) {
      console.error('Error al registrar abono:', error);
    }
  }

  async liquidarDeudaTotal(): Promise<void> {
    if (!this.clienteSeleccionado) return;

    // Paso 1: Pedir método de pago
    let selectedMethod = '';

    const { value: metodoPago } = await Swal.fire({
      title: '¿Cómo pagó?',
      html: `
        <style>
          .payment-option {
            display: flex;
            align-items: center;
            padding: 1rem;
            margin: 0.5rem 0;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
          }
          .payment-option:hover {
            border-color: #667eea;
            background: #f9fafb;
            transform: translateX(5px);
          }
          .payment-option img {
            width: 32px;
            height: 32px;
            margin-right: 1rem;
          }
          .payment-option span {
            font-size: 1.1rem;
            font-weight: 600;
            color: #374151;
          }
          .payment-option.selected {
            border-color: #667eea;
            background: #eef2ff;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
          }
        </style>
        
        <div id="payment-options">
          <div class="payment-option" data-value="efectivo">
            <img src="https://cdn-icons-png.flaticon.com/512/438/438526.png" alt="Efectivo">
            <span>Efectivo</span>
          </div>
          <div class="payment-option" data-value="yape">
            <img src="https://vectorseek.com/wp-content/uploads/2023/09/Yape-App-Logo-Vector.svg-.png" alt="Yape">
            <span>Yape</span>
          </div>
          <div class="payment-option" data-value="plin">
            <img src="https://images.seeklogo.com/logo-png/38/2/plin-logo-png_seeklogo-386806.png" alt="Plin">
            <span>Plin</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
      didOpen: () => {
        const options = document.querySelectorAll('.payment-option');

        options.forEach(option => {
          option.addEventListener('click', () => {
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedMethod = option.getAttribute('data-value') || '';
          });
        });
      },
      preConfirm: () => {
        if (!selectedMethod) {
          Swal.showValidationMessage('Debes seleccionar un método de pago');
          return false;
        }
        return selectedMethod;
      }
    });

    if (!metodoPago) return;

    let receptor: string | undefined;

    // Paso 2: Si es yape o plin, pedir receptor (DINÁMICO)
    if (metodoPago === 'yape' || metodoPago === 'plin') {
      let selectedReceptor = '';

      // ✅ Usar receptores dinámicos
      const opcionesReceptores = this.receptores.map(r =>
        `<div class="receptor-option" data-value="${r.nombre}">${r.nombre}</div>`
      ).join('');

      const { value: receptorInput } = await Swal.fire({
        title: '¿A quién le llegó el dinero?',
        html: `
          <style>
            .receptor-option {
              display: flex;
              align-items: center;
              padding: 0.75rem 1rem;
              margin: 0.5rem 0;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              background: white;
              font-size: 1rem;
              font-weight: 500;
            }
            .receptor-option:hover {
              border-color: #667eea;
              background: #f9fafb;
            }
            .receptor-option.selected {
              border-color: #667eea;
              background: #eef2ff;
              font-weight: 600;
            }
          </style>
          
          <div id="receptor-options">
            ${opcionesReceptores}
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#48bb78',
        didOpen: () => {
          const options = document.querySelectorAll('.receptor-option');

          options.forEach(option => {
            option.addEventListener('click', () => {
              options.forEach(opt => opt.classList.remove('selected'));
              option.classList.add('selected');
              selectedReceptor = option.getAttribute('data-value') || '';
            });
          });
        },
        preConfirm: () => {
          if (!selectedReceptor) {
            Swal.showValidationMessage('Debes seleccionar un receptor');
            return false;
          }
          return selectedReceptor;
        }
      });

      if (!receptorInput) return;
      receptor = receptorInput;
    }

    // Paso 3: Confirmar liquidación
    const confirmacion = await Swal.fire({
      title: '¿Liquidar toda la deuda?',
      html: `
        <p>Cliente: <strong>${this.clienteSeleccionado.nombre}</strong></p>
        <p style="font-size: 1.5rem; color: #dc2626; margin: 1rem 0;">
          Total: <strong>S/ ${this.clienteSeleccionado.deuda_total.toFixed(2)}</strong>
        </p>
        <p><strong>Método:</strong> ${metodoPago.toUpperCase()}</p>
        ${receptor ? `<p><strong>Receptor:</strong> ${receptor}</p>` : ''}
        <p style="color: #6b7280;">Se marcarán ${this.clienteSeleccionado.cantidad_tickets} tickets como pagados</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ Sí, liquidar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
      cancelButtonColor: '#a0aec0'
    });

    if (!confirmacion.isConfirmed) return;

    await this.fiadosService.pagarDeudaTotal(
      this.clienteSeleccionado.clienteId,
      this.clienteSeleccionado.nombre,
      this.clienteSeleccionado.fiados,
      metodoPago as any,
      receptor
    );
  }

  formatearFecha(timestamp: any): string {
    const fecha = timestamp.toDate();
    return fecha.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}