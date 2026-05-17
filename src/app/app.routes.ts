// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'ventas',
    loadComponent: () => import('./pages/ventas/ventas.component').then((m) => m.VentasComponent),
    canActivate: [authGuard],
  },
  {
    path: 'inventario',
    loadComponent: () =>
      import('./pages/inventario/inventario.component').then((m) => m.InventarioComponent),
    canActivate: [authGuard],
  },
  {
    path: 'clientes',
    loadComponent: () =>
      import('./pages/clientes/clientes.component').then((m) => m.ClientesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'fiados',
    loadComponent: () => import('./pages/fiados/fiados.component').then((m) => m.FiadosComponent),
    canActivate: [authGuard],
  },
  {
    path: 'envases',
    loadComponent: () =>
      import('./pages/envases/envases.component').then((m) => m.EnvasesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'configuracion',
    loadComponent: () =>
      import('./pages/configuracion/configuracion.component').then((m) => m.ConfiguracionComponent),
    canActivate: [authGuard, adminGuard], // ✅ Protegido con ambos guards
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
