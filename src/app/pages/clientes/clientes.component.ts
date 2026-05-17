import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClientesService } from '../../core/services/clientes.service';
import { Cliente } from '../../core/interfaces/models';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss'
})
export class ClientesComponent implements OnInit {
  private fb = inject(FormBuilder);
  clientesService = inject(ClientesService);
  
  clientes: Cliente[] = [];
  isLoading = true;
  
  modalAbierto = signal(false);
  modoEdicion = false;
  clienteEditando: Cliente | null = null;
  
  clienteForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    telefono: ['', Validators.required],
    referencia: ['']
  });

  ngOnInit(): void {
    this.clientesService.obtenerClientes().subscribe(clientes => {
      this.clientes = clientes;
      this.isLoading = false;
    });
  }

  abrirModalNuevo(): void {
    this.modoEdicion = false;
    this.clienteEditando = null;
    this.clienteForm.reset();
    this.modalAbierto.set(true);
  }

  abrirModalEditar(cliente: Cliente): void {
    this.modoEdicion = true;
    this.clienteEditando = cliente;
    this.clienteForm.patchValue(cliente);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.clienteForm.reset();
  }

  async guardarCliente(): Promise<void> {
    if (this.clienteForm.invalid) {
      this.clienteForm.markAllAsTouched();
      return;
    }

    const datos = this.clienteForm.value;

    try {
      if (this.modoEdicion && this.clienteEditando) {
        await this.clientesService.actualizarCliente(this.clienteEditando.id, datos);
      } else {
        await this.clientesService.crearCliente(datos);
      }
      this.cerrarModal();
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async eliminarCliente(cliente: Cliente): Promise<void> {
    await this.clientesService.eliminarCliente(cliente.id);
  }
}