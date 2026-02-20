# Sistema de Gestión de Usuarios - Frontend

## 📋 Overview

Sistema frontend completo para gestión de usuarios implementado en React + TypeScript con arquitectura de componentes modular, siguiendo las mejores prácticas de desarrollo moderno.

## 🏗️ Arquitectura de Componentes

### Pages (Páginas)
```
src/pages/
└── UsuariosPage.tsx              # Página principal de gestión
```

### Components (Componentes)
```
src/components/
├── AdminRoute.tsx                # Protección de rutas por rol
├── usuarios/
│   ├── CrearUsuarioForm.tsx      # Formulario de creación
│   ├── UsuariosTabla.tsx         # Tabla desktop
│   ├── UsuariosMobileList.tsx    # Lista mobile
│   ├── EditarUsuarioModal.tsx   # Modal de edición
│   └── CambiarRolModal.tsx       # Modal de cambio de rol
└── ui/
    └── Tabs.tsx                  # Componente reutilizable
```

### Services (Servicios)
```
src/
├── services/
│   └── usuario.service.ts        # Servicio API de usuarios
├── types/
│   └── usuario.types.ts          # Tipos TypeScript
└── cache/
    ├── key.builder.ts            # Claves de caché
    └── ttl.ts                    # Tiempos de caché
```

## 🔐 Seguridad y Autenticación

### Protección de Rutas
```typescript
// AdminRoute.tsx - Solo usuarios admin
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  
  if (!state.authUser?.roles.includes('admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};
```

### Sidebar Condicional
```typescript
// Sidebar.tsx - Ocultar usuarios para no-admin
{state.authUser?.roles.includes('admin') && (
  <NavLink to="/usuarios">
    <Users size={20} />
    <span>Usuarios</span>
  </NavLink>
)}
```

### Validaciones Frontend
- **Username**: Sin espacios, alfanumérico
- **Password**: Mínimo 8 caracteres
- **Email**: Formato válido
- **Roles**: Solo valores predefinidos

## 📊 Estado y Caché

### useFetch Hook
```typescript
// UsuariosPage.tsx - Caché inteligente
const {
  data: usuarios = [],
  loading,
  error,
  revalidate
} = useFetch<Usuario[]>(
  buildKey(ENTITIES.USUARIOS),
  async () => {
    const response = await axiosInstance.get('/api/usuarios');
    return response.data.data;
  },
  {
    ttl: TTL.SHORT,           // 1 minuto
    revalidateOnFocus: true   // Auto-refresco
  }
);
```

### Invalidación de Caché
```typescript
// Después de cualquier mutación
cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
revalidate(); // Refrescar datos
```

### Estrategia de Caché
- **Usuarios**: TTL.SHORT (1 min) - Datos operativos
- **Revalidación**: On window focus
- **Invalidación**: Manual después de CRUD

## 🎨 Componentes UI Detallados

### CrearUsuarioForm.tsx
```typescript
interface CrearUsuarioFormProps {
  onSuccess: () => void;
}

// Características:
- Validaciones en tiempo real
- Toast notifications
- Loading states
- Auto-reset al éxito
- Manejo de errores API
```

**Validaciones Implementadas:**
```typescript
// Username único y sin espacios
if (formData.username.includes(' ')) {
  toastError('El username no puede contener espacios');
  return;
}

// Password mínimo 8 caracteres
if (formData.password.length < 8) {
  toastError('La contraseña debe tener al menos 8 caracteres');
  return;
}

// Todos los campos requeridos
if (!formData.nombre.trim() || !formData.username.trim() || 
    !formData.email.trim() || !formData.password.trim()) {
  toastError('Todos los campos son requeridos');
  return;
}
```

### UsuariosTabla.tsx
```typescript
interface UsuariosTablaProps {
  usuarios: Usuario[];
  loading: boolean;
  onEdit: (usuario: Usuario) => void;
  onCambiarRol: (usuario: Usuario) => void;
  onToggleActivo: (usuario: Usuario) => void;
}
```

**Columnas Implementadas:**
- **Usuario**: Avatar + nombre + username
- **Rol**: Badges coloridos (admin=blue, staff=gray)
- **Estado**: Badge verde/rojo (activo/inactivo)
- **Último Login**: Fecha formateada
- **Acciones**: Editar, Cambiar Rol, Activar/Desactivar

### UsuariosMobileList.tsx
```typescript
// Diseño mobile-first con cards expandibles
- Responsive design
- Collapsible details
- Touch-friendly actions
- Swipe gestures (futuro)
```

### EditarUsuarioModal.tsx
```typescript
// Modal con tabs para diferentes acciones
<Tabs
  tabs={[
    { key: 'datos', label: 'Datos Personales' },
    { key: 'password', label: 'Contraseña' }
  ]}
>
  <TabPanel key="datos">
    {/* Formulario datos */}
  </TabPanel>
  <TabPanel key="password">
    {/* Formulario contraseña */}
  </TabPanel>
</Tabs>
```

### CambiarRolModal.tsx
```typescript
// Validaciones de negocio
if (selectedUsuario.id === currentUserId) {
  toastError('No puedes cambiar tu propio rol');
  return;
}
```

## 🔄 Estado Global

### AuthContext Integration
```typescript
// UsuariosPage.tsx
const { state } = useAuth();

// Tenant para username display
{formData.username && state.authUser?.tenant && (
  <p className="text-sm text-gray-400 mt-1">
    {formData.username}@{state.authUser.tenant}
  </p>
)}
```

### Estado Local del Componente
```typescript
const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
const [rolTarget, setRolTarget] = useState<Usuario | null>(null);
const [isEditModalOpen, setIsEditModalOpen] = useState(false);
const [isCrearModalOpen, setIsCrearModalOpen] = useState(false);
const [isRolModalOpen, setIsRolModalOpen] = useState(false);
```

## 📡 Servicio API

### usuario.service.ts
```typescript
export const usuarioService = {
  // CRUD completo
  getUsuarios: () => axiosInstance.get('/api/usuarios'),
  createUsuario: (data: CreateUsuarioData) => 
    axiosInstance.post('/api/usuarios', data),
  updateDatos: (id: string, data: UpdateDatosData) =>
    axiosInstance.put(`/api/usuarios/${id}/datos`, data),
  updatePassword: (id: string, data: UpdatePasswordData) =>
    axiosInstance.put(`/api/usuarios/${id}/password`, data),
  updateRol: (id: string, rol: string) =>
    axiosInstance.put(`/api/usuarios/${id}/rol`, { rol }),
  toggleActivo: (id: string) =>
    axiosInstance.put(`/api/usuarios/${id}/activo`)
};
```

### axiosInstance Integration
- **Headers automáticos**: Authorization Bearer
- **Refresh automático**: Token refresh
- **Error handling**: Estructura consistente
- **Interceptors**: Logging en desarrollo

## 🎯 Tipos TypeScript

### usuario.types.ts
```typescript
export type UsuarioRol = 'admin' | 'staff';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  username: string;
  empresa_id: string;
  roles: UsuarioRol[];
  activo: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUsuarioData {
  nombre: string;
  username: string;
  password: string;
  email: string;
  rol: UsuarioRol;
}

export interface UpdateDatosData {
  nombre: string;
  username: string;
}

export interface UpdatePasswordData {
  passwordActual: string;
  passwordNueva: string;
  passwordNuevaRepetir: string;
}
```

## 🎨 UI/UX Design System

### Componentes Reutilizables
```typescript
// Tabs.tsx - Navegación por tabs
interface TabsProps {
  tabs: Array<{ key: string; label: string }>;
  activeTab: string;
  onTabChange: (key: string) => void;
}

// Badge variants: 'blue' | 'green' | 'red' | 'yellow' | 'gray'
// Button variants: 'primary' | 'secondary' | 'ghost' | 'danger'
// Modal sizes: 'sm' | 'md' | 'lg' | 'xl'
```

### Responsive Design
```typescript
// Desktop: Tabla completa
<div className="hidden lg:block">
  <UsuariosTabla />
</div>

// Mobile: Cards expandibles  
<div className="lg:hidden">
  <UsuariosMobileList />
</div>
```

### Loading States
```typescript
// Skeleton loaders
{loading ? (
  <TableSkeleton columns={5} rows={10} />
) : (
  <UsuariosTabla usuarios={usuarios} />
)}
```

### Error Handling
```typescript
// Error boundaries y toast notifications
if (error) {
  return (
    <Alert variant="error">
      Error al cargar usuarios. <Button onClick={revalidate}>Reintentar</Button>
    </Alert>
  );
}
```

## 🔄 Manejo de Estados

### Estados de Carga
```typescript
const [loading, setLoading] = useState(false);

// En operaciones asíncronas
setLoading(true);
try {
  await usuarioService.createUsuario(data);
  toastSuccess('Usuario creado correctamente');
} catch (error) {
  toastError(error.response?.data?.message || 'Error al crear usuario');
} finally {
  setLoading(false);
}
```

### Estados de Error
```typescript
// Validación de errores de API
catch (error: any) {
  const message = error.response?.data?.message || error.message;
  toastError(message);
}
```

### Estados de Éxito
```typescript
// Callbacks de éxito
const onSuccess = () => {
  revalidate(); // Refrescar datos
  setIsCrearModalOpen(false); // Cerrar modal
  toastSuccess('Operación exitosa');
};
```

## 📱 Mobile Experience

### Touch-Friendly Design
- **Botones**: Mínimo 44px de altura
- **Espaciado**: Adeucado para dedos
- **Gestos**: Swipe para acciones (futuro)
- **Modales**: Full screen en mobile

### Responsive Breakpoints
```css
/* Tailwind breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

## 🚀 Performance

### Optimizaciones
- **Code Splitting**: Lazy loading de componentes
- **Memoization**: React.memo en componentes pesados
- **Debouncing**: En búsquedas y validaciones
- **Virtual Scrolling**: Para listas grandes (futuro)

### Bundle Size
- **Tree Shaking**: Solo componentes usados
- **Dynamic Imports**: Carga bajo demanda
- **Image Optimization**: Avatars optimizados
- **Font Optimization**: Icon fonts eficientes

## 🧪 Testing Strategy

### Unit Tests
```typescript
// CrearUsuarioForm.test.tsx
describe('CrearUsuarioForm', () => {
  it('should validate required fields', () => {
    // Test validaciones
  });
  
  it('should call onSuccess on submit', () => {
    // Test submit exitoso
  });
});
```

### Integration Tests
```typescript
// UsuariosPage.integration.test.tsx
describe('UsuariosPage Integration', () => {
  it('should load and display users', async () => {
    // Test carga de datos
  });
  
  it('should handle user creation', async () => {
    // Test flujo completo
  });
});
```

### E2E Tests
```typescript
// Cypress/Playwright tests
describe('User Management Flow', () => {
  it('should create, edit, and delete user', () => {
    // Test flujo completo de usuario
  });
});
```

## 📈 Analytics y Monitoreo

### Event Tracking
```typescript
// Google Analytics / Mixpanel
analytics.track('user_created', {
  role: formData.rol,
  tenant: state.authUser?.tenant
});

analytics.track('user_role_changed', {
  userId: usuario.id,
  oldRole: oldRoles,
  newRole: newRoles
});
```

### Performance Monitoring
```typescript
// Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

## 🔮 Mejoras Futuras

### Roadmap de Features
- [ ] **Advanced Search**: Filtros múltiples y búsqueda en tiempo real
- [ ] **Bulk Operations**: Selección múltiple y acciones batch
- [ ] **User Permissions**: Sistema de permisos granular
- [ ] **Activity Log**: Historial de cambios por usuario
- [ ] **Export/Import**: CSV/Excel de usuarios
- [ ] **User Profiles**: Avatares y preferencias
- [ ] **Notifications**: Sistema de notificaciones
- [ ] **Offline Support**: PWA con cache offline

### Mejoras Técnicas
- [ ] **State Management**: Redux Toolkit para estado global
- [ ] **Real-time Updates**: WebSockets para cambios en tiempo real
- [ ] **Virtualization**: React Window para listas grandes
- [ ] **Error Boundaries**: Mejor manejo de errores
- [ ] **Accessibility**: WCAG 2.1 compliance
- [ ] **Internationalization**: i18n para múltiples idiomas

### Optimizaciones de Performance
- [ ] **Bundle Analysis**: Webpack Bundle Analyzer
- [ ] **Service Worker**: Caching estratégico
- [ ] **Image Optimization**: WebP y lazy loading
- [ ] **Code Splitting**: Por ruta y componente
- [ ] **Tree Shaking**: Eliminación de código muerto

## 🚀 Despliegue

### Build Commands
```bash
# Development
npm run dev

# Production build
npm run build

# Preview production
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
```

### Environment Variables
```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=Turnos Management
VITE_VERSION=2.0.0
```

### Docker Configuration
```dockerfile
# Multi-stage build
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
```

## 📚 Mejores Prácticas

### Code Organization
- **Feature-based**: Componentes por funcionalidad
- **Barrel exports**: Imports limpios
- **Consistent naming**: Convenciones claras
- **Type safety**: TypeScript estricto

### Git Workflow
- **Feature branches**: Por cada nueva funcionalidad
- **Conventional commits**: Formato estandarizado
- **Code reviews**: Revisión por pares
- **Automated testing**: CI/CD pipeline

### Documentation
- **JSDoc**: Documentación de funciones
- **README**: Guía de desarrollo
- **Changelog**: Historial de cambios
- **Architecture docs**: Decisiones de diseño
