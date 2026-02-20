# Sistema de Layout - Turnos System

## Overview

El sistema de layout de Turnos System está diseñado para proporcionar una experiencia de usuario responsive y moderna, con soporte para dispositivos móviles y desktop. El sistema consta de tres componentes principales: `Layout`, `Navbar` y `Sidebar`.

## Arquitectura del Sistema

### 1. Layout Component (`Layout.tsx`)

**Propósito:** Componente contenedor principal que orquesta toda la estructura de la aplicación.

**Estado gestionado:**
- `collapsed: boolean` - Controla si el sidebar está colapsado (desktop)
- `mobileOpen: boolean` - Controla si el sidebar móvil está abierto

**Estructura visual:**
```
┌─────────────────────────────────────┐
│           Navbar (fixed)             │
├─────────┬───────────────────────────┤
│ Sidebar │        Main Content       │
│ (flex)  │      (flex-1)            │
│         │                           │
│         │     <Outlet />           │
│         │                           │
└─────────┴───────────────────────────┘
```

**Características clave:**
- Layout flexbox de altura completa (`h-screen`)
- Navbar fijo en la parte superior
- Sidebar y Main como hermanos en flex row
- Main ocupa el espacio restante (`flex-1`)
- Background gris claro (`bg-gray-100`)

### 2. Navbar Component (`Navbar.tsx`)

**Propósito:** Barra de navegación superior con información del usuario y controles móviles.

**Props:**
```typescript
interface NavbarProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
}
```

**Estructura:**
- **Izquierda:** Botón hamburguesa (solo mobile) + logo "Turnos System"
- **Derecha:** Email usuario (oculto en xs) + avatar inicial + botón logout

**Características responsive:**
- Mobile: Muestra botón hamburguesa, oculta email parcialmente
- Desktop: Oculta botón hamburguesa, muestra email completo
- Avatar con inicial del usuario en fondo azul
- Botón logout solo cuando está autenticado

**Estilos:**
- Altura fija: `h-16`
- Background: `bg-gray-900`
- Z-index: `z-30` (para superposiciones)
- Padding responsive: `px-4 lg:px-6`

### 3. Sidebar Component (`Sidebar.tsx`)

**Propósito:** Menú de navegación lateral con soporte para colapsado y mobile.

**Props:**
```typescript
interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}
```

**Arquitectura dual:**
El sidebar implementa dos renderizados completamente separados:

#### Desktop Sidebar (lg+)
- Posición: Estático en flujo flex
- Visibilidad: `hidden lg:flex`
- Ancho: `w-60` (expandido) / `w-16` (colapsado)
- Transición: `transition-[width] duration-300 ease-in-out`

#### Mobile Sidebar (<lg)
- Posición: Fixed sobre el contenido
- Visibilidad: `lg:hidden`
- Ancho fijo: `w-60`
- Animación: `translate-x-0` / `-translate-x-full`

### 4. SidebarContent Component

**Propósito:** Componente reutilizable que renderiza el contenido del sidebar para ambas variantes.

**Props:**
```typescript
{
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isMobile?: boolean;
}
```

**Estructura interna:**
1. **Header:** Título "Menú" + botón colapsar (solo desktop)
2. **Navigation:** Lista de enlaces con iconos
3. **Footer:** No utilizado (espacio para futuras funcionalidades)

## Sistema de Navegación

### Menu Items
```typescript
const menuItems = [
  { path: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'     },
  { path: '/turnos',       icon: Calendar,        label: 'Turnos'        },
  { path: '/usuarios',     icon: Users,           label: 'Usuarios'      },
  { path: '/clientes',     icon: Users,           label: 'Clientes'      },
  { path: '/productos',    icon: Settings,        label: 'Productos'     },
  { path: '/servicios',    icon: Settings,        label: 'Servicios'     },
  { path: '/perfil',       icon: Settings,        label: 'Perfil'        },
];
```

### Estados de Navegación
- **Activo:** `bg-blue-600 text-white`
- **Inactivo:** `text-gray-300 hover:bg-gray-700 hover:text-white`
- **Colapsado:** Solo iconos con `title` tooltip

## Comportamiento Responsive

### Mobile (< lg)
1. **Navbar:** Muestra botón hamburguesa
2. **Sidebar:** Oculto por defecto
3. **Apertura:** Click en botón hamburguesa → overlay + panel
4. **Cierre:** 
   - Click en overlay
   - Cambio de ruta
   - Click en enlace
5. **Ancho fijo:** `w-60`

### Desktop (lg+)
1. **Navbar:** Sin botón hamburguesa
2. **Sidebar:** Siempre visible
3. **Colapsado:** 
   - Botón chevron en header
   - Ancho: `w-16` (colapsado) / `w-60` (expandido)
4. **Tooltips:** En modo colapsado

## Sistema de Estados

### Estado Global (Layout)
```typescript
const [collapsed, setCollapsed] = useState(false);    // Desktop sidebar
const [mobileOpen, setMobileOpen] = useState(false);   // Mobile sidebar
```

### Flujo de Estados
1. **Mobile Open:** `setMobileOpen(!mobileOpen)`
2. **Mobile Close:** `setMobileOpen(false)`
3. **Desktop Toggle:** `setCollapsed(!collapsed)`

### Auto-cierre Mobile
El sidebar móvil se cierra automáticamente en:
- Cambio de ruta (`useEffect` con `location.pathname`)
- Click en overlay
- Redimensionamiento a desktop

## Sistema de Estilos

### Paleta de Colores
- **Primary:** `bg-blue-600` (navegación activa)
- **Dark:** `bg-gray-800` (sidebar)
- **Darker:** `bg-gray-900` (navbar)
- **Light:** `bg-gray-100` (main background)

### Transiciones
- **Width:** `transition-[width] duration-300 ease-in-out`
- **Transform:** `transition-transform duration-300 ease-in-out`
- **Opacity:** `transition-opacity duration-300`

### Z-index Stack
- **Overlay:** `z-40`
- **Mobile Sidebar:** `z-50`
- **Desktop Sidebar:** (no necesita z-index, está en flujo)
- **Navbar:** `z-30`

## Accesibilidad

### ARIA Labels
- Botón mobile: `aria-label="Abrir menú"`
- Botón colapsar: `aria-label="Expandir menú" / "Colapsar menú"`
- Tooltips: `title={label}` en modo colapsado

### Navegación por Teclado
- Enlaces navegables con tab
- Botones con focus states
- Overlay clickable para cierre

## Performance

### Optimizaciones
- **Component separation:** SidebarContent reutilizable
- **Conditional rendering:** Separación desktop/mobile
- **Event listeners:** Cleanup en useEffect
- **CSS transitions:** Hardware acceleration

### Consideraciones
- Sin manipulación directa del DOM
- Estados locales minimizados
- Re-renderizados optimizados

## Problemas Resueltos

### Antes de la Refactorización
- Manipulación directa del DOM con `sidebarRef.style.transform`
- Console logs en producción
- Lógica confusa en botón toggle
- Rutas inconsistentes con router

### Después de la Refactorización
- Puro CSS con clases condicionales
- Sin console logs
- Lógica clara y separada
- Rutas sincronizadas con router
- Componentes reutilizables
- Mejor separación de responsabilidades

## Futuras Mejoras

### Sugerencias
1. **Iconos específicos:** Agregar iconos únicos para clientes, productos, servicios
2. **Search bar:** Agregar búsqueda en sidebar
3. **Notifications:** Badge de notificaciones en navbar
4. **Themes:** Soporte para modo oscuro/claro
5. **Keyboard shortcuts:** Atajos de teclado para navegación

### Extensiones
1. **Multi-tenant:** Branding por tenant
2. **Permissions:** Menú condicional por roles
3. **Bookmarks:** Favoritos del usuario
4. **Recent items:** Historial de navegación

## Debugging y Mantenimiento

### Common Issues
1. **Mobile overlay no cierra:** Verificar `onCloseMobile` prop
2. **Desktop colapsado no funciona:** Revisar `collapsed` state
3. **Rutas no activas:** Verificar `menuItems` vs router
4. **Z-index conflicts:** Revisar stack de z-index

### Debug Tools
- React DevTools para estado de componentes
- CSS Inspector para clases aplicadas
- Network tab para performance
- Console para errores (aunque eliminados)

---

**Última actualización:** Febrero 2026  
**Versión:** 2.0 (Refactorización completa)  
**Autor:** Sistema de Layout Turnos System
