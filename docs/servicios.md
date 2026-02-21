# Módulo de Servicios - Frontend

## Overview
El módulo de servicios permite gestionar el catálogo de servicios de la empresa y las suscripciones de los usuarios a dichos servicios.

## Arquitectura

### Componentes Principales

#### 📄 Página Principal
- **`ServiciosPage.tsx`** - Página principal con tabs para catálogo y mis servicios

#### 🎨 Componentes de UI
- **`ServiciosCatalogo.tsx`** - Catálogo de servicios (tabla desktop, cards mobile)
- **`MisServiciosList.tsx`** - Lista de suscripciones del usuario
- **`CrearServicioModal.tsx`** - Modal para crear nuevos servicios
- **`EditarServicioModal.tsx`** - Modal para editar servicios existentes
- **`EditarMiServicioModal.tsx`** - Modal para editar suscripción propia

#### 🔧 Servicios y Tipos
- **`servicio.service.ts`** - Cliente API para comunicación con backend
- **`servicio.types.ts`** - Interfaces TypeScript
- **`ConfirmDialog.tsx`** - Componente reutilizable para confirmaciones

## Flujo de Usuario

### 1. Catálogo de Servicios
```
Usuario → ServiciosPage → Tab "Servicios" → ServiciosCatalogo
├── Admin: Ve botón "Nuevo servicio" + acciones editar/eliminar
└── Todos: Ve botón "Suscribirse" (deshabilitado si ya está suscripto)
```

### 2. Mis Servicios
```
Usuario → ServiciosPage → Tab "Mis servicios" → MisServiciosList
├── Muestra servicios suscriptos con datos personalizados
└── Acciones: Editar suscripción, Desuscribirse
```

### 3. Crear/Editar Servicio (Admin)
```
Admin → "Nuevo servicio" → CrearServicioModal → API → Cache invalidation
Admin → "Editar" → EditarServicioModal → API → Cache invalidation
```

### 4. Gestión de Suscripciones
```
Usuario → "Suscribirse" → API → Cache invalidation
Usuario → "Editar mi servicio" → EditarMiServicioModal → API → Cache invalidation
Usuario → "Desuscribirse" → ConfirmDialog → API → Cache invalidation
```

## Estados y Cache

### Cache Keys
```typescript
ENTITIES.SERVICIOS = 'servicios'      // Catálogo de servicios
ENTITIES.MIS_SERVICIOS = 'mis-servicios' // Suscripciones del usuario
```

### TTL Configuration
```typescript
TTL.MEDIUM  // 5 minutos para catálogo de servicios
TTL.SHORT   // 1 minuto para suscripciones (más dinámico)
```

### Invalidation Strategy
| Operación | Keys Invalidadas |
|-----------|-----------------|
| Crear/editar/eliminar servicio | `SERVICIOS` |
| Suscribirse/desuscribirse/editar mi servicio | `MIS_SERVICIOS` |
| Eliminar servicio | `SERVICIOS` + `MIS_SERVICIOS` (CASCADE) |

## Componentes UI Detallados

### ServiciosCatalogo
- **Responsive**: Tabla en desktop (lg+), cards en mobile
- **Estados de suscripción**: Detecta si usuario ya está suscripto
- **Acciones contextuales**: Botones diferentes para admin vs usuarios

### MisServiciosList
- **Datos enriquecidos**: JOIN con datos del servicio padre
- **Personalización**: Muestra precio/duración personalizados o base
- **Niveles de habilidad**: Badges coloreados (básico, intermedio, avanzado, experto)

### ConfirmDialog
- **Reutilizable**: Disponible en todo el proyecto
- **Variantes**: `danger` (acciones críticas), `primary` (confirmaciones)
- **Accesibilidad**: Focus management y keyboard navigation

## Types TypeScript

### Interfaces Principales
```typescript
interface Servicio {
  id: string
  nombre: string
  descripcion: string | null
  duracion: number
  precio_base: number | null
  precio_minimo: number | null
  precio_maximo: number | null
  empresa_id: string
  activo: boolean
  created_at: string
  updated_at: string
}

interface UsuarioServicio {
  id: string
  usuario_id: string
  servicio_id: string
  empresa_id: string
  precio_personalizado: number | null
  duracion_personalizada: number | null
  habilitado: boolean
  nivel_habilidad: string | null
  notas: string | null
  // JOIN fields
  servicio_nombre?: string
  servicio_descripcion?: string | null
  servicio_precio_base?: number | null
}
```

## API Integration

### Servicio Client
```typescript
servicioService = {
  getServicios(): Promise<Servicio[]>
  createServicio(data: CreateServicioData): Promise<Servicio>
  updateServicio(id: string, data: UpdateServicioData): Promise<Servicio>
  toggleActivo(id: string, activo: boolean): Promise<Servicio>
  deleteServicio(id: string): Promise<void>
  suscribirse(servicioId: string): Promise<UsuarioServicio>
  desuscribirse(servicioId: string): Promise<void>
  getMisServicios(): Promise<UsuarioServicio[]>
  updateMiServicio(id: string, data: UpdateMiServicioData): Promise<UsuarioServicio>
}
```

### Error Handling
- **Toast notifications** para feedback al usuario
- **try/catch** en todas las operaciones asíncronas
- **Loading states** durante operaciones

## Responsive Design

### Breakpoints
- **Desktop (lg+)**: Tabla con todas las columnas
- **Mobile (<lg)**: Cards expandibles con acciones ocultas

### Mobile Optimizations
- **Cards expandibles**: Click para mostrar/ocultar acciones
- **Touch-friendly**: Botones de tamaño adecuado
- **Scroll horizontal**: Evitado con diseño vertical

## Performance Optimizations

### Cache Strategy
- **useFetch hook** con TTL configurado
- **Invalidación selectiva** por operación
- **Background revalidation** on focus

### Bundle Optimization
- **Lazy loading** de componentes pesados
- **Code splitting** por ruta
- **Tree shaking** de imports no utilizados

## Testing Considerations

### Unit Tests
- **Component rendering** con diferentes props
- **Form validation** en modales
- **Cache behavior** con mock services

### Integration Tests
- **API communication** con mock server
- **User flows** completos
- **Error scenarios**

### E2E Tests
- **CRUD operations** completas
- **Responsive behavior**
- **Cache invalidation**

## Accessibility

### Keyboard Navigation
- **Tab order** lógico en modales
- **Escape key** para cerrar modales
- **Enter/Space** para activar botones

### Screen Readers
- **ARIA labels** en botones de acción
- **Live regions** para notificaciones
- **Semantic HTML** structure

## Security Considerations

### Client-side
- **Role-based UI**: Botones condicionales por rol
- **Input validation** en formularios
- **XSS prevention** con React sanitization

### Data Validation
- **TypeScript strict mode**
- **Runtime validation** en API responses
- **Error boundaries** para manejo de errores

## Future Enhancements

### Planned Features
- **Filtros y búsqueda** en catálogo
- **Paginación** para grandes volúmenes
- **Exportación** de datos a CSV/PDF
- **Notificaciones** push para cambios
- **Offline support** con service workers

### Technical Debt
- **Migrate a React Query** para mejor cache management
- **Implementar virtual scrolling** para listas grandes
- **Add analytics tracking** para user behavior
- **Optimize bundle size** con lazy loading

## Dependencies

### Core Dependencies
- React 18+ con hooks
- TypeScript para type safety
- TailwindCSS para styling
- Lucide React para icons

### Custom Dependencies
- `useFetch` hook para cache
- `cacheService` para data management
- `toastService` para notificaciones
- `authService` para autenticación

## Troubleshooting

### Common Issues
1. **Cache staleness**: Invalidar keys correctas
2. **Type errors**: Verificar interfaces TypeScript
3. **Mobile layout**: Test en diferentes viewports
4. **API errors**: Check network tabs y console

### Debug Tools
- **React DevTools** para component state
- **Network tab** para API calls
- **Console** para error logging
- **Cache inspector** para data storage
