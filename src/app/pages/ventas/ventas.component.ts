import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductosService } from '../../core/services/productos.service';
import { VentasService } from '../../core/services/ventas.service';
import { ClientesService } from '../../core/services/clientes.service';
import { ConfiguracionService } from '../../core/services/configuracion.service'; // ✅ Nuevo
import { EnvasesService } from '../../core/services/envases.service';
import { CarritoService } from '../../core/services/carrito.service';
import { Producto, Cliente, Receptor } from '../../core/interfaces/models'; // ✅ Agregar Receptor
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs'; // ✅ Nuevo
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas.component.html',
  styleUrl: './ventas.component.scss',
})
export class VentasComponent implements OnInit, OnDestroy {
  productosService = inject(ProductosService);
  ventasService = inject(VentasService);
  clientesService = inject(ClientesService);
  configuracionService = inject(ConfiguracionService); // ✅ Nuevo
  envasesService = inject(EnvasesService);
  carritoService = inject(CarritoService);

  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];
  clientes: Cliente[] = [];
  receptores: Receptor[] = []; // ✅ Nuevo

  busqueda = '';
  categoriaSeleccionada = '';
  carritoVisible = signal(false);

  isLoading = true;

  // ✅ Subscripción para receptores
  private receptoresSubscription?: Subscription;

  ngOnInit(): void {
    this.cargarProductos();
    this.cargarClientes();
    this.cargarReceptores(); // ✅ Nuevo
  }

  // ✅ Nuevo método
  ngOnDestroy(): void {
    this.receptoresSubscription?.unsubscribe();
  }

  cargarProductos(): void {
    this.isLoading = true;
    this.productosService.obtenerProductos().subscribe((productos) => {
      this.productos = productos.filter((p) => p.stock > 0);
      this.productosFiltrados = this.productos;
      this.isLoading = false;
    });
  }

  cargarClientes(): void {
    this.clientesService.obtenerClientes().subscribe((clientes) => {
      this.clientes = clientes;
    });
  }

  // ✅ Nuevo método
  cargarReceptores(): void {
    this.receptoresSubscription = this.configuracionService
      .obtenerReceptoresActivos()
      .subscribe((receptores) => {
        this.receptores = receptores;
      });
  }

  get categorias(): string[] {
    const cats = [...new Set(this.productos.map((p) => p.categoria))];
    return cats.filter((c) => c && c.trim() !== '');
  }

  filtrarProductos(): void {
    this.productosFiltrados = this.productos.filter((p) => {
      const matchBusqueda = p.nombre.toLowerCase().includes(this.busqueda.toLowerCase());
      const matchCategoria =
        !this.categoriaSeleccionada || p.categoria === this.categoriaSeleccionada;
      return matchBusqueda && matchCategoria;
    });
  }

  seleccionarCategoria(categoria: string): void {
    this.categoriaSeleccionada = categoria;
    this.filtrarProductos();
  }

  agregarAlCarrito(producto: Producto): void {
    this.carritoService.agregarProducto(producto.id, producto.nombre, producto.precio, 1);
  }

  toggleCarrito(): void {
    this.carritoVisible.update((v) => !v);
  }

  async procesarVenta(): Promise<void> {
    if (this.carritoService.estaVacio()) {
      Swal.fire({
        icon: 'warning',
        title: 'Carrito vacío',
        text: 'Agrega productos antes de procesar la venta',
      });
      return;
    }

    const total = this.carritoService.total();

    // Paso 1: Elegir tipo de pago
    const { value: tipoPago } = await Swal.fire({
      title: '¿Cómo va a pagar?',
      html: `
      <style>
        .payment-type-option {
          display: flex;
          align-items: center;
          padding: 1rem 1.5rem;
          margin: 0.75rem 0;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }
        .payment-type-option:hover {
          border-color: #667eea;
          background: #f9fafb;
          transform: translateX(5px);
        }
        .payment-type-option .icon {
          font-size: 2rem;
          margin-right: 1rem;
        }
        .payment-type-option .content {
          text-align: left;
          flex: 1;
        }
        .payment-type-option .content h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1.1rem;
          color: #374151;
        }
        .payment-type-option .content p {
          margin: 0;
          font-size: 0.85rem;
          color: #6b7280;
        }
        .payment-type-option.selected {
          border-color: #667eea;
          background: #eef2ff;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
      </style>
      
      <div id="payment-type-options">
        <div class="payment-type-option" data-value="unico">
          <span class="icon">⚡</span>
          <div class="content">
            <h3>Pago Único</h3>
            <p>Un solo método de pago</p>
          </div>
        </div>
        <div class="payment-type-option" data-value="mixto">
          <span class="icon">💰</span>
          <div class="content">
            <h3>Pago Mixto</h3>
            <p>Combinar efectivo, Yape, Plin</p>
          </div>
        </div>
        <div class="payment-type-option" data-value="fiado">
          <span class="icon">📔</span>
          <div class="content">
            <h3>Fiar Todo</h3>
            <p>Registrar como deuda</p>
          </div>
        </div>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
      didOpen: () => {
        let selectedType = '';
        const options = document.querySelectorAll('.payment-type-option');

        options.forEach((option) => {
          option.addEventListener('click', () => {
            options.forEach((opt) => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedType = option.getAttribute('data-value') || '';
          });
        });
      },
      preConfirm: () => {
        const selected = document.querySelector('.payment-type-option.selected');
        if (!selected) {
          Swal.showValidationMessage('Debes seleccionar un tipo de pago');
          return false;
        }
        return selected.getAttribute('data-value');
      },
    });

    if (!tipoPago) return;

    // Paso 2: Procesar según el tipo elegido
    if (tipoPago === 'unico') {
      await this.procesarPagoUnico();
    } else if (tipoPago === 'mixto') {
      await this.procesarPagoMixto();
    } else if (tipoPago === 'fiado') {
      await this.procesarFiado();
    }
  }

  async verificarEnvasesRetornables(clienteId: string, nombreCliente: string): Promise<void> {
    const items = this.carritoService.items();
    const productosConEnvase = items.filter((item) => {
      const producto = this.productos.find((p) => p.nombre === item.producto);
      return producto?.es_retornable;
    });

    if (productosConEnvase.length === 0) return;

    const { isConfirmed } = await Swal.fire({
      title: '🍾 Envases Retornables',
      html: `
        <p>Esta venta incluye productos con envases retornables:</p>
        <ul style="text-align: left; padding-left: 2rem; margin: 1rem 0;">
          ${productosConEnvase
            .map((item) => {
              const producto = this.productos.find((p) => p.nombre === item.producto);
              return `<li><strong>${item.cantidad}x ${producto?.descripcion_envase}</strong> - S/ ${((producto?.precio_envase || 0) * item.cantidad).toFixed(2)}</li>`;
            })
            .join('')}
        </ul>
        <p>¿Deseas registrar estos envases como depósito del cliente?</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar envases',
      cancelButtonText: 'No, omitir',
      confirmButtonColor: '#16a34a',
    });

    if (!isConfirmed) return;

    for (const item of productosConEnvase) {
      const producto = this.productos.find((p) => p.nombre === item.producto);
      if (!producto || !producto.es_retornable) continue;

      await this.envasesService.registrarEnvase(
        clienteId,
        nombreCliente,
        'botella',
        producto.descripcion_envase || producto.nombre,
        item.cantidad,
        producto.precio_envase || 0,
      );
    }

    Swal.fire({
      icon: 'success',
      title: 'Envases registrados',
      text: `Se registraron ${productosConEnvase.reduce((sum, item) => sum + item.cantidad, 0)} envases`,
      timer: 2500,
      showConfirmButton: false,
    });
  }

  /**
   * ✅ NUEVO: Procesar pago único (método anterior)
   */
  async procesarPagoUnico(): Promise<void> {
    const total = this.carritoService.total();
    let selectedMethod = '';

    const { value: metodoPago } = await Swal.fire({
      title: 'Método de Pago',
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
        options.forEach((option) => {
          option.addEventListener('click', () => {
            options.forEach((opt) => opt.classList.remove('selected'));
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
      },
    });

    if (!metodoPago) return;

    let receptor: string | undefined;

    if (metodoPago === 'yape' || metodoPago === 'plin') {
      receptor = await this.seleccionarReceptor();
      if (!receptor) return;
    }

    const confirmacion = await Swal.fire({
      title: '¿Confirmar venta?',
      html: `
      <div style="text-align: left; padding: 1rem;">
        <p><strong>Total:</strong> S/ ${total.toFixed(2)}</p>
        <p><strong>Método:</strong> ${metodoPago.toUpperCase()}</p>
        ${receptor ? `<p><strong>Receptor:</strong> ${receptor}</p>` : ''}
        <hr style="margin: 1rem 0;">
        <p><strong>Items:</strong></p>
        <ul style="margin: 0; padding-left: 1.5rem;">
          ${this.carritoService
            .items()
            .map(
              (item) =>
                `<li>${item.cantidad}x ${item.producto} - S/ ${item.subtotal.toFixed(2)}</li>`,
            )
            .join('')}
        </ul>
      </div>
    `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await this.ventasService.registrarVenta(
        this.carritoService.items(),
        metodoPago as any,
        receptor,
      );

      this.carritoService.vaciarCarrito();
      this.carritoVisible.set(false);
    } catch (error) {
      console.error('Error en venta:', error);
    }
  }

  /**
   * ✅ NUEVO: Procesar pago mixto (múltiples métodos)
   */
  async procesarPagoMixto(): Promise<void> {
    const total = this.carritoService.total();
    const pagos: any[] = [];
    let totalPagado = 0;

    // Preparamos las opciones de clientes para el select
    const opcionesClientes = this.clientes
      .map(
        (c) =>
          `<div class="cliente-option" data-id="${c.id}" data-nombre="${c.nombre}">${c.nombre}</div>`,
      )
      .join('');

    while (totalPagado < total) {
      const pendiente = total - totalPagado;

      const { value: formData } = await Swal.fire({
        title: 'Agregar Pago',
        html: `
        <style>
          .pago-mixto-container { text-align: left; }
          .resumen-pagos { background: #f3f4f6; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
          .resumen-pagos h4 { margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #6b7280; }
          .resumen-pagos .total-info { display: flex; justify-content: space-between; margin: 0.25rem 0; font-size: 1rem; }
          .resumen-pagos .total-info.pendiente { font-weight: 700; color: #dc2626; font-size: 1.2rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 2px solid #e5e7eb; }
          .form-group { margin-bottom: 1rem; }
          .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151; }
          .form-group input, .form-group select { width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; box-sizing: border-box; }
          .pagos-list { margin-top: 0.5rem; }
          .pago-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb; }
          
          /* 👇 NUEVOS ESTILOS PARA LOS LOGOS 👇 */
          .metodos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
          .metodo-option { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 0.5rem; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: white; font-size: 0.9rem; font-weight: 600; color: #374151; }
          .metodo-option:hover { border-color: #94a3b8; background: #f8fafc; }
          .metodo-option.selected { border-color: #3b82f6; background: #eff6ff; color: #1e3a8a; }
          .metodo-option img { width: 20px; height: 20px; object-fit: contain; }
          .cliente-option { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s; font-size: 0.95rem; }
          .cliente-option:hover { background: #f9fafb; }
          .cliente-option.selected { background: #eef2ff; color: #3b82f6; font-weight: bold; border-left: 3px solid #3b82f6; }
        </style>
        
        <div class="pago-mixto-container">
          <div class="resumen-pagos">
            <h4>Resumen de Pagos:</h4>
            <div class="total-info">
              <span>Total de la venta:</span>
              <strong>S/ ${total.toFixed(2)}</strong>
            </div>
            <div class="total-info">
              <span>Ya pagado/fiado:</span>
              <strong>S/ ${totalPagado.toFixed(2)}</strong>
            </div>
            <div class="total-info pendiente">
              <span>Pendiente:</span>
              <strong>S/ ${pendiente.toFixed(2)}</strong>
            </div>
            
            ${
              pagos.length > 0
                ? `
              <div class="pagos-list">
                ${pagos
                  .map(
                    (p) => `
                  <div class="pago-item">
                    <span>${p.metodo.toUpperCase()}${p.receptor ? ` (${p.receptor})` : ''}${p.nombreCliente ? ` (${p.nombreCliente})` : ''}</span>
                    <strong>S/ ${p.monto.toFixed(2)}</strong>
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>
          
          <div class="form-group">
            <label for="monto-pago">Monto:</label>
            <input id="monto-pago" type="number" step="0.01" min="0.01" max="${pendiente}" value="${pendiente.toFixed(2)}"/>
          </div>
          
          <div class="form-group">
            <label>Método de pago:</label>
            <div class="metodos-grid">
              <div class="metodo-option" data-value="efectivo">
                <img src="https://cdn-icons-png.flaticon.com/512/438/438526.png" alt="Efectivo"> Efectivo
              </div>
              <div class="metodo-option" data-value="yape">
                <img src="https://vectorseek.com/wp-content/uploads/2023/09/Yape-App-Logo-Vector.svg-.png" alt="Yape"> Yape
              </div>
              <div class="metodo-option" data-value="plin">
                <img src="https://images.seeklogo.com/logo-png/38/2/plin-logo-png_seeklogo-386806.png" alt="Plin"> Plin
              </div>
              <div class="metodo-option" data-value="fiado">
                <span>📔</span> Fiado
              </div>
            </div>
            <input type="hidden" id="metodo-pago" value="">
          </div>
          
          <div class="form-group" id="receptor-group" style="display: none;">
            <label for="receptor-pago">Receptor (Caja):</label>
            <select id="receptor-pago">
              <option value="">Seleccione...</option>
              ${this.receptores.map((r) => `<option value="${r.nombre}">${r.nombre}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" id="cliente-group" style="display: none;">
            <label>¿A quién se le fía?:</label>
            <input type="text" id="buscador-cliente-mixto" placeholder="🔍 Buscar cliente..." 
                   style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.5rem; outline: none;">
            <div id="lista-clientes-mixto" style="max-height: 150px; overflow-y: auto; border: 2px solid #e5e7eb; border-radius: 8px; background: white;">
              ${opcionesClientes}
            </div>
            <input type="hidden" id="cliente-fiado-id" value="">
            <input type="hidden" id="cliente-fiado-nombre" value="">
          </div>
        </div>
      `,
        showCancelButton: true,
        confirmButtonText: pagos.length > 0 ? 'Agregar' : 'Continuar',
        cancelButtonText: pagos.length > 0 ? 'Finalizar' : 'Cancelar',
        confirmButtonColor: '#48bb78',
        didOpen: () => {
          const metodoOptions = document.querySelectorAll('.metodo-option');
          const metodoInput = document.getElementById('metodo-pago') as HTMLInputElement;
          const receptorGroup = document.getElementById('receptor-group') as HTMLDivElement;
          const clienteGroup = document.getElementById('cliente-group') as HTMLDivElement;

          // Novedades para buscar y seleccionar clientes
          const clienteOptions = document.querySelectorAll('.cliente-option');
          const inputClienteId = document.getElementById('cliente-fiado-id') as HTMLInputElement;
          const inputClienteNombre = document.getElementById(
            'cliente-fiado-nombre',
          ) as HTMLInputElement;
          const buscadorCliente = document.getElementById(
            'buscador-cliente-mixto',
          ) as HTMLInputElement;

          metodoOptions.forEach((option) => {
            option.addEventListener('click', () => {
              metodoOptions.forEach((opt) => opt.classList.remove('selected'));
              option.classList.add('selected');

              const metodo = option.getAttribute('data-value') || '';
              metodoInput.value = metodo;

              receptorGroup.style.display =
                metodo === 'yape' || metodo === 'plin' ? 'block' : 'none';
              clienteGroup.style.display = metodo === 'fiado' ? 'block' : 'none';
            });
          });

          // 👇 NUEVO: Seleccionar cliente en pago mixto
          clienteOptions.forEach((opt) => {
            opt.addEventListener('click', () => {
              clienteOptions.forEach((o) => o.classList.remove('selected'));
              opt.classList.add('selected');
              inputClienteId.value = opt.getAttribute('data-id') || '';
              inputClienteNombre.value = opt.getAttribute('data-nombre') || '';
            });
          });

          // 👇 NUEVO: Buscador de cliente en pago mixto
          if (buscadorCliente) {
            buscadorCliente.addEventListener('input', (e) => {
              const termino = (e.target as HTMLInputElement).value.toLowerCase();
              clienteOptions.forEach((opt) => {
                const texto = opt.textContent?.toLowerCase() || '';
                if (texto.includes(termino)) {
                  (opt as HTMLElement).style.display = 'block';
                } else {
                  (opt as HTMLElement).style.display = 'none';
                }
              });
            });
          }
        },
        preConfirm: () => {
          const monto = parseFloat(
            (document.getElementById('monto-pago') as HTMLInputElement).value,
          );
          const metodo = (document.getElementById('metodo-pago') as HTMLInputElement).value;
          const receptor = (document.getElementById('receptor-pago') as HTMLSelectElement).value;

          // 👇 Cambiamos cómo se lee el cliente
          const clienteIdVal = (document.getElementById('cliente-fiado-id') as HTMLInputElement)
            .value;
          const clienteNombreVal = (
            document.getElementById('cliente-fiado-nombre') as HTMLInputElement
          ).value;

          if (!monto || monto <= 0 || monto > pendiente)
            return Swal.showValidationMessage('Monto inválido');
          if (!metodo) return Swal.showValidationMessage('Seleccione un método de pago');
          if ((metodo === 'yape' || metodo === 'plin') && !receptor)
            return Swal.showValidationMessage('Seleccione un receptor');

          // Validar que eligió cliente si fió
          if (metodo === 'fiado' && !clienteIdVal)
            return Swal.showValidationMessage('Seleccione un cliente para fiar');

          return {
            monto,
            metodo,
            receptor: receptor || null,
            clienteId: metodo === 'fiado' ? clienteIdVal : null,
            nombreCliente: metodo === 'fiado' ? clienteNombreVal : null,
          };
        },
      });

      if (!formData) {
        if (pagos.length === 0) return;
        if (totalPagado < total) {
          const confirmar = await Swal.fire({
            icon: 'warning',
            title: 'Falta dinero',
            html: `<p>Falta cobrar <strong>S/ ${(total - totalPagado).toFixed(2)}</strong>. ¿Continuar de todos modos?</p>`,
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar así',
          });
          if (!confirmar.isConfirmed) continue;
        }
        break;
      }

      pagos.push(formData);
      totalPagado += formData.monto;
    }

    if (pagos.length === 0) return;

    try {
      await this.ventasService.registrarVentaMixta(this.carritoService.items(), pagos);
      this.carritoService.vaciarCarrito();
      this.carritoVisible.set(false);
    } catch (error) {
      console.error('Error en venta mixta:', error);
    }
  }

  /**
   * ✅ NUEVO: Procesar fiado
   */
  async procesarFiado(): Promise<void> {
    if (this.clientes.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No hay clientes',
        text: 'Debes crear un cliente antes de fiar',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    let selectedCliente = '';

    const opcionesHTML = this.clientes
      .map((c) => `<div class="receptor-option" data-value="${c.id}">${c.nombre}</div>`)
      .join('');

    const { value: clienteSeleccionado } = await Swal.fire({
      title: 'Seleccionar Cliente',
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
      
      <input type="text" id="buscador-cliente-fiar" placeholder="🔍 Buscar cliente por nombre..." 
             style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.5rem; font-size: 1rem; outline: none;">
             
      <div id="cliente-options" style="max-height: 250px; overflow-y: auto; padding-right: 0.5rem;">
        ${opcionesHTML}
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
      didOpen: () => {
        const options = document.querySelectorAll('.receptor-option');
        const buscador = document.getElementById('buscador-cliente-fiar') as HTMLInputElement;

        // Lógica para seleccionar
        options.forEach((option) => {
          option.addEventListener('click', () => {
            options.forEach((opt) => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedCliente = option.getAttribute('data-value') || '';
          });
        });

        // 👇 NUEVO: Lógica para filtrar en tiempo real 👇
        buscador.addEventListener('input', (e) => {
          const termino = (e.target as HTMLInputElement).value.toLowerCase();
          options.forEach((opt) => {
            const texto = opt.textContent?.toLowerCase() || '';
            if (texto.includes(termino)) {
              (opt as HTMLElement).style.display = 'flex';
            } else {
              (opt as HTMLElement).style.display = 'none';
            }
          });
        });
      },
      preConfirm: () => {
        if (!selectedCliente) {
          Swal.showValidationMessage('Debes seleccionar un cliente');
          return false;
        }
        return selectedCliente;
      },
    });

    if (!clienteSeleccionado) return;

    const clienteId = clienteSeleccionado;
    const nombreCliente = this.clientes.find((c) => c.id === clienteSeleccionado)?.nombre;
    const total = this.carritoService.total();

    const confirmacion = await Swal.fire({
      title: '¿Confirmar fiado?',
      html: `
      <div style="text-align: left; padding: 1rem;">
        <p><strong>Cliente:</strong> ${nombreCliente}</p>
        <p><strong>Total a fiar:</strong> S/ ${total.toFixed(2)}</p>
        <hr style="margin: 1rem 0;">
        <p><strong>Items:</strong></p>
        <ul style="margin: 0; padding-left: 1.5rem;">
          ${this.carritoService
            .items()
            .map(
              (item) =>
                `<li>${item.cantidad}x ${item.producto} - S/ ${item.subtotal.toFixed(2)}</li>`,
            )
            .join('')}
        </ul>
      </div>
    `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await this.ventasService.registrarVenta(
        this.carritoService.items(),
        'fiado',
        undefined,
        clienteId,
        nombreCliente,
      );

      await this.verificarEnvasesRetornables(clienteId, nombreCliente!);

      this.carritoService.vaciarCarrito();
      this.carritoVisible.set(false);
    } catch (error) {
      console.error('Error en fiado:', error);
    }
  }

  /**
   * Helper: Seleccionar receptor
   */
  async seleccionarReceptor(): Promise<string | undefined> {
    let selectedReceptor = '';

    const opcionesReceptores = this.receptores
      .map((r) => `<div class="receptor-option" data-value="${r.nombre}">${r.nombre}</div>`)
      .join('');

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
        options.forEach((option) => {
          option.addEventListener('click', () => {
            options.forEach((opt) => opt.classList.remove('selected'));
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
      },
    });

    return receptorInput;
  }
}
