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
  styleUrl: './ventas.component.scss'
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
    this.productosService.obtenerProductos().subscribe(productos => {
      this.productos = productos.filter(p => p.stock > 0);
      this.productosFiltrados = this.productos;
      this.isLoading = false;
    });
  }

  cargarClientes(): void {
    this.clientesService.obtenerClientes().subscribe(clientes => {
      this.clientes = clientes;
    });
  }

  // ✅ Nuevo método
  cargarReceptores(): void {
    this.receptoresSubscription = this.configuracionService.obtenerReceptoresActivos().subscribe(receptores => {
      this.receptores = receptores;
    });
  }

  get categorias(): string[] {
    const cats = [...new Set(this.productos.map(p => p.categoria))];
    return cats.filter(c => c && c.trim() !== '');
  }

  filtrarProductos(): void {
    this.productosFiltrados = this.productos.filter(p => {
      const matchBusqueda = p.nombre.toLowerCase().includes(this.busqueda.toLowerCase());
      const matchCategoria = !this.categoriaSeleccionada || p.categoria === this.categoriaSeleccionada;
      return matchBusqueda && matchCategoria;
    });
  }

  seleccionarCategoria(categoria: string): void {
    this.categoriaSeleccionada = categoria;
    this.filtrarProductos();
  }

  agregarAlCarrito(producto: Producto): void {
    this.carritoService.agregarProducto(
      producto.id, 
      producto.nombre, 
      producto.precio, 
      1
    );
  }

  toggleCarrito(): void {
    this.carritoVisible.update(v => !v);
  }

  async procesarVenta(): Promise<void> {
    if (this.carritoService.estaVacio()) {
      Swal.fire({
        icon: 'warning',
        title: 'Carrito vacío',
        text: 'Agrega productos antes de procesar la venta'
      });
      return;
    }

    // Paso 1: Seleccionar método de pago con iconos
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
          .payment-option .emoji-icon {
            font-size: 2rem;
            margin-right: 0.5rem;
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
          <div class="payment-option" data-value="fiado">
            <span class="emoji-icon">📔</span>
            <span>Fiado</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
      cancelButtonColor: '#a0aec0',
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
    let clienteId: string | undefined;
    let nombreCliente: string | undefined;

    // Paso 2: Si es Yape o Plin, preguntar receptor (DINÁMICO)
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

    // Paso 3: Si es fiado, seleccionar cliente
    if (metodoPago === 'fiado') {
      if (this.clientes.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'No hay clientes',
          text: 'Debes crear un cliente antes de fiar',
          confirmButtonText: 'Entendido'
        });
        return;
      }

      let selectedCliente = '';

      const opcionesHTML = this.clientes.map(c => 
        `<div class="receptor-option" data-value="${c.id}">${c.nombre}</div>`
      ).join('');

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
          
          <div id="cliente-options">
            ${opcionesHTML}
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

      if (!clienteSeleccionado) return;

      clienteId = clienteSeleccionado;
      nombreCliente = this.clientes.find(c => c.id === clienteSeleccionado)?.nombre;
    }

    // Paso 4: Confirmar venta
    const total = this.carritoService.total();
    const confirmacion = await Swal.fire({
      title: '¿Confirmar venta?',
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p><strong>Total:</strong> S/ ${total.toFixed(2)}</p>
          <p><strong>Método:</strong> ${metodoPago.toUpperCase()}</p>
          ${receptor ? `<p><strong>Receptor:</strong> ${receptor}</p>` : ''}
          ${nombreCliente ? `<p><strong>Cliente:</strong> ${nombreCliente}</p>` : ''}
          <hr style="margin: 1rem 0;">
          <p><strong>Items:</strong></p>
          <ul style="margin: 0; padding-left: 1.5rem;">
            ${this.carritoService.items().map(item => 
              `<li>${item.cantidad}x ${item.producto} - S/ ${item.subtotal.toFixed(2)}</li>`
            ).join('')}
          </ul>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78',
      cancelButtonColor: '#a0aec0'
    });

    if (!confirmacion.isConfirmed) return;

    // Paso 5: Procesar venta
    try {
      await this.ventasService.registrarVenta(
        this.carritoService.items(),
        metodoPago as any,
        receptor,
        clienteId,
        nombreCliente
      );

      // ✅ Verificar envases retornables si es fiado
      if (metodoPago === 'fiado' && clienteId && nombreCliente) {
        await this.verificarEnvasesRetornables(clienteId, nombreCliente);
      }

      this.carritoService.vaciarCarrito();
      this.carritoVisible.set(false);

    } catch (error) {
      console.error('Error en venta:', error);
    }
  }

  async verificarEnvasesRetornables(clienteId: string, nombreCliente: string): Promise<void> {
    const items = this.carritoService.items();
    const productosConEnvase = items.filter(item => {
      const producto = this.productos.find(p => p.nombre === item.producto);
      return producto?.es_retornable;
    });

    if (productosConEnvase.length === 0) return;

    const { isConfirmed } = await Swal.fire({
      title: '🍾 Envases Retornables',
      html: `
        <p>Esta venta incluye productos con envases retornables:</p>
        <ul style="text-align: left; padding-left: 2rem; margin: 1rem 0;">
          ${productosConEnvase.map(item => {
            const producto = this.productos.find(p => p.nombre === item.producto);
            return `<li><strong>${item.cantidad}x ${producto?.descripcion_envase}</strong> - S/ ${((producto?.precio_envase || 0) * item.cantidad).toFixed(2)}</li>`;
          }).join('')}
        </ul>
        <p>¿Deseas registrar estos envases como depósito del cliente?</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar envases',
      cancelButtonText: 'No, omitir',
      confirmButtonColor: '#16a34a'
    });

    if (!isConfirmed) return;

    for (const item of productosConEnvase) {
      const producto = this.productos.find(p => p.nombre === item.producto);
      if (!producto || !producto.es_retornable) continue;

      await this.envasesService.registrarEnvase(
        clienteId,
        nombreCliente,
        'botella',
        producto.descripcion_envase || producto.nombre,
        item.cantidad,
        producto.precio_envase || 0
      );
    }

    Swal.fire({
      icon: 'success',
      title: 'Envases registrados',
      text: `Se registraron ${productosConEnvase.reduce((sum, item) => sum + item.cantidad, 0)} envases`,
      timer: 2500,
      showConfirmButton: false
    });
  }
}