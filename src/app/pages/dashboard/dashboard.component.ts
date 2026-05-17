import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VentasService } from '../../core/services/ventas.service';
import { FiadosService } from '../../core/services/fiados.service'; // ✅ Agregar
import { Venta, CuadreCaja, PagoFiado } from '../../core/interfaces/models'; // ✅ Agregar PagoFiado
import { combineLatest } from 'rxjs'; // ✅ Agregar

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  ventasService = inject(VentasService);
  fiadosService = inject(FiadosService); // ✅ Agregar
  
  ventas: Venta[] = [];
  pagosFiados: PagoFiado[] = []; // ✅ Agregar
  cuadre: CuadreCaja | null = null;
  isLoading = true;

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.isLoading = true;
    
    // ✅ Combinar ventas del día + pagos de fiados del día
    combineLatest([
      this.ventasService.obtenerVentasHoy(),
      this.fiadosService.obtenerPagosFiadosHoy()
    ]).subscribe(([ventas, pagosFiados]) => {
      this.ventas = ventas;
      this.pagosFiados = pagosFiados;
      
      this.ventasService.calcularCuadreCaja(ventas, pagosFiados).then(cuadre => {
        this.cuadre = cuadre;
        this.isLoading = false;
      });
    });
  }

  formatearFecha(timestamp: any): string {
    const fecha = timestamp.toDate();
    return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
}