import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductosService } from '../../core/services/productos.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { Producto, Categoria, Medida } from '../../core/interfaces/models';
import Swal from 'sweetalert2';
import { Timestamp } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss'
})
export class InventarioComponent implements OnInit, OnDestroy {
  fb = inject(FormBuilder);
  productosService = inject(ProductosService);
  configuracionService = inject(ConfiguracionService);

  productos: Producto[] = [];
  categorias: Categoria[] = [];
  medidas: Medida[] = [];
  
  // ✅ AGREGAR ESTAS PROPIEDADES
  isLoading = true;
  
  modalAbierto = signal(false);
  modoEdicion = false;
  productoEditando: Producto | null = null;
  ordenColumna: keyof Producto | null = null;
  ordenDireccion: 'asc' | 'desc' = 'asc';

  private categoriasSubscription?: Subscription;
  private medidasSubscription?: Subscription;

  productoForm = this.fb.group({
    nombre: ['', Validators.required],
    categoria: ['', Validators.required],
    precio_compra: [null as number | null, [Validators.min(0)]],
    precio: [0, [Validators.required, Validators.min(0.01)]],
    medida: ['', Validators.required],
    valor_medida: [1, [Validators.required, Validators.min(0.01)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    stock_minimo: [5, [Validators.required, Validators.min(0)]],
    imagen_url: [''],
    es_retornable: [false],
    precio_envase: [0],
    descripcion_envase: ['']
  });

  ngOnInit(): void {
    this.cargarProductos();
    this.cargarConfiguracion();
  }

  ngOnDestroy(): void {
    this.categoriasSubscription?.unsubscribe();
    this.medidasSubscription?.unsubscribe();
  }

  cargarConfiguracion(): void {
    this.categoriasSubscription = this.configuracionService.obtenerCategoriasActivas().subscribe(categorias => {
      this.categorias = categorias;
    });

    this.medidasSubscription = this.configuracionService.obtenerMedidasActivas().subscribe(medidas => {
      this.medidas = medidas;
    });
  }

  cargarProductos(): void {
    this.isLoading = true;
    this.productosService.obtenerProductos().subscribe(productos => {
      this.productos = productos;
      this.isLoading = false; // ✅
    });
  }

  get productosOrdenados(): Producto[] {
    if (!this.ordenColumna) return this.productos;

    return [...this.productos].sort((a, b) => {
      const valorA = a[this.ordenColumna!];
      const valorB = b[this.ordenColumna!];

      let comparacion = 0;
      if (valorA! < valorB!) comparacion = -1;
      if (valorA! > valorB!) comparacion = 1;

      return this.ordenDireccion === 'asc' ? comparacion : -comparacion;
    });
  }

  get productosFaltantes(): Producto[] {
    return this.productos.filter(p => p.es_faltante);
  }

  ordenarPor(columna: keyof Producto): void {
    if (this.ordenColumna === columna) {
      this.ordenDireccion = this.ordenDireccion === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenColumna = columna;
      this.ordenDireccion = 'asc';
    }
  }

  // ✅ AGREGAR ESTE MÉTODO
  getStockBadge(producto: Producto): string {
    if (producto.stock === 0) return 'badge-danger';
    if (producto.es_faltante) return 'badge-warning';
    return 'badge-success';
  }

  abrirModalNuevo(): void {
    this.modoEdicion = false;
    this.productoEditando = null;
    this.productoForm.reset({
      nombre: '',
      categoria: '',
      precio_compra: null,
      precio: 0,
      medida: '',
      valor_medida: 1,
      stock: 0,
      stock_minimo: 5,
      imagen_url: '',
      es_retornable: false,
      precio_envase: 0,
      descripcion_envase: ''
    });
    this.modalAbierto.set(true);
  }

  abrirModalEditar(producto: Producto): void {
    this.modoEdicion = true;
    this.productoEditando = producto;
    this.productoForm.patchValue({
      nombre: producto.nombre,
      categoria: producto.categoria,
      precio_compra: producto.precio_compra || null,
      precio: producto.precio,
      medida: producto.medida,
      valor_medida: producto.valor_medida,
      stock: producto.stock,
      stock_minimo: producto.stock_minimo,
      imagen_url: producto.imagen_url || '',
      es_retornable: producto.es_retornable || false,
      precio_envase: producto.precio_envase || 0,
      descripcion_envase: producto.descripcion_envase || ''
    });
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.productoForm.reset();
    this.modoEdicion = false;
    this.productoEditando = null;
  }

async guardarProducto(): Promise<void> {
  if (this.productoForm.invalid) {
    this.productoForm.markAllAsTouched();
    return;
  }

  const formValue = this.productoForm.value;

  const datos = {
    nombre: formValue.nombre ?? '',
    categoria: formValue.categoria ?? '',
    precio: Number(formValue.precio ?? 0),
    medida: formValue.medida ?? '',
    valor_medida: Number(formValue.valor_medida ?? 1),
    stock: Number(formValue.stock ?? 0),
    stock_minimo: Number(formValue.stock_minimo ?? 5),
    es_faltante: false,
    fecha_creacion: Timestamp.now(),
    ...(formValue.precio_compra !== null && formValue.precio_compra! > 0 
      ? { precio_compra: Number(formValue.precio_compra) } 
      : {}),
    // ✅ Cambiar de undefined a que no exista el campo si está vacío
    ...(formValue.imagen_url && formValue.imagen_url.trim() !== '' 
      ? { imagen_url: formValue.imagen_url.trim() } 
      : {}),
    es_retornable: Boolean(formValue.es_retornable),
    // ✅ Solo agregar si es retornable y tiene valor
    ...(formValue.es_retornable && formValue.precio_envase 
      ? { precio_envase: Number(formValue.precio_envase) } 
      : {}),
    ...(formValue.es_retornable && formValue.descripcion_envase 
      ? { descripcion_envase: formValue.descripcion_envase.trim() } 
      : {})
  };

  try {
    if (this.modoEdicion && this.productoEditando) {
      const { fecha_creacion, ...datosActualizar } = datos;
      await this.productosService.actualizarProducto(this.productoEditando.id, datosActualizar);
    } else {
      await this.productosService.crearProducto(datos);
    }
    this.cerrarModal();
  } catch (error) {
    console.error('Error al guardar:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error al guardar',
      text: 'No se pudo guardar el producto. Intenta de nuevo.'
    });
  }
}

  async eliminarProducto(producto: Producto): Promise<void> {
    const confirmacion = await Swal.fire({
      title: '¿Eliminar producto?',
      text: `Se eliminará "${producto.nombre}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f56565',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    await this.productosService.eliminarProducto(producto.id);
  }

  onEnvaseChange(): void {
    const esRetornable = this.productoForm.get('es_retornable')?.value;
    
    if (!esRetornable) {
      this.productoForm.patchValue({
        precio_envase: 0,
        descripcion_envase: ''
      });
    }
  }

  onImageError(event: any): void {
    event.target.src = 'https://via.placeholder.com/300x300/e5e7eb/6b7280?text=Imagen+no+disponible';
  }

  // 👇 NUEVA FUNCIÓN MATEMÁTICA
  calcularGanancia(): string | null {
    const costo = this.productoForm.get('precio_compra')?.value;
    const venta = this.productoForm.get('precio')?.value;

    if (!costo || !venta || costo <= 0 || venta <= 0) return null;

    const ganancia = venta - costo;
    
    if (ganancia <= 0) {
      return `<span style="color: #ef4444; font-weight: bold;">Atención: Sin ganancia o pérdida (S/ ${ganancia.toFixed(2)})</span>`;
    }

    // Calculamos el margen de ganancia sobre el precio de venta (estándar en retail)
    const margen = (ganancia / venta) * 100; 

    return `Ganancia neta: <strong>S/ ${ganancia.toFixed(2)}</strong> (<span style="color: #10b981; font-weight: bold;">+${margen.toFixed(1)}%</span> de margen)`;
  }
}