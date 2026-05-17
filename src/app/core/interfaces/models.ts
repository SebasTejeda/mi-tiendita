// src/app/core/interfaces/models.ts

import { Timestamp } from '@angular/fire/firestore';

// ========== PRODUCTO ==========
export interface Receptor {
  id: string;
  nombre: string;
  activo: boolean;
  fecha_creacion: Timestamp;
}

export interface Categoria {
  id: string;
  nombre: string;
  activo: boolean;
  icono?: string; // Opcional: 🛒, 🍺, 🥤, etc.
  fecha_creacion: Timestamp;
}

export interface Medida {
  id: string;
  nombre: string; // "Unidad", "Kilo", "Litro", "Caja", "Paquete"
  abreviatura: string; // "Und", "Kg", "L", "Cj", "Paq"
  activo: boolean;
  fecha_creacion: Timestamp;
}

// ✅ Actualizar modelo de Producto
export interface Producto {
  id: string;
  nombre: string;
  categoria: string; // Ahora viene de la colección de categorías
  precio: number;
  medida: string; // Ahora viene de la colección de medidas
  valor_medida: number;
  stock: number;
  stock_minimo: number;
  es_faltante: boolean;
  fecha_creacion: Timestamp;
  imagen_url?: string;
  es_retornable: boolean;
  precio_envase?: number;
  descripcion_envase?: string;
}

// ========== CLIENTE ==========
export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  referencia: string; // Dirección o nota
}

// ========== ITEM DE VENTA ==========
export interface ItemVenta {
  producto: string; // Nombre del producto
  productoId: string; // ID del producto
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

// ========== VENTA ==========
export interface Venta {
  id: string;
  fecha: Timestamp;
  total: number;
  metodo_pago: 'efectivo' | 'yape' | 'plin' | 'fiado';
  receptor?: string; // A quién llegó el dinero (solo para yape/plin)
  items: ItemVenta[];
  clienteId?: string; // Solo si es fiado
  nombre_cliente?: string; // Solo si es fiado
}

// ========== FIADO (Deuda Activa) ==========
export interface Fiado {
  id: string;
  clienteId: string;
  nombre_cliente: string;
  monto_deuda: number;
  monto_original?: number; // Para saber cuánto era la deuda inicial
  fecha_fiado: Timestamp;
  estado: 'pendiente' | 'pagado';
  productos_llevados: ItemVenta[];
}

// ========== PAGO DE FIADO (Historial) ==========
export interface PagoFiado {
  id: string;
  clienteId: string;
  nombre_cliente: string;
  monto_pagado: number;
  fecha_pago: Timestamp;
  tipo_pago: 'Pago Total' | 'Pago de Ticket' | 'Abono Parcial';
  tickets_pagados?: string[]; // IDs de fiados liquidados
  metodo_pago?: 'efectivo' | 'yape' | 'plin'; // Para abonos parciales
  receptor?: string; // A quién llegó el dinero (solo para yape/plin)
}

// ========== CUADRE DE CAJA (Para Dashboard) ==========
export interface CuadreCaja {
  total_efectivo: number;
  total_yape: number;
  total_plin: number;
  total_fiados: number;
  pagos_fiados_efectivo: number;
  pagos_fiados_yape: number;
  pagos_fiados_plin: number;
  desglose_transferencias: {
    receptor: string;
    monto: number;
  }[];
}

// ========== USUARIO (Firebase Auth) ==========
export interface Usuario {
  uid: string;
  email: string;
  displayName?: string;
}

export interface Envase {
  id: string;
  clienteId: string;
  nombre_cliente: string;
  tipo: 'botella' | 'caja_cerveza' | 'otro'; // Tipo de envase
  descripcion: string; // "Botella de vidrio 650ml", "Caja Pilsen", etc.
  cantidad: number; // Cuántos envases debe
  monto_por_unidad: number; // S/ 1.00 por botella, S/ 5.00 por caja, etc.
  monto_total: number; // cantidad * monto_por_unidad
  fecha_registro: Timestamp;
  estado: 'pendiente' | 'devuelto'; // Si ya devolvió el envase
}

export interface DevolucionEnvase {
  id: string;
  clienteId: string;
  nombre_cliente: string;
  envaseId: string; // Referencia al envase original
  descripcion: string;
  cantidad_devuelta: number;
  monto_devuelto: number;
  fecha_devolucion: Timestamp;
}
