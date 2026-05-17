import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  getDocs
} from '@angular/fire/firestore';
import { Observable, shareReplay, firstValueFrom } from 'rxjs';
import { Receptor, Categoria, Medida } from '../interfaces/models';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  private firestore = inject(Firestore);
  
  private receptoresCollection = collection(this.firestore, 'receptores');
  private categoriasCollection = collection(this.firestore, 'categorias');
  private medidasCollection = collection(this.firestore, 'medidas');

  // ✅ Cache observables tipados correctamente
  private categoriasCache$?: Observable<Categoria[]>;
  private medidasCache$?: Observable<Medida[]>;
  private receptoresCache$?: Observable<Receptor[]>;

  // ========== RECEPTORES ==========
  obtenerReceptores(): Observable<Receptor[]> {
    if (!this.receptoresCache$) {
      const q = query(this.receptoresCollection, orderBy('nombre', 'asc'));
      this.receptoresCache$ = (collectionData(q, { idField: 'id' }) as Observable<Receptor[]>).pipe(
        shareReplay(1)
      );
    }
    return this.receptoresCache$;
  }

  obtenerReceptoresActivos(): Observable<Receptor[]> {
    const q = query(
      this.receptoresCollection,
      where('activo', '==', true),
      // orderBy('nombre', 'asc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Receptor[]>;
  }

  async agregarReceptor(nombre: string): Promise<void> {
    await addDoc(this.receptoresCollection, {
      nombre,
      activo: true,
      fecha_creacion: Timestamp.now()
    });
  }

  async actualizarReceptor(id: string, datos: Partial<Receptor>): Promise<void> {
    const receptorRef = doc(this.firestore, 'receptores', id);
    await updateDoc(receptorRef, datos as any);
  }

  async eliminarReceptor(id: string): Promise<void> {
    const receptorRef = doc(this.firestore, 'receptores', id);
    await deleteDoc(receptorRef);
  }

  // ========== CATEGORÍAS ==========
  obtenerCategorias(): Observable<Categoria[]> {
    if (!this.categoriasCache$) {
      const q = query(this.categoriasCollection, orderBy('nombre', 'asc'));
      this.categoriasCache$ = (collectionData(q, { idField: 'id' }) as Observable<Categoria[]>).pipe(
        shareReplay(1)
      );
    }
    return this.categoriasCache$;
  }

  obtenerCategoriasActivas(): Observable<Categoria[]> {
    const q = query(
      this.categoriasCollection,
      where('activo', '==', true),
      // orderBy('nombre', 'asc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Categoria[]>;
  }

  async agregarCategoria(nombre: string, icono?: string): Promise<void> {
    await addDoc(this.categoriasCollection, {
      nombre,
      icono: icono || undefined,
      activo: true,
      fecha_creacion: Timestamp.now()
    });

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Categoría agregada',
      showConfirmButton: false,
      timer: 2000
    });
  }

  async actualizarCategoria(id: string, datos: Partial<Categoria>): Promise<void> {
    const categoriaRef = doc(this.firestore, 'categorias', id);
    await updateDoc(categoriaRef, datos as any);
  }

  async eliminarCategoria(id: string): Promise<boolean> {
    const productosRef = collection(this.firestore, 'productos');
    const categoria = await this.obtenerCategoriaPorId(id);
    
    if (!categoria) return false;

    const q = query(productosRef, where('categoria', '==', categoria.nombre));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      Swal.fire({
        icon: 'error',
        title: 'No se puede eliminar',
        html: `
          <p>La categoría <strong>"${categoria.nombre}"</strong> tiene <strong>${snapshot.size}</strong> productos asociados.</p>
          <p>Primero debes reasignar o eliminar esos productos.</p>
        `
      });
      return false;
    }

    const confirmacion = await Swal.fire({
      title: '¿Eliminar categoría?',
      text: `Se eliminará "${categoria.nombre}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f56565',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return false;

    const categoriaRef = doc(this.firestore, 'categorias', id);
    await deleteDoc(categoriaRef);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Categoría eliminada',
      showConfirmButton: false,
      timer: 2000
    });

    return true;
  }

  private async obtenerCategoriaPorId(id: string): Promise<Categoria | null> {
    try {
      const categorias = await firstValueFrom(this.obtenerCategorias());
      return categorias.find(c => c.id === id) || null;
    } catch {
      return null;
    }
  }

  // ========== MEDIDAS ==========
  obtenerMedidas(): Observable<Medida[]> {
    if (!this.medidasCache$) {
      const q = query(this.medidasCollection, orderBy('nombre', 'asc'));
      this.medidasCache$ = (collectionData(q, { idField: 'id' }) as Observable<Medida[]>).pipe(
        shareReplay(1)
      );
    }
    return this.medidasCache$;
  }

  obtenerMedidasActivas(): Observable<Medida[]> {
    const q = query(
      this.medidasCollection,
      where('activo', '==', true),
      // orderBy('nombre', 'asc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Medida[]>;
  }

  async agregarMedida(nombre: string, abreviatura: string): Promise<void> {
    await addDoc(this.medidasCollection, {
      nombre,
      abreviatura,
      activo: true,
      fecha_creacion: Timestamp.now()
    });

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Medida agregada',
      showConfirmButton: false,
      timer: 2000
    });
  }

  async actualizarMedida(id: string, datos: Partial<Medida>): Promise<void> {
    const medidaRef = doc(this.firestore, 'medidas', id);
    await updateDoc(medidaRef, datos as any);
  }

  async eliminarMedida(id: string): Promise<boolean> {
    const productosRef = collection(this.firestore, 'productos');
    const medida = await this.obtenerMedidaPorId(id);
    
    if (!medida) return false;

    const q = query(productosRef, where('medida', '==', medida.nombre));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      Swal.fire({
        icon: 'error',
        title: 'No se puede eliminar',
        html: `
          <p>La medida <strong>"${medida.nombre}"</strong> tiene <strong>${snapshot.size}</strong> productos asociados.</p>
          <p>Primero debes reasignar o eliminar esos productos.</p>
        `
      });
      return false;
    }

    const confirmacion = await Swal.fire({
      title: '¿Eliminar medida?',
      text: `Se eliminará "${medida.nombre}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f56565',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return false;

    const medidaRef = doc(this.firestore, 'medidas', id);
    await deleteDoc(medidaRef);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Medida eliminada',
      showConfirmButton: false,
      timer: 2000
    });

    return true;
  }

  private async obtenerMedidaPorId(id: string): Promise<Medida | null> {
    try {
      const medidas = await firstValueFrom(this.obtenerMedidas());
      return medidas.find(m => m.id === id) || null;
    } catch {
      return null;
    }
  }

  // ========== INICIALIZACIÓN ==========
  async inicializarDatosPredeterminados(): Promise<void> {
    try {
      Swal.fire({
        title: 'Inicializando configuración...',
        text: 'Por favor espera',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const receptores = [
        { nombre: 'Sebastián', activo: true },
        { nombre: 'Vanesa', activo: true },
        { nombre: 'Papá', activo: true },
        { nombre: 'Mamá', activo: true }
      ];

      for (const receptor of receptores) {
        await addDoc(this.receptoresCollection, {
          ...receptor,
          fecha_creacion: Timestamp.now()
        });
      }

      const categorias = [
        { nombre: 'Abarrotes', icono: '🛒', activo: true },
        { nombre: 'Gaseosas', icono: '🥤', activo: true },
        { nombre: 'Cervezas', icono: '🍺', activo: true },
        { nombre: 'Golosinas', icono: '🍬', activo: true },
        { nombre: 'Aceites', icono: '🫒', activo: true },
        { nombre: 'Limpieza', icono: '🧹', activo: true },
        { nombre: 'Lácteos', icono: '🥛', activo: true },
        { nombre: 'Snacks', icono: '🍿', activo: true }
      ];

      for (const categoria of categorias) {
        await addDoc(this.categoriasCollection, {
          ...categoria,
          fecha_creacion: Timestamp.now()
        });
      }

      const medidas = [
        { nombre: 'Unidad', abreviatura: 'Und', activo: true },
        { nombre: 'Kilo', abreviatura: 'Kg', activo: true },
        { nombre: 'Litro', abreviatura: 'L', activo: true },
        { nombre: 'Caja', abreviatura: 'Cj', activo: true },
        { nombre: 'Paquete', abreviatura: 'Paq', activo: true },
        { nombre: 'Bolsa', abreviatura: 'Bls', activo: true }
      ];

      for (const medida of medidas) {
        await addDoc(this.medidasCollection, {
          ...medida,
          fecha_creacion: Timestamp.now()
        });
      }

      Swal.close();

      Swal.fire({
        icon: 'success',
        title: '¡Configuración completada!',
        html: `
          <p>Se crearon:</p>
          <ul style="text-align: left;">
            <li>✅ ${receptores.length} receptores</li>
            <li>✅ ${categorias.length} categorías</li>
            <li>✅ ${medidas.length} medidas</li>
          </ul>
        `,
        confirmButtonText: 'Entendido'
      });

    } catch (error) {
      Swal.close();
      console.error('Error al inicializar:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al inicializar la configuración'
      });
    }
  }
}