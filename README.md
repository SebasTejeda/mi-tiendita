🏪 Mi Tiendita - Sistema POS e Inventario
Sistema de Punto de Venta (POS) e Inventario diseñado específicamente para tiendas familiares, con interfaz responsive optimizada para escritorio y dispositivos móviles.
🚀 Tecnologías

Frontend: Angular 18 (Standalone Components)
Backend: Firebase (Authentication + Firestore)
UI: CSS/SCSS puro (sin frameworks)
Alertas: SweetAlert2

✨ Características
📊 Dashboard

Cuadre de caja diario
Resumen de ventas por método de pago
Desglose de transferencias por receptor
Tabla de ventas del día

🛒 Punto de Venta

Catálogo de productos con búsqueda y filtros
Carrito de compras reactivo
Múltiples métodos de pago (Efectivo, Yape, Plin, Fiado)
Descuento automático de stock

📦 Inventario

CRUD completo de productos
Ordenamiento dinámico por columnas
Alertas visuales de stock bajo
Gestión de medidas (Unidad, Kilo, Litro)

👥 Clientes

Registro de clientes
Gestión de datos de contacto

📔 Cuaderno de Fiados

Agrupación de deudas por cliente
Historial de pagos
Opciones de pago: ticket individual, abono parcial, pago total
Modal con pestañas (Deudas Pendientes / Historial)

📋 Requisitos Previos

Node.js 18+ y npm
Angular CLI 18
Cuenta de Firebase

🔧 Instalación

Clonar el repositorio

bashgit clone <tu-repo>
cd mi-tiendita

Instalar dependencias

bashnpm install

Configurar Firebase

Crea un proyecto en Firebase Console
Habilita Authentication (Email/Password)
Crea una base de datos Firestore
Copia las credenciales de configuración


Configurar variables de entorno

Duplica environment.example.ts como environment.ts
Pega tus credenciales de Firebase


Crear usuario inicial

Ve a Firebase Console → Authentication → Users
Agrega un usuario manualmente con email y contraseña


Iniciar servidor de desarrollo

bashng serve

Abrir en el navegador

Navega a http://localhost:4200
Inicia sesión con las credenciales del paso 5



🏗️ Arquitectura
Standalone Components
100% componentes standalone (sin app.module.ts)
Control Flow Moderno
Uso exclusivo de @if, @for, @empty (nuevo en Angular 17+)
Signals
Reactividad con Signals combinados con RxJS para Firebase
Lazy Loading
Carga diferida de módulos con PreloadAllModules
Guards
Protección de rutas con guards funcionales
📂 Estructura del Proyecto
src/app/
├── core/
│   ├── guards/          # Protección de rutas
│   ├── interfaces/      # Modelos TypeScript
│   └── services/        # Servicios de Firebase
├── pages/               # Componentes de páginas (lazy loaded)
├── shared/
│   └── layout/          # Layout principal con sidebar
├── app.component.*      # Componente raíz
├── app.routes.ts        # Configuración de rutas
└── app.config.ts        # Configuración de providers
🎨 Diseño Responsive

Desktop (>768px): Sidebar fijo + contenido principal
Mobile (≤768px):

Sidebar como offcanvas (hamburguesa)
Carrito como modal flotante inferior
Layout optimizado para pantallas pequeñas



🔒 Seguridad

Autenticación requerida para todas las rutas internas
Reglas de seguridad en Firestore
Validación de formularios
Manejo de errores

📱 Modo Offline (Futuro)
Planificado: PWA con service workers para funcionamiento offline
🚢 Despliegue
Firebase Hosting
bashnpm run build
firebase deploy --only hosting
Vercel / Netlify

Build command: ng build --configuration production
Output directory: dist/mi-tiendita/browser

🤝 Contribuciones
Este es un proyecto familiar privado, pero acepta sugerencias vía issues.
📄 Licencia
Uso privado exclusivo para la tienda familiar.
👨‍💻 Desarrollo
Desarrollado con ❤️ para la tienda de la familia

Versión: 1.0.0
Última actualización: Mayo 2026