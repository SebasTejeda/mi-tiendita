import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { Receptor, Categoria, Medida } from '../../core/interfaces/models';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.scss',
})
export class ConfiguracionComponent implements OnInit, OnDestroy {
  configuracionService = inject(ConfiguracionService);

  receptores: Receptor[] = [];
  categorias: Categoria[] = [];
  medidas: Medida[] = [];

  tabActiva = signal<'receptores' | 'categorias' | 'medidas'>('receptores');
  isLoading = true;

  private receptoresSubscription?: Subscription;
  private categoriasSubscription?: Subscription;
  private medidasSubscription?: Subscription;

  mostrarBotonInicializar = signal(true);

  ngOnInit(): void {
    this.cargarDatos();
    this.verificarSiNecesitaInicializacion();
  }

  async verificarSiNecesitaInicializacion(): Promise<void> {
    // Verificar si ya hay categorías (si hay categorías, asumimos que ya se inicializó)
    this.configuracionService.obtenerCategorias().subscribe((categorias) => {
      if (categorias.length > 0) {
        this.mostrarBotonInicializar.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.receptoresSubscription?.unsubscribe();
    this.categoriasSubscription?.unsubscribe();
    this.medidasSubscription?.unsubscribe();
  }

  cargarDatos(): void {
    this.isLoading = true;

    this.receptoresSubscription = this.configuracionService
      .obtenerReceptores()
      .subscribe((receptores) => {
        this.receptores = receptores;
        this.isLoading = false;
      });

    this.categoriasSubscription = this.configuracionService
      .obtenerCategorias()
      .subscribe((categorias) => {
        this.categorias = categorias;
      });

    this.medidasSubscription = this.configuracionService.obtenerMedidas().subscribe((medidas) => {
      this.medidas = medidas;
    });
  }

  cambiarTab(tab: 'receptores' | 'categorias' | 'medidas'): void {
    this.tabActiva.set(tab);
  }

  // ========== RECEPTORES ==========
  async agregarReceptor(): Promise<void> {
    const { value: nombre } = await Swal.fire({
      title: 'Nuevo Receptor',
      input: 'text',
      inputLabel: 'Nombre del receptor',
      inputPlaceholder: 'Ej: Sebastián',
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return 'Debes ingresar un nombre';
        }
        return null;
      },
    });

    if (!nombre) return;

    await this.configuracionService.agregarReceptor(nombre.trim());
  }

  async editarReceptor(receptor: Receptor): Promise<void> {
    const { value: nombre } = await Swal.fire({
      title: 'Editar Receptor',
      input: 'text',
      inputValue: receptor.nombre,
      inputLabel: 'Nombre del receptor',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return 'Debes ingresar un nombre';
        }
        return null;
      },
    });

    if (!nombre || nombre === receptor.nombre) return;

    await this.configuracionService.actualizarReceptor(receptor.id, { nombre: nombre.trim() });
  }

  async toggleReceptor(receptor: Receptor): Promise<void> {
    await this.configuracionService.actualizarReceptor(receptor.id, {
      activo: !receptor.activo,
    });
  }

  async eliminarReceptor(receptor: Receptor): Promise<void> {
    const confirmacion = await Swal.fire({
      title: '¿Eliminar receptor?',
      text: `Se eliminará "${receptor.nombre}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f56565',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmacion.isConfirmed) return;

    await this.configuracionService.eliminarReceptor(receptor.id);
  }

  // ========== CATEGORÍAS ==========
  async agregarCategoria(): Promise<void> {
    const { value: formData } = await Swal.fire({
      title: 'Nueva Categoría',
      html: `
        <style>
          .form-config {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            text-align: left;
          }
          .form-config label {
            font-weight: 600;
            margin-bottom: 0.25rem;
            display: block;
          }
          .form-config input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 1rem;
            box-sizing: border-box;
          }
          .form-config input:focus {
            outline: none;
            border-color: #667eea;
          }
        </style>
        <div class="form-config">
          <div>
            <label>Nombre de la categoría:</label>
            <input id="nombre-categoria" type="text" placeholder="Ej: Abarrotes">
          </div>
          <div>
            <label>Icono (opcional):</label>
            <input id="icono-categoria" type="text" placeholder="Ej: 🛒" maxlength="2">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      focusConfirm: false,
      preConfirm: () => {
        const nombre = (
          document.getElementById('nombre-categoria') as HTMLInputElement
        ).value.trim();
        const icono = (document.getElementById('icono-categoria') as HTMLInputElement).value.trim();

        if (!nombre) {
          Swal.showValidationMessage('Debes ingresar un nombre');
          return false;
        }

        return { nombre, icono: icono || undefined };
      },
    });

    if (!formData) return;

    await this.configuracionService.agregarCategoria(formData.nombre, formData.icono);
  }

  async toggleCategoria(categoria: Categoria): Promise<void> {
    const categoriaRef = this.configuracionService['categoriasCollection'];
    await this.configuracionService.actualizarCategoria(categoria.id, {
      activo: !categoria.activo,
    });
  }

  async eliminarCategoria(categoria: Categoria): Promise<void> {
    await this.configuracionService.eliminarCategoria(categoria.id);
  }

  // ========== MEDIDAS ==========
  async agregarMedida(): Promise<void> {
    const { value: formData } = await Swal.fire({
      title: 'Nueva Medida',
      html: `
        <style>
          .form-config {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            text-align: left;
          }
          .form-config label {
            font-weight: 600;
            margin-bottom: 0.25rem;
            display: block;
          }
          .form-config input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 1rem;
            box-sizing: border-box;
          }
          .form-config input:focus {
            outline: none;
            border-color: #667eea;
          }
        </style>
        <div class="form-config">
          <div>
            <label>Nombre de la medida:</label>
            <input id="nombre-medida" type="text" placeholder="Ej: Paquete">
          </div>
          <div>
            <label>Abreviatura:</label>
            <input id="abrev-medida" type="text" placeholder="Ej: Paq" maxlength="5">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      focusConfirm: false,
      preConfirm: () => {
        const nombre = (document.getElementById('nombre-medida') as HTMLInputElement).value.trim();
        const abreviatura = (
          document.getElementById('abrev-medida') as HTMLInputElement
        ).value.trim();

        if (!nombre) {
          Swal.showValidationMessage('Debes ingresar un nombre');
          return false;
        }

        if (!abreviatura) {
          Swal.showValidationMessage('Debes ingresar una abreviatura');
          return false;
        }

        return { nombre, abreviatura };
      },
    });

    if (!formData) return;

    await this.configuracionService.agregarMedida(formData.nombre, formData.abreviatura);
  }

  async toggleMedida(medida: Medida): Promise<void> {
    const medidaRef = this.configuracionService['medidasCollection'];
    await this.configuracionService.actualizarMedida(medida.id, {
      activo: !medida.activo,
    });
  }

  async eliminarMedida(medida: Medida): Promise<void> {
    await this.configuracionService.eliminarMedida(medida.id);
  }

  async inicializarDatos(): Promise<void> {
    const confirmacion = await Swal.fire({
      title: '¿Inicializar datos predeterminados?',
      html: `
      <p>Se crearán los siguientes datos:</p>
      <ul style="text-align: left; padding-left: 2rem;">
        <li>4 Receptores (Sebastián, Vanesa, Papá, Mamá)</li>
        <li>8 Categorías (Abarrotes, Gaseosas, Cervezas, etc.)</li>
        <li>6 Medidas (Unidad, Kilo, Litro, etc.)</li>
      </ul>
      <p style="color: #f59e0b; margin-top: 1rem;">
        ⚠️ Solo ejecuta esto UNA VEZ cuando inicies el sistema
      </p>
    `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, inicializar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
    });

    if (!confirmacion.isConfirmed) return;

    await this.configuracionService.inicializarDatosPredeterminados();
  }
}
