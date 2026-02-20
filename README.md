# Frontend Boilerplate - React + TypeScript + Tailwind CSS

Boilerplate base para aplicaciones frontend React con TypeScript, Tailwind CSS, Axios y React Router. Diseñado como punto de partida para todos los proyectos frontend futuros, con arquitectura escalable y servicios integrados.

## Stack Tecnológico

- **React 19** - Librería principal de UI
- **TypeScript** - Tipado estático y mejor experiencia de desarrollo
- **Tailwind CSS** - Framework de CSS utility-first
- **Axios** - Cliente HTTP para comunicación con APIs
- **React Router** - Enrutamiento declarativo
- **React Hook Form + Zod** - Formularios y validación
- **Lucide React** - Iconos consistentes

## Estructura del Proyecto

```
src/
├── api/                    # Configuración de cliente HTTP
│   └── axiosInstance.ts   # Instancia de Axios con interceptores
├── cache/                  # Sistema de caché multitenant
│   ├── cache.service.ts   # Servicio principal de caché
│   ├── key.builder.ts      # Constructor de keys con tenant
│   ├── ttl.ts             # Constantes de tiempo de vida
│   └── types.ts           # Tipos del sistema de caché
├── components/             # Componentes React
│   ├── ErrorBoundary.tsx  # Boundary para capturar errores
│   ├── PrivateRoute.tsx   # Ruta protegida con autenticación
│   ├── ToastContainer.tsx # Contenedor de notificaciones
│   ├── forms/            # Componentes de formulario
│   ├── layout/           # Layout y navegación
│   └── ui/               # Kit de componentes UI
├── context/               # Contextos de React
│   ├── AppContext.tsx    # Contexto global de la app
│   └── AuthContext.tsx   # Contexto de autenticación
├── hooks/                 # Hooks personalizados
│   ├── useFetch.ts       # Hook para data fetching con caché
│   ├── useErrorHandler.ts # Hook para manejo de errores
│   └── useToast.ts       # Hook para notificaciones
├── pages/                 # Páginas de la aplicación
├── router/               # Configuración de rutas
├── services/             # Servicios de negocio
│   ├── authService.ts    # Servicio de autenticación
│   └── toast.service.ts  # Servicio de notificaciones
└── types/                # Tipos TypeScript
```

## Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Variables de entorno configuradas (ver sección de configuración)

## Arquitectura de Servicios

```
authService + axiosInstance → cacheService + useFetch → componentes de página
                                    ↓
              ErrorBoundary + useErrorHandler + ToastService
```

### Flujo de Dependencias

1. **authService + axiosInstance**: Manejan autenticación y comunicación HTTP
2. **cacheService + useFetch**: Proveen caché y data fetching a componentes
3. **ErrorBoundary + useErrorHandler + ToastService**: Manejan errores y notificaciones

## axiosInstance

**Ubicación**: `src/api/axiosInstance.ts`

### Funcionalidades

- Configuración baseURL desde variable de entorno `VITE_API_URL`
- Interceptor de request que agrega token Bearer desde localStorage
- Interceptor de response con refresh token automático
- Sistema de cola para requests concurrentes durante refresh
- Logging en desarrollo para debugging

### Uso

```typescript
import axiosInstance from '../api/axiosInstance';

// GET
const response = await axiosInstance.get('/users');
const users = response.data.data;

// POST
const newUser = await axiosInstance.post('/users', userData);

// PUT
const updated = await axiosInstance.put('/users/123', updateData);

// DELETE
await axiosInstance.delete('/users/123');
```

### Variables de Entorno

```env
VITE_API_URL=http://localhost:4000
```

## authService

**Ubicación**: `src/services/authService.ts`

### Métodos Disponibles

```typescript
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    roles: string[];
    tenant: string;
  };
}

// Login de usuario
async login(email: string, password: string): Promise<LoginResponse>

// Refresh token
async refresh(): Promise<LoginResponse>

// Logout
async logout(): Promise<void>
```

### Ejemplo de Uso Completo

```typescript
import { authService } from '../services/authService';

try {
  const response = await authService.login('user@example.com', 'password123');
  
  // Guardar tokens (el axiosInstance lo hace automáticamente)
  localStorage.setItem('accessToken', response.accessToken);
  localStorage.setItem('refreshToken', response.refreshToken);
  
  // Redirigir al dashboard
  navigate('/dashboard');
} catch (error) {
  console.error('Error de login:', error);
}
```

### Almacenamiento de Tokens

- **accessToken**: `localStorage.getItem('accessToken')`
- **refreshToken**: `localStorage.getItem('refreshToken')`

## Sistema de Caché

Sistema de caché multitenant con soporte para memoria y localStorage.

### Archivos del Sistema

#### types.ts
**Ubicación**: `src/cache/types.ts`

Define interfaces para:
- `CacheEntry<T>`: Entrada de caché con datos y expiración
- `CacheOptions`: Opciones de configuración (ttl, persist, revalidateOnFocus)
- `FetchState<T>`: Estado de data fetching

#### ttl.ts
**Ubicación**: `src/cache/ttl.ts`

Constantes de tiempo de vida:

| Nivel | Duración | Casos de Uso |
|-------|-----------|--------------|
| `SHORT` | 1 minuto | Datos operativos en tiempo real (estados de pedidos, notificaciones) |
| `MEDIUM` | 5 minutos | Perfil de usuario y datos de sesión |
| `LONG` | 30 minutos | Catálogos y reportes relativamente estáticos |
| `NONE` | 0 | Sin caché (datos siempre frescos) |

#### cache.service.ts
**Ubicación**: `src/cache/cache.service.ts`

**API Pública**:
```typescript
// Obtener datos del caché
get<T>(key: string, persist?: boolean): T | null

// Guardar datos en caché
set<T>(key: string, data: T, ttl: number, persist?: boolean): void

// Invalidar entrada específica
invalidate(key: string): void

// Invalidar por prefijo
invalidateByPrefix(prefix: string): void
```

#### key.builder.ts
**Ubicación**: `src/cache/key.builder.ts`

**Propósito**: Construir keys de caché con aislamiento por tenant.

**Entidades disponibles**:
```typescript
export const ENTITIES = {
  PRODUCTS: 'products',
  USER: 'user',
  REPORTS: 'reports',
  ORDERS: 'orders',
  CATEGORIES: 'categories',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  PROFILE: 'profile'
} as const;
```

**Convención de Keys**: `{tenant}:{entity}:{subkey...}`

**Importancia en Apps Multitenant**: Garantiza que los datos de diferentes tenants nunca se mezclen en el caché.

#### useFetch.ts
**Ubicación**: `src/hooks/useFetch.ts`

Hook para data fetching con caché integrado.

**API**:
```typescript
function useFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions
): FetchState<T> & { revalidate: () => void }
```

### Ejemplos de Uso

#### Sin Caché - Datos Operativos
```typescript
const { data, loading, error } = useFetch(
  buildKey(ENTITIES.ORDERS),
  () => axiosInstance.get('/orders').then(r => r.data.data)
);
```

#### Con Caché en Memoria - Catálogos
```typescript
const { data, loading, error } = useFetch(
  buildKey(ENTITIES.PRODUCTS),
  () => axiosInstance.get('/products').then(r => r.data.data),
  { ttl: TTL.LONG }
);
```

#### Con Caché Persistido - Perfil
```typescript
const { data, loading, error } = useFetch(
  buildKey(ENTITIES.USER, 'profile'),
  () => axiosInstance.get('/user/profile').then(r => r.data.data),
  { ttl: TTL.MEDIUM, persist: true }
);
```

### Invalidación de Caché

Después de una mutación, invalidar el caché relevante:

```typescript
// Después de crear un producto
cacheService.invalidateByPrefix(buildKey(ENTITIES.PRODUCTS));

// Después de actualizar perfil
cacheService.invalidate(buildKey(ENTITIES.USER, 'profile'));
```

## Sistema de Errores

Sistema de manejo de errores con Error Boundaries y hooks para escalación.

### ErrorBoundary

**Ubicación**: `src/components/ErrorBoundary.tsx`

Componente que captura errores de render y muestra UI de error sin romper toda la aplicación.

**Uso**:
```typescript
// 1. Envolver aplicación principal
<ErrorBoundary>
  <App />
</ErrorBoundary>

// 2. Aislar módulo específico
<ErrorBoundary fallback={<p>Error cargando productos</p>}>
  <ProductList />
</ErrorBoundary>

// 3. Con callback para logging
<ErrorBoundary 
  onError={(error, info) => {
    // Futuro: enviar a Sentry
    console.log('Error para logging:', error, info);
  }}
>
  <CriticalComponent />
</ErrorBoundary>
```

### useErrorHandler

**Ubicación**: `src/hooks/useErrorHandler.ts`

Hook para escalar errores async al ErrorBoundary más cercano.

**Uso**:
```typescript
const { throwError } = useErrorHandler();

// En useFetch - escalar al boundary
const { data, error } = useFetch(key, fetcher, options);
if (error) throwError(error);

// En useEffect con errores async
useEffect(() => {
  const fetchData = async () => {
    try {
      const data = await axiosInstance.get('/api/data');
      setData(data);
    } catch (error) {
      throwError(error instanceof Error ? error : new Error('Error fetching data'));
    }
  };
  fetchData();
}, [throwError]);
```

### Diferencia: Manejo Local vs Escalación

- **Manejo Local**: Mostrar mensaje de error específico en el componente
- **Escalación**: Lanzar error al boundary para manejo centralizado

### Montaje en Árbol de Componentes

```typescript
// En App.tsx
<ErrorBoundary>
  <Router>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ErrorBoundary>
          <PrivateRoute>
            <Layout>
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </Layout>
          </PrivateRoute>
        </ErrorBoundary>
      } />
    </Routes>
  </Router>
</ErrorBoundary>
```

## Sistema de Toasts

Sistema de notificaciones no intrusivas con persistencia opcional.

### useToast

**Ubicación**: `src/hooks/useToast.ts`

Hook para mostrar toasts desde componentes React.

**API**:
```typescript
function useToast() {
  return {
    success(message: string, options?: ToastOptions): string,
    error(message: string, options?: ToastOptions): string,
    warning(message: string, options?: ToastOptions): string,
    info(message: string, options?: ToastOptions): string,
    dismiss(id: string): void,
    dismissAll(): void
  };
}
```

### toast.service

**Ubicación**: `src/services/toast.service.ts`

Servicio singleton para usar fuera de componentes React.

**API**:
```typescript
class ToastService {
  success(message: string, options?: ToastOptions): string
  error(message: string, options?: ToastOptions): string
  warning(message: string, options?: ToastOptions): string
  info(message: string, options?: ToastOptions): string
  dismiss(id: string): void
  dismissAll(): void
}
```

### Tipos de Toasts

| Tipo | Duración | Casos de Uso |
|------|----------|--------------|
| `success` | 4 segundos | Acciones completadas exitosamente |
| `error` | 6 segundos | Errores críticos o de red |
| `warning` | 4 segundos | Advertencias no críticas |
| `info` | 4 segundos | Información general |

### Ejemplos de Uso

#### Desde Componente React
```typescript
import { useToast } from '../hooks/useToast';

function MyComponent() {
  const { success, error } = useToast();
  
  const handleSave = async () => {
    try {
      await saveData();
      success('Datos guardados correctamente');
    } catch (err) {
      error('Error al guardar datos');
    }
  };
}
```

#### Fuera de Componentes (axiosInstance)
```typescript
import { toastService } from '../services/toast.service';

// En interceptor de error
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    toastService.error('Error de conexión');
    return Promise.reject(error);
  }
);
```

#### Toasts Persistentes
```typescript
toastService.success('Operación completada', { persistent: true });
```

### Montaje de ToastContainer

**Ubicación**: `src/components/ToastContainer.tsx`

Montar en el nivel más alto de la aplicación:

```typescript
// En App.tsx
function App() {
  return (
    <>
      <Router>
        {/* Rutas */}
      </Router>
      <ToastContainer />
    </>
  );
}
```

## Kit de Componentes UI

### Button

**Descripción**: Botón con variantes, tamaños, iconos y estado de carga.

**Props**:
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  block?: boolean
}
```

**Ejemplo**:
```typescript
<Button variant="primary" size="md" loading={isLoading}>
  Guardar
</Button>
```

### Input

**Descripción**: Input de texto con label, errores, ayuda y prefix.

**Props**:
```typescript
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  help?: string
  prefix?: string | LucideIcon
}
```

**Ejemplo**:
```typescript
<Input 
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={emailError}
  help="Ingresa tu email corporativo"
/>
```

### Select

**Descripción**: Select desplegable con estilo consistente al Input.

**Props**:
```typescript
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'prefix'> {
  label?: string
  error?: string
  help?: string
  options: SelectOption[]
  prefix?: string | LucideIcon
}

interface SelectOption {
  value: string
  label: string
}
```

**Ejemplo**:
```typescript
<Select 
  label="Categoría"
  options={[
    { value: 'electronics', label: 'Electrónica' },
    { value: 'clothing', label: 'Ropa' }
  ]}
  value={category}
  onChange={(e) => setCategory(e.target.value)}
/>
```

### Modal

**Descripción**: Modal con overlay, header, body y footer opcionales.

**Props**:
```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}
```

**Ejemplo**:
```typescript
<Modal 
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirmar eliminación"
  footer={
    <div className="flex justify-end gap-3">
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        Eliminar
      </Button>
    </div>
  }
>
  <p>¿Estás seguro de eliminar este elemento?</p>
</Modal>
```

### Table

**Descripción**: Tabla genérica con loading, estado vacío y renderizado personalizado.

**Props**:
```typescript
interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  loadingRows?: number
  className?: string
}

interface TableColumn<T> {
  key: keyof T
  header: string
  render?: (value: any, item: T, index: number) => React.ReactNode
  className?: string
}
```

**Ejemplo**:
```typescript
<Table 
  columns={[
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Email' },
    {
      key: 'status',
      header: 'Estado',
      render: (value) => (
        <Badge variant={value === 'active' ? 'green' : 'red'}>
          {value === 'active' ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ]}
  data={users}
  loading={isLoading}
  emptyMessage="No hay usuarios registrados"
/>
```

### Card

**Descripción**: Contenedor card con header, body y footer opcionales.

**Props**:
```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  headerAction?: React.ReactNode
  footer?: React.ReactNode
  flat?: boolean
}
```

**Ejemplo**:
```typescript
Card 
  title="Estadísticas"
  subtitle="Últimos 30 días"
  headerAction={
    <Button size="sm">Exportar</Button>
  }
>
  <div className="space-y-4">
    <div className="flex justify-between">
      <span>Ventas:</span>
      <span className="font-semibold">$45,230</span>
    </div>
  </div>
</Card>
```

### Badge

**Descripción**: Badge inline con variantes de color y dot indicator opcional.

**Props**:
```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'blue' | 'green' | 'red' | 'yellow' | 'gray'
  size?: 'sm' | 'md'
  dot?: boolean
}
```

**Ejemplo**:
```typescript
<Badge variant="green" dot>Activo</Badge>
<Badge variant="red" size="sm">Error</Badge>
```

### Spinner

**Descripción**: Spinner de carga circular con variantes de tamaño, color y overlay.

**Props**:
```typescript
interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'white' | 'gray'
  overlay?: boolean
}
```

**Ejemplo**:
```typescript
<Spinner size="lg" color="blue" />
<Spinner overlay size="md" />
```

### Avatar

**Descripción**: Avatar que muestra iniciales o imagen, con indicador de estado opcional.

**Props**:
```typescript
interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
  status?: 'online' | 'offline' | 'away'
}
```

**Ejemplo**:
```typescript
<Avatar 
  name="Juan Pérez" 
  src={avatarUrl}
  size="md"
  status="online"
/>
```

### Ejemplo de Composición

Combinación de componentes en un caso real:

```typescript
<Card title="Lista de Usuarios">
  <Table 
    columns={[
      {
        key: 'user',
        header: 'Usuario',
        render: (_, item) => (
          <div className="flex items-center gap-3">
            <Avatar 
              name={item.name} 
              src={item.avatar}
              size="sm"
              status={item.status}
            />
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-gray-500">{item.email}</div>
            </div>
          </div>
        )
      },
      {
        key: 'status',
        header: 'Estado',
        render: (value) => (
          <Badge 
            variant={value === 'active' ? 'green' : 'red'}
            size="sm"
          >
            {value === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
        )
      },
      {
        key: 'actions',
        header: 'Acciones',
        render: (_, item) => (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => handleEdit(item)}
            >
              Editar
            </Button>
            <Button 
              size="sm" 
              variant="danger"
              onClick={() => setShowDeleteModal(item)}
            >
              Eliminar
            </Button>
          </div>
        )
      }
    ]}
    data={users}
    loading={isLoading}
  />
  
  <Modal 
    isOpen={showDeleteModal}
    onClose={() => setShowDeleteModal(null)}
    title="Confirmar eliminación"
    footer={
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => setShowDeleteModal(null)}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    }
  >
    <p>¿Eliminar usuario {selectedUser?.name}?</p>
  </Modal>
</Card>
```

## Sistema de Rutas y Autenticación

### PrivateRoute

**Ubicación**: `src/components/PrivateRoute.tsx`

Componente que protege rutas requiriendo autenticación.

### Flujo Completo de Autenticación

1. **Usuario no autenticado** → Intenta acceder a ruta protegida
2. **Redirect a /login** con `state.from` guardando ruta original
3. **Login exitoso** → Guardar tokens en localStorage
4. **Redirect a ruta original** usando `navigate(state.from)`
5. **Acceso concedido** → Renderizar componente protegido

### Agregar Nueva Ruta Protegida

```typescript
// En router/AppRouter.tsx
<Route path="/dashboard" element={
  <PrivateRoute>
    <DashboardPage />
  </PrivateRoute>
} />

<Route path="/settings" element={
  <PrivateRoute>
    <SettingsPage />
  </PrivateRoute>
} />
```

### Ejemplo de Implementación

```typescript
// En LoginPage.tsx
const location = useLocation();
const navigate = useNavigate();
const from = location.state?.from?.pathname || '/dashboard';

const handleLogin = async (credentials) => {
  try {
    await authService.login(credentials.email, credentials.password);
    navigate(from, { replace: true });
  } catch (error) {
    // Manejar error
  }
};
```

## Guía para Empezar un Proyecto Nuevo

### Pasos Ordenados

1. **Clonar el boilerplate**
   ```bash
   git clone <repo-url> mi-proyecto
   cd mi-proyecto
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   # Editar .env con valores del proyecto
   ```

4. **Cambios iniciales obligatorios**
   - Actualizar `package.json` con nombre y descripción del proyecto
   - Configurar `VITE_API_URL` en `.env`
   - Reemplazar logo y favicon en `public/`
   - Actualizar títulos y metadatos en `index.html`

5. **Personalizar componentes base**
   - Adaptar `Layout.tsx` al diseño del proyecto
   - Personalizar `Navbar.tsx` con navegación específica
   - Modificar `Sidebar.tsx` según necesidades

6. **Configurar rutas específicas**
   - Editar `router/AppRouter.tsx`
   - Crear páginas en `pages/`
   - Configurar `PrivateRoute` según permisos

7. **No tocar (arquitectura core)**
   - Sistema de caché (`cache/`)
   - Configuración de Axios (`api/axiosInstance.ts`)
   - Sistema de errores (`components/ErrorBoundary.tsx`)
   - Sistema de toasts (`services/toast.service.ts`)
   - Hooks core (`hooks/useFetch.ts`, `hooks/useErrorHandler.ts`)

### Variables de Entorno Necesarias

```env
# URL de la API backend
VITE_API_URL=http://localhost:4000

# Opcional: Configuración específica del proyecto
VITE_APP_NAME=Mi Aplicación
VITE_APP_VERSION=1.0.0
```

## Convenciones del Proyecto

### Convención de Keys de Caché

**SIEMPRE** usar `buildKey()` del key builder:

```typescript
// ✅ Correcto
buildKey(ENTITIES.PRODUCTS, 'list')
buildKey(ENTITIES.USER, 'profile')
buildKey(ENTITIES.ORDERS, orderId, 'details')

// ❌ Incorrecto
'products:list'
'user-profile'
`order-${orderId}-details`
```

### Convención de Nombres

- **Componentes**: PascalCase (`UserProfile.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useUserProfile.ts`)
- **Servicios**: camelCase (`userService.ts`)
- **Tipos**: PascalCase (`UserProfile.ts`)
- **Constantes**: UPPER_SNAKE_CASE (`API_ENDPOINTS.ts`)

### Cuándo Usar Servicio vs Hook

- **useFetch()**: Para data fetching en componentes React
- **cacheService**: Para operaciones directas de caché (invalidación, manual)
- **toastService**: Para notificaciones fuera de componentes
- **useToast()**: Para notificaciones desde componentes React

### Agregar Nueva Entidad al Key Builder

1. Agregar a `ENTITIES` en `cache/key.builder.ts`:
   ```typescript
   export const ENTITIES = {
     // ... entidades existentes
     INVOICES: 'invoices',
     CUSTOMERS: 'customers'
   } as const;
   ```

2. Usar en componentes:
   ```typescript
   buildKey(ENTITIES.INVOICES, 'list')
   buildKey(ENTITIES.CUSTOMERS, customerId, 'details')
   ```

---

## Soporte y Contribuciones

Este boilerplate está diseñado para ser evolutivo. Para sugerencias o problemas:

1. Revisar la documentación existente
2. Consultar ejemplos en los comentarios del código
3. Seguir las convenciones establecidas

**Desarrollado para**: Desarrolladores humanos y agentes de IA que necesiten un punto de partida robusto para aplicaciones frontend React.
