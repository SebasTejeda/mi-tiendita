import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnvasesService } from '../../core/services/envases.service';
import { ClientesService } from '../../core/services/clientes.service';
import { Envase, DevolucionEnvase, Cliente } from '../../core/interfaces/models';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

interface ClienteConEnvases {
  clienteId: string;
  nombre: string;
  envases: Envase[];
  total_pendiente: number;
  cantidad_total: number;
}

@Component({
  selector: 'app-envases',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './envases.component.html',
  styleUrl: './envases.component.scss'
})
export class EnvasesComponent implements OnInit, OnDestroy {
  envasesService = inject(EnvasesService);
  clientesService = inject(ClientesService);

  envases: Envase[] = [];
  devoluciones: DevolucionEnvase[] = [];
  clientes: Cliente[] = [];
  isLoading = true;

  modalAbierto = signal(false);
  clienteSeleccionado: ClienteConEnvases | null = null;

  // ✅ AGREGAR SUBSCRIPCIONES
  private envasesSubscription?: Subscription;
  private devolucionesSubscription?: Subscription;
  private clientesSubscription?: Subscription;

  ngOnInit(): void {
    this.cargarDatos();
  }

  // ✅ LIMPIAR SUBSCRIPCIONES
  ngOnDestroy(): void {
    this.envasesSubscription?.unsubscribe();
    this.devolucionesSubscription?.unsubscribe();
    this.clientesSubscription?.unsubscribe();
  }

  // ✅ ACTUALIZADO: Cargar datos con Observables en tiempo real
  cargarDatos(): void {
    this.isLoading = true;

    // Cancelar subscripciones anteriores si existen
    this.envasesSubscription?.unsubscribe();
    this.devolucionesSubscription?.unsubscribe();
    this.clientesSubscription?.unsubscribe();

    // Subscribirse a cambios en tiempo real de envases
    this.envasesSubscription = this.envasesService.obtenerEnvasesPendientes().subscribe(envases => {
      this.envases = envases;
      this.isLoading = false;
      
      // ✅ Actualizar cliente seleccionado si el modal está abierto
      if (this.modalAbierto() && this.clienteSeleccionado) {
        const clienteActualizado = this.clientesAgrupados.find(
          c => c.clienteId === this.clienteSeleccionado!.clienteId
        );
        
        if (clienteActualizado && clienteActualizado.cantidad_total > 0) {
          this.clienteSeleccionado = clienteActualizado;
        } else {
          // Si ya no tiene envases, cerrar modal
          this.cerrarModal();
        }
      }
    });

    // Subscribirse a cambios en devoluciones
    this.devolucionesSubscription = this.envasesService.obtenerHistorialDevoluciones().subscribe(devoluciones => {
      this.devoluciones = devoluciones;
    });

    // Subscribirse a cambios en clientes
    this.clientesSubscription = this.clientesService.obtenerClientes().subscribe(clientes => {
      this.clientes = clientes;
    });
  }

  get clientesAgrupados(): ClienteConEnvases[] {
    const grupos = new Map<string, ClienteConEnvases>();

    this.envases.forEach(envase => {
      if (!grupos.has(envase.clienteId)) {
        grupos.set(envase.clienteId, {
          clienteId: envase.clienteId,
          nombre: envase.nombre_cliente,
          envases: [],
          total_pendiente: 0,
          cantidad_total: 0
        });
      }

      const grupo = grupos.get(envase.clienteId)!;
      grupo.envases.push(envase);
      grupo.total_pendiente += envase.monto_total;
      grupo.cantidad_total += envase.cantidad;
    });

    return Array.from(grupos.values()).sort((a, b) => 
      a.nombre.localeCompare(b.nombre)
    );
  }

  async abrirModalRegistrar(): Promise<void> {
    if (this.clientes.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No hay clientes',
        text: 'Debes crear un cliente antes de registrar envases',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Paso 1: Seleccionar cliente
    let selectedCliente = '';

    const opcionesHTML = this.clientes.map(c =>
      `<div class="receptor-option" data-value="${c.id}">${c.nombre}</div>`
    ).join('');

    const { value: clienteId } = await Swal.fire({
      title: 'Seleccionar Cliente',
      html: `
        <style>
          .receptor-option {
            padding: 0.75rem 1rem;
            margin: 0.5rem 0;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
            font-weight: 500;
          }
          .receptor-option:hover { 
            background: #f9fafb; 
            border-color: #667eea;
          }
          .receptor-option.selected {
            border-color: #667eea;
            background: #eef2ff;
            font-weight: 600;
          }
        </style>
        <div id="cliente-options">${opcionesHTML}</div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#667eea',
      didOpen: () => {
        const options = document.querySelectorAll('.receptor-option');
        options.forEach(option => {
          option.addEventListener('click', () => {
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedCliente = option.getAttribute('data-value') || '';
          });
        });
      },
      preConfirm: () => {
        if (!selectedCliente) {
          Swal.showValidationMessage('Debes seleccionar un cliente');
          return false;
        }
        return selectedCliente;
      }
    });

    if (!clienteId) return;

    const cliente = this.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    // Paso 2: Datos del envase
    const { value: formData } = await Swal.fire({
      title: 'Registrar Envase',
      html: `
        <style>
          .form-envase {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
            text-align: left;
            padding: 0.5rem;
          }
          
          .form-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .form-label {
            font-weight: 600;
            font-size: 0.9rem;
            color: #374151;
            margin: 0;
          }
          
          .form-select,
          .form-input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 0.95rem;
            transition: all 0.2s;
            background: white;
            box-sizing: border-box;
          }
          
          .form-select:focus,
          .form-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
          }
        </style>
        
        <div class="form-envase">
          <div class="form-group">
            <label class="form-label">Tipo de Envase:</label>
            <select id="tipo-envase" class="form-select">
              <option value="botella">🍾 Botella</option>
              <option value="caja_cerveza">📦 Caja de Cerveza</option>
              <option value="otro">📦 Otro</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Descripción:</label>
            <input 
              id="descripcion" 
              class="form-input" 
              type="text"
              placeholder="Ej: Botella vidrio 650ml"
            />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cantidad:</label>
              <input 
                id="cantidad" 
                type="number" 
                class="form-input" 
                placeholder="1" 
                min="1"
                value="1"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label">Precio por unidad (S/):</label>
              <input 
                id="monto" 
                type="number" 
                step="0.01" 
                class="form-input" 
                placeholder="1.00" 
                min="0.01"
                value="1.00"
              />
            </div>
          </div>
        </div>
      `,
      width: '500px',
      showCancelButton: true,
      confirmButtonText: '✅ Registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      focusConfirm: false,
      preConfirm: () => {
        const tipo = (document.getElementById('tipo-envase') as HTMLSelectElement).value;
        const descripcion = (document.getElementById('descripcion') as HTMLInputElement).value.trim();
        const cantidad = parseInt((document.getElementById('cantidad') as HTMLInputElement).value);
        const monto = parseFloat((document.getElementById('monto') as HTMLInputElement).value);

        if (!descripcion) {
          Swal.showValidationMessage('Debes ingresar una descripción');
          return false;
        }

        if (!cantidad || cantidad <= 0) {
          Swal.showValidationMessage('La cantidad debe ser mayor a 0');
          return false;
        }

        if (!monto || monto <= 0) {
          Swal.showValidationMessage('El precio debe ser mayor a 0');
          return false;
        }

        return { tipo, descripcion, cantidad, monto };
      }
    });

    if (!formData) return;

    await this.envasesService.registrarEnvase(
      clienteId,
      cliente.nombre,
      formData.tipo as any,
      formData.descripcion,
      formData.cantidad,
      formData.monto
    );
    
    // ✅ Los datos se actualizan automáticamente por el Observable
  }

  verDetalles(cliente: ClienteConEnvases): void {
    this.clienteSeleccionado = cliente;
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.clienteSeleccionado = null;
  }

  async devolverEnvase(envase: Envase): Promise<void> {
    const { value: cantidadDevuelta } = await Swal.fire({
      title: 'Devolución de Envase',
      html: `
        <style>
          .devolucion-info {
            background: #f9fafb;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            border-left: 4px solid #667eea;
          }
          
          .devolucion-info p {
            margin: 0.5rem 0;
            color: #374151;
            font-size: 0.95rem;
          }
          
          .devolucion-info strong {
            color: #1f2937;
            font-weight: 600;
          }
          
          .cantidad-input {
            width: 90%;
            padding: 0.75rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 1rem;
            margin-top: 1rem;
            transition: all 0.2s;
          }
          
          .cantidad-input:focus {
            outline: none;
            border-color: #16a34a;
            box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
          }
        </style>
        
        <div class="devolucion-info">
          <p><strong>📦 ${envase.descripcion}</strong></p>
          <p>Pendiente: <strong>${envase.cantidad}</strong> unidades</p>
          <p>Depósito por unidad: <strong>S/ ${envase.monto_por_unidad.toFixed(2)}</strong></p>
        </div>
        
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">
          Cantidad a devolver:
        </label>
        <input 
          id="cantidad-devuelta" 
          type="number" 
          class="cantidad-input" 
          placeholder="Cantidad"
          min="1"
          max="${envase.cantidad}"
          value="${envase.cantidad}"
        />
      `,
      width: '450px',
      showCancelButton: true,
      confirmButtonText: '✅ Registrar Devolución',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      preConfirm: () => {
        const input = document.getElementById('cantidad-devuelta') as HTMLInputElement;
        const cantidad = parseInt(input.value);

        if (!cantidad || cantidad <= 0) {
          Swal.showValidationMessage('Ingresa una cantidad válida');
          return false;
        }

        if (cantidad > envase.cantidad) {
          Swal.showValidationMessage(`No puede devolver más de ${envase.cantidad}`);
          return false;
        }

        return cantidad;
      }
    });

    if (!cantidadDevuelta) return;

    await this.envasesService.devolverEnvase(envase, cantidadDevuelta);
    
    // ✅ Los datos se actualizan automáticamente por el Observable
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