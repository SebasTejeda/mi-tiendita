import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.obtenerUsuarioActual();
  
  if (user?.email === 'tejedasebastian129@gmail.com') {
    return true;
  }

  Swal.fire({
    icon: 'error',
    title: 'Acceso Denegado',
    text: 'Solo el administrador puede acceder a esta sección',
    confirmButtonText: 'Entendido'
  });

  router.navigate(['/dashboard']);
  return false;
};