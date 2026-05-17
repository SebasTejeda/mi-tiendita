// src/app/app.component.ts

import { Component, inject, effect, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { LayoutComponent } from './shared/layout/layout.component';
import { ConfiguracionService } from './core/services/configuracion.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LayoutComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent implements OnInit {
  authService = inject(AuthService);

  title = 'mi-tiendita';

  private configuracionService = inject(ConfiguracionService);

  ngOnInit(): void {
    // Effect para reaccionar a cambios en el estado de autenticación
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('✅ Usuario autenticado:', user.email);
      } else {
        console.log('❌ No hay usuario autenticado');
      }
    });

    this.configuracionService.obtenerCategorias().subscribe(categorias => {
      console.log('✅ Categorías cargadas:', categorias.length);
    });
    
    this.configuracionService.obtenerMedidas().subscribe(medidas => {
      console.log('✅ Medidas cargadas:', medidas.length);
    });
    
    this.configuracionService.obtenerReceptores().subscribe(receptores => {
      console.log('✅ Receptores cargados:', receptores.length);
    });
  }
}
