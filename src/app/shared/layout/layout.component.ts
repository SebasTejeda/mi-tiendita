// src/app/shared/layout/layout.component.ts

import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  authService = inject(AuthService);

  // Signal para controlar el estado del menú móvil
  isSidebarOpen = signal(false);

  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: '📊', route: '/dashboard' },
    { label: 'Punto de Venta', icon: '🛒', route: '/ventas' },
    { label: 'Inventario', icon: '📦', route: '/inventario' },
    { label: 'Clientes', icon: '👥', route: '/clientes' },
    { label: 'Fiados', icon: '📔', route: '/fiados' },
    { label: 'Envases', icon: '🍾', route: '/envases' }, // ✅ Nuevo
    { label: 'Configuración', icon: '⚙️', route: '/configuracion' }, // ✅ Nuevo
  ];

  toggleSidebar(): void {
    this.isSidebarOpen.update((state) => !state);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }
}
