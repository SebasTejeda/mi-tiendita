// src/app/core/guards/auth.guard.ts

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificación síncrona primero (navegación normal)
  if (authService.isAuthenticated()) {
    return true;
  }

  // Verificación asíncrona (solo si está cargando, ej: F5)
  if (authService.isLoading()) {
    const isAuth = await authService.checkAuthState();
    if (isAuth) {
      return true;
    }
  }

  // Si no está autenticado, redirigir al login
  router.navigate(['/login']);
  return false;
};