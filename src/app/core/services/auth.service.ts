// src/app/core/services/auth.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from '@angular/fire/auth';
import Swal from 'sweetalert2';
import { Usuario } from '../interfaces/models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  // Signal reactivo para el estado de autenticación
  currentUser = signal<Usuario | null>(null);
  isLoading = signal<boolean>(true);

  constructor() {
    this.initAuthListener();
  }

  /**
   * Listener del estado de autenticación de Firebase
   * Se ejecuta automáticamente cuando cambia el estado del usuario
   */
  private initAuthListener(): void {
    onAuthStateChanged(this.auth, (user: User | null) => {
      if (user) {
        this.currentUser.set({
          uid: user.uid,
          email: user.email!,
          displayName: user.displayName || undefined
        });
      } else {
        this.currentUser.set(null);
      }
      this.isLoading.set(false);
    });
  }

  /**
   * Login con email y password
   */
  async login(email: string, password: string): Promise<boolean> {
    try {
      Swal.fire({
        title: 'Iniciando sesión...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await signInWithEmailAndPassword(this.auth, email, password);
      
      Swal.close();
      
      Swal.fire({
        icon: 'success',
        title: '¡Bienvenido!',
        text: 'Sesión iniciada correctamente',
        timer: 1500,
        showConfirmButton: false
      });

      this.router.navigate(['/dashboard']);
      return true;

    } catch (error: any) {
      Swal.close();
      
      let errorMessage = 'Error al iniciar sesión';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuario no encontrado';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Contraseña incorrecta';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Usuario deshabilitado';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Intenta más tarde';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Credenciales inválidas';
          break;
      }

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMessage
      });

      return false;
    }
  }

  /**
   * Cerrar sesión
   */
  async logout(): Promise<void> {
    try {
      Swal.fire({
        title: 'Cerrando sesión...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await signOut(this.auth);
      
      Swal.close();
      this.router.navigate(['/login']);

    } catch (error) {
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cerrar sesión'
      });
    }
  }

  /**
   * Verifica si hay usuario autenticado (Síncrono para el guard)
   */
  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  /**
   * Verifica de forma asíncrona (para el guard en recarga F5)
   */
  async checkAuthState(): Promise<boolean> {
    return new Promise((resolve) => {
      // Si ya cargó, retorna inmediatamente
      if (!this.isLoading()) {
        resolve(this.isAuthenticated());
        return;
      }

      // Si está cargando, espera al listener
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        resolve(user !== null);
      });
    });
  }

  obtenerUsuarioActual(){
    return this.auth.currentUser;
  }
}