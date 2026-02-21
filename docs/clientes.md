# Módulo de Clientes - Frontend

## Arquitectura

El módulo de clientes sigue una arquitectura de componentes modular con separación clara de responsabilidades:

```
src/
├── components/
│   ├── clientes/
│   │   ├── ClientesCatalogo.tsx          # Catálogo principal
│   │   ├── ClienteModal.tsx              # Modal CRUD
│   │   └── MisClientesPlaceholder.tsx   # Placeholder tab
│   ├── ui/
│   │   ├── DataControls.tsx              # Componente reutilizable de búsqueda/orden/paginación
│   │   ├── Pagination.tsx                # Componente de paginación
│   │   └── EmptyState.tsx               # Componente de estado vacío
│   └── ui/index.ts                       # Barrel exports
├── pages/
│   └── ClientesPage.tsx                  # Página principal
├── services/
│   └── cliente.service.ts               # Servicio API
├── types/
│   └── cliente.types.ts                 # Tipos TypeScript
├── cache/
│   ├── key.builder.ts                   # Keys de caché
│   └── cache.service.ts                 # Servicio de caché
├── hooks/
│   ├── useFetch.ts                      # Hook de data fetching
│   └── useToast.ts                      # Hook de notificaciones
└── docs/
    └── clientes.md                      # Esta documentación
```

## Tipos de Datos

### Cliente

```typescript
interface Cliente {
  id: string
  nombre: string
  email: string
  telefono: string | null
  empresa_id: string
  activo: boolean
  created_at: string
  updated_at: string
}

interface CreateClienteData {
  nombre: string
  email: string
  telefono?: string
}

interface UpdateClienteData {
  nombre?: string
  email?: string
  telefono?: string | null
}
```

## Servicio API

### cliente.service.ts

Servicio centralizado para comunicación con el backend:

```typescript
export const clienteService = {
  async getClientes(): Promise<Cliente[]>
  async createCliente(data: CreateClienteData): Promise<Cliente>
  async updateCliente(id: string, data: UpdateClienteData): Promise<Cliente>
  async toggleActivo(id: string, activo: boolean): Promise<Cliente>
}
```

**Características**:
- ✅ Axios con interceptores configurados
- ✅ Manejo automático de errores HTTP
- ✅ Tipado TypeScript completo
- ✅ URLs relativas al base URL

## Componentes UI

### DataControls (Reutilizable)

Componente contenedor genérico para búsqueda, ordenamiento y paginación:

```typescript
interface DataControlsProps<T extends Record<string, any>> {
  data: T[]
  searchFields: (keyof T)[]
  sortOptions: SortOption[]
  defaultSort?: string
  defaultSortOrder?: 'asc' | 'desc'
  pageSize?: number
  children: (filteredData: T[]) => React.ReactNode
}
```

**Características**:
- 🎯 **Generics TypeScript**: Tipado fuerte para cualquier entidad
- 🔍 **Búsqueda multi-campo**: Case-insensitive en múltiples campos
- 📊 **Ordenamiento inteligente**: Strings, números, fechas, booleanos
- 📄 **Paginación en memoria**: Eficiente y configurable
- 📱 **Responsive design**: Adaptado para mobile/desktop
- ♻️ **Render props**: Máxima flexibilidad para contenido

**Uso en Clientes**:
```typescript
<DataControls
  data={clientes}
  searchFields={['nombre', 'email', 'telefono']}
  sortOptions={[
    { value: 'nombre', label: 'Nombre' },
    { value: 'email', label: 'Email' },
    { value: 'created_at', label: 'Fecha de creación' },
    { value: 'activo', label: 'Estado' },
  ]}
  defaultSort="nombre"
  pageSize={10}
>
  {(filteredData) => <Table columns={columns} data={filteredData} />}
</DataControls>
```

### Pagination

Componente dedicado de paginación:

```typescript
interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}
```

**Características**:
- ✅ **Navegación completa**: Anterior/Siguiente + números
- ✅ **Elipsis inteligente**: Para muchas páginas
- ✅ **Contador de resultados**: "Mostrando X-Y de Z"
- ✅ **Estados deshabilitados**: En primera/última página
- ✅ **No renderiza**: Si totalPages <= 1

### EmptyState

Componente para estados vacíos:

```typescript
interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  message: string
  action?: React.ReactNode
}
```

**Usos en Clientes**:
- 🏠 **Estado inicial**: "No hay clientes - Creá tu primer cliente"
- 🔍 **Sin resultados**: "No se encontraron clientes con los filtros aplicados"

## Componentes de Clientes

### ClientesCatalogo

Componente principal del catálogo de clientes:

**Responsabilidades**:
- 📋 **Renderizado de datos**: Tabla desktop + Cards mobile
- 🎛️ **Controles integrados**: Búsqueda, orden, paginación vía DataControls
- 🔄 **Estados de carga**: Loading y empty states
- 🎯 **Acciones**: Editar y activar/desactivar

**Props**:
```typescript
interface ClientesCatalogoProps {
  clientes: Cliente[]
  loading: boolean
  isAdmin: boolean
  onEditar: (cliente: Cliente) => void
  onToggleActivo: (cliente: Cliente) => void
}
```

**Características**:
- ✅ **Sin estado interno**: Props-driven design
- ✅ **Responsive**: Tabla desktop, cards mobile
- ✅ **Accesibilidad**: Tabla semántica, lectores de pantalla
- ✅ **Performance**: Memoización donde aplica

### ClienteModal

Modal para creación/edición de clientes:

**Validaciones**:
- ✅ **Campos requeridos**: Nombre y email
- ✅ **Formato email**: Validación básica
- ✅ **Feedback**: Toast notifications
- ✅ **Loading states**: Durante submit

**Características**:
- 🔄 **Modo dual**: Creación o edición
- 💾 **Cache invalidation**: Limpia caché al mutar
- 🎯 **Focus management**: Auto-focus en primer campo
- ⌨️ **Keyboard navigation**: Escape para cerrar, Enter para submit

### MisClientesPlaceholder

Placeholder para tab "Mis clientes":

**Propósito**:
- 🏠 **Placeholder temporal**: Para futuro módulo de turnos
- 👥 **UX consistente**: Mismo EmptyState reutilizable
- 📱 **Responsive**: Funciona en todos los dispositivos

## Página Principal

### ClientesPage

Página contenedora del módulo:

**Estado gestionado**:
- 📂 **Modal state**: isOpen, selectedCliente
- 🗑️ **Tabs state**: activeTab (clientes/mis-clientes)
- 🔄 **Data fetching**: useFetch con caché

**Características**:
- ✅ **Role-based UI**: Admin puede crear, staff solo editar
- 🗑️ **Cache management**: Invalidación inteligente
- 🎯 **Error handling**: Toast notifications
- 📱 **Responsive**: Mobile-first design

**Flujo de datos**:
```
ClientesPage → cliente.service → API → useFetch → ClientesCatalogo → DataControls → Table/Cards
```

## Sistema de Caché

### Estrategia

**Cache Key Building**:
```typescript
buildKey(ENTITIES.CLIENTES) // "tenant:clientes"
```

**Invalidación**:
```typescript
cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES))
```

**Características**:
- ⏰ **TTL**: Configurable por entidad
- 🏢 **Tenant isolation**: Separado por empresa
- 🔄 **Auto-invalidation**: Al crear/actualizar/eliminar
- 📱 **Revalidation**: Al recuperar focus

### useFetch Hook

Hook personalizado para data fetching:

```typescript
const { data, loading, revalidate } = useFetch(
  key,
  fetcher,
  { ttl: TTL.SHORT }
)
```

**Características**:
- ✅ **Cache automático**: Con TTL configurado
- ✅ **Revalidation**: On window focus
- ✅ **Loading states**: Integrados
- ✅ **Error handling**: Con retry opcional

## Sistema de Diseño

### Componentes UI Kit

**Componentes utilizados**:
- 🎨 **Button**: Primary, secondary, ghost, danger variants
- 📝 **Input**: Con prefix icons y validación
- 📋 **Select**: Con options array
- 🗂️ **Modal**: Overlay management
- 📊 **Table**: Responsive con loading states
- 🃏 **Card**: Para mobile view
- 🏷️ **Badge**: Estados y categorías
- 🔄 **Spinner**: Loading indicators
- 👤 **Avatar**: Perfiles y placeholders
- 📑 **Tabs**: Navegación interna
- 🎯 **EmptyState**: Estados vacíos

### Tema y Estilos

**Colores**:
- 🎨 **Primary**: `blue-600` para acciones principales
- ✅ **Success**: `green` para estados activos
- ⚠️ **Warning**: `yellow` para advertencias
- ❌ **Danger**: `red` para acciones destructivas
- 🎨 **Neutral**: `gray-50` fondos, `gray-900` texto

**Breakpoints**:
- 📱 **Mobile**: `< lg` (cards view)
- 💻 **Desktop**: `>= lg` (table view)

## Manejo de Estados

### Estados de Carga

**Loading Skeletons**:
- 📊 **Table**: Skeleton rows con shimmer
- 🃏 **Cards**: Skeleton cards
- 🔄 **Botones**: Loading states

**Empty States**:
- 🏠 **Inicial**: "No hay clientes - Creá tu primer cliente"
- 🔍 **Sin resultados**: "No se encontraron clientes con los filtros aplicados"
- ❌ **Error**: Mensaje de error con acción de reintentar

### Estados de Error

**Toast Notifications**:
- ✅ **Success**: "Cliente creado exitosamente"
- ⚠️ **Warning**: "Email ya existe"
- ❌ **Error**: "Error al crear cliente"

**Error Boundaries**:
- 🛡️ **Component-level**: Catch y renderizado fallback
- 🌐 **Global**: Error boundary principal

## Performance

### Optimizaciones

**Renderizado**:
- ⚡ **React.memo**: En componentes pesados
- 🔄 **useMemo**: En cálculos complejos
- 📦 **Lazy loading**: Para componentes grandes

**Data Fetching**:
- 🗄️ **Cache**: Reducción de requests
- 🔄 **Debouncing**: En búsqueda (implementado en DataControls)
- 📱 **Pagination**: Reducción de datos transferidos

**Bundle Size**:
- 📦 **Tree shaking**: Imports específicos
- 🗂️ **Code splitting**: Por ruta
- 🎨 **CSS optimizado**: Classes reutilizables

## Accesibilidad

### WCAG 2.1 AA

**Semántica HTML**:
- 📊 **Table**: Proper thead/tbody/th/td
- 🎯 **Buttons**: Con texto descriptivo
- 📝 **Forms**: Labels y placeholders

**Keyboard Navigation**:
- ⌨️ **Tab order**: Lógico y secuencial
- 🎯 **Focus indicators**: Visibles claros
- ⌨️ **Shortcuts**: Escape para cerrar modales

**Screen Readers**:
- 🔊 **ARIA labels**: En componentes interactivos
- 📢 **Announcements**: Para cambios de estado
- 🎯 **Focus management**: En modales y dialogs

## Testing

### Unit Tests

**Componentes**:
- 🧪 **DataControls**: Lógica de filtrado/orden/paginación
- 🧪 **Pagination**: Navegación y estados
- 🧪 **ClienteModal**: Validaciones y submit

**Hooks**:
- 🧪 **useFetch**: Cache y revalidation
- 🧪 **useToast**: Notificaciones

### Integration Tests

**Flujos completos**:
- 🧪 **CRUD completo**: Crear → Editar → Eliminar
- 🧪 **Búsqueda**: Filtros y ordenamiento
- 🧪 **Paginación**: Navegación entre páginas

**E2E Tests**:
- 🧪 **User journeys**: Desde login hasta CRUD completo
- 🧪 **Responsive**: Comportamiento mobile/desktop
- 🧪 **Accesibilidad**: Navegación por keyboard

## Internacionalización

### Estructura

**Messages**:
```typescript
const messages = {
  clientes: {
    title: 'Clientes',
    create: 'Nuevo cliente',
    edit: 'Editar cliente',
    empty: 'No hay clientes',
    searchPlaceholder: 'Buscar clientes...',
    // ...
  }
}
```

**Consideraciones**:
- 🌍 **Plurales**: Manejo de singular/plural
- 📅 **Fechas**: Formato localizado
- 💰 **Números**: Formato localizado

## Seguridad

### Validaciones Frontend

**Input Validation**:
- ✅ **Sanitización**: Prevención de XSS
- 📧 **Email format**: Validación básica
- 📞 **Phone format**: Validación opcional

**Data Protection**:
- 🔒 **No sensitive data**: Sin passwords en frontend
- 🗑️ **Data cleanup**: Limpieza de estado al logout
- 🔄 **Token management**: Refresh automático

### XSS Prevention

**Sanitización**:
- 🧹 **DOMPurify**: Para user-generated content
- 📝 **TextContent**: Sobre innerHTML
- 🎯 **React built-in**: Protección automática

## Monitoreo y Analytics

### Métricas de Usuario

**Event Tracking**:
- 📊 **Page views**: ClientesPage visits
- 🎯 **Interactions**: Búsquedas, filtros, CRUD
- ⏱️ **Performance**: Tiempos de carga
- ❌ **Errors**: Rate de errores

**Performance Monitoring**:
- ⚡ **Core Web Vitals**: LCP, FID, CLS
- 📱 **Bundle size**: Tamaño y carga
- 🔄 **API response times**: Latencia de endpoints

## Deployment

### Build Process

**Optimizaciones**:
- 🗜️ **Minificación**: JS y CSS
- 📦 **Bundle splitting**: Por ruta
- 🗂️ **Tree shaking**: Eliminación de unused code
- 🎨 **CSS optimization**: PurgeCSS

**Environment Variables**:
```bash
REACT_APP_API_URL=http://localhost:4000
REACT_APP_ENVIRONMENT=development
```

### CDN Considerations

**Assets**:
- 🖼️ **Images**: Optimizadas y lazy loaded
- 🎨 **Icons**: SVG inline o sprite
- 📱 **Responsive images**: Srcset y sizes

## Roadmap Futuro

### Mejoras Planeadas

**Short Term**:
- 📱 **Mobile improvements**: Swipe actions, pull-to-refresh
- 🔍 **Advanced search**: Filtros por fecha, estado avanzados
- 📊 **Analytics dashboard**: Métricas de clientes

**Medium Term**:
- 🔄 **Real-time updates**: WebSocket para cambios
- 📤 **Export/Import**: CSV, Excel
- 🏷️ **Tags/Categorías**: Clasificación de clientes

**Long Term**:
- 🤖 **AI features**: Búsqueda inteligente, recomendaciones
- 📊 **Advanced analytics**: Tendencias, predicciones
- 🔄 **Offline support**: PWA capabilities

## Extensibilidad

### Reutilización

**DataControls** ya está preparado para:
- 👥 **Usuarios**: searchFields={['nombre', 'email', 'username']}
- 🛠️ **Servicios**: searchFields={['nombre', 'duracion']}
- 📅 **Turnos**: searchFields={['cliente', 'servicio', 'fecha']}

### Patrones Establecidos

**Component Pattern**:
```typescript
// Nuevo módulo
<DataControls
  data={items}
  searchFields={['field1', 'field2']}
  sortOptions={[{value: 'field1', label: 'Campo 1'}]}
>
  {(filteredData) => <Table columns={columns} data={filteredData} />}
</DataControls>
```

**Service Pattern**:
```typescript
export const itemService = {
  async getItems(): Promise<Item[]>
  async createItem(data: CreateItemData): Promise<Item>
  async updateItem(id: string, data: UpdateItemData): Promise<Item>
  async toggleActive(id: string, active: boolean): Promise<Item>
}
```

## Dependencias

### Core Dependencies

- **React**: ^18.0.0
- **TypeScript**: ^5.0.0
- **React Router**: ^6.0.0
- **Axios**: ^1.0.0

### UI Dependencies

- **Lucide React**: ^0.263.1 (Iconos)
- **Tailwind CSS**: ^3.0.0 (Estilos)

### Development Dependencies

- **@types/react**: ^18.0.0
- **ESLint**: Configuración personalizada
- **Prettier**: Formato de código

## Configuración

### Tailwind CSS

**Configuración personalizada**:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#2563eb', // blue-600
        success: '#16a34a', // green-600
        danger: '#dc2626',  // red-600
      }
    }
  }
}
```

### TypeScript

**Configuración estricta**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true
  }
}
```

## Contribución

### Guía de Estilo

**Componentes**:
- 📝 **Naming**: PascalCase para componentes
- 🗂️ **Folders**: Feature-based organization
- 📄 **Files**: ComponentName.tsx, ComponentName.styles.ts

**Code Style**:
- 🎯 **Functions**: Arrow functions para componentes
- 📝 **Variables**: camelCase
- 🏷️ **Types**: Interfaces para props y estado

### Review Process

**Checklist**:
- ✅ **Tipado**: TypeScript completo
- ✅ **Accesibilidad**: WCAG compliance
- ✅ **Performance**: Sin regresiones
- ✅ **Testing**: Cobertura adecuada
- ✅ **Documentation**: Actualizada

## Troubleshooting

### Issues Comunes

**DataControls no filtra**:
- 🔍 Verificar searchFields array
- 📝 Revisar tipos de datos
- 🔄 Chequear transformación a lowercase

**Cache no se invalida**:
- 🗑️ Verificar key building
- 🔄 Revisar invalidateByPrefix
- 📱 Chequear tenant context

**Modal no cierra**:
- 🎯 Verificar onClose prop
- ⌨️ Chequear keyboard events
- 🖱️ Revisar backdrop click

### Debug Tools

**React DevTools**:
- 📊 **Component tree**: Inspeccionar estado
- 🔄 **Props drilling**: Seguir data flow
- ⚡ **Performance**: Identificar cuellos de botella

**Network Tab**:
- 🌐 **API calls**: Verificar requests
- 📊 **Response times**: Identificar lentitud
- ❌ **Errors**: Debug HTTP errors
