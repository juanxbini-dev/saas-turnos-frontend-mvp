# Implementación de Toast Service

## 📋 Overview

Sistema completo de notificaciones toast para aplicaciones React con TypeScript. Implementado sin librerías externas, utilizando un patrón pub/sub para comunicación entre el servicio y los componentes, con animaciones fluidas basadas en Tailwind CSS.

## 🏗️ Arquitectura

### Componentes Principales

```
src/types/
├── toast.types.ts      - Tipos del sistema de toasts

src/services/
├── toast.service.ts    - Servicio singleton con pub/sub

src/components/
├── ToastContainer.tsx  - Contenedor principal con suscripción
└── ToastItem.tsx      - Componente individual de toast

src/hooks/
└── useToast.ts         - Hook wrapper del servicio
```

### Flujo de Arquitectura

```
Componente
   ↓ useToast() [hook wrapper]
   ↓ toastService [pub/sub singleton]
   ↓ ToastContainer [suscripción React]
   ↓ ToastItem [UI animada]
   ↓ Auto-dismiss o manual dismiss
```

## 🗂️ Estructura de Archivos

### 1. Tipos del Sistema (`src/types/toast.types.ts`)

Definiciones de tipos para el sistema de toasts:

```typescript
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  persistent?: boolean;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  options?: ToastOptions;
}

export interface ToastListener {
  (toasts: Toast[]): void;
}
```

#### Características de los Tipos:
- ✅ **ToastType**: Unión de los 4 tipos básicos
- ✅ **ToastOptions**: Configuración opcional (persistent)
- ✅ **Toast**: Estructura completa con id único
- ✅ **ToastListener**: Tipo para el patrón pub/sub

### 2. Servicio Singleton (`src/services/toast.service.ts`)

Clase singleton que maneja el estado global de toasts usando pub/sub:

```typescript
class ToastService {
  private toasts: Toast[] = [];
  private listeners: Set<ToastListener> = new Set();
  private timers: Map<string, number> = new Map();
  private static instance: ToastService;

  // Métodos principales
  subscribe(listener: ToastListener): () => void
  unsubscribe(listener: ToastListener): void
  success(message: string, options?: ToastOptions): string
  error(message: string, options?: ToastOptions): string
  warning(message: string, options?: ToastOptions): string
  info(message: string, options?: ToastOptions): string
  dismiss(id: string): void
  dismissAll(): void
}
```

#### Características del Servicio:
- ✅ **Singleton**: Una única instancia global
- ✅ **Pub/Sub**: Patrón de suscripción para React
- ✅ **Auto-dismiss**: Temporizadores automáticos
- ✅ **Límite**: Máximo 5 toasts simultáneos
- ✅ **Persistent**: Toasts que no desaparecen solos

#### Duraciones por Tipo:
```typescript
private getDefaultDuration(type: ToastType): number {
  switch (type) {
    case 'success':
    case 'info':
    case 'warning':
      return 4000;  // 4 segundos
    case 'error':
      return 6000;  // 6 segundos (más tiempo para leer)
    default:
      return 4000;
  }
}
```

### 3. Componente Individual (`src/components/ToastItem.tsx`)

Componente React que renderiza cada toast individual con animaciones:

```typescript
interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  // Estado para animación y barra de progreso
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);
  
  // Lógica de animación y auto-dismiss
  // ...
}
```

#### Características del Componente:
- ✅ **Animaciones**: Entrada/salida con Tailwind
- ✅ **Íconos**: SVG específicos por tipo
- ✅ **Colores**: Paleta coherente por tipo
- ✅ **Barra de progreso**: Visual feedback de tiempo
- ✅ **Botón X**: Cierre manual
- ✅ **Responsive**: Adaptable a diferentes tamaños

#### Paleta de Colores:
```typescript
const getColors = () => {
  switch (toast.type) {
    case 'success':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        icon: 'text-green-600',
        progress: 'bg-green-500'
      };
    case 'error':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: 'text-red-600',
        progress: 'bg-red-500'
      };
    // ... warning, info
  }
};
```

### 4. Contenedor Principal (`src/components/ToastContainer.tsx`)

Componente que se suscribe al servicio y renderiza la lista de toasts:

```typescript
const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toastService.subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};
```

#### Características del Contenedor:
- ✅ **Posición fija**: top-right con z-index alto
- ✅ **Suscripción automática**: useEffect con cleanup
- ✅ **Renderizado condicional**: Solo si hay toasts
- ✅ **Pointer events**: Configurados para UX correcta

### 5. Hook Wrapper (`src/hooks/useToast.ts`)

Hook que proporciona acceso fácil al servicio desde componentes React:

```typescript
export function useToast() {
  const success = useCallback((message: string, options?: ToastOptions) => {
    return toastService.success(message, options);
  }, []);

  const error = useCallback((message: string, options?: ToastOptions) => {
    return toastService.error(message, options);
  }, []);

  // ... warning, info, dismiss, dismissAll

  return { success, error, warning, info, dismiss, dismissAll };
}
```

#### Características del Hook:
- ✅ **useCallback**: Performance optimizada
- ✅ **Wrapper simple**: Interfaz directa al servicio
- ✅ **TypeScript**: Tipado completo
- ✅ **Consistente**: Misma API que el servicio

## 🔄 Flujo de Ejecución

### 1. Creación de Toast

```
🎯 Componente llama useToast()
   ↓
🔥 useToast.success('Mensaje')
   ↓
📡 toastService.success()
   ↓
🆔 Genera id único (crypto.randomUUID())
   ↓
📦 Crea objeto Toast con duración
   ↓
🔔 Notifica a suscriptores
   ↓
🎨 ToastContainer actualiza estado
   ↓
📱 ToastItem renderizado con animación
```

### 2. Auto-dismiss

```
⏰ toastService.scheduleDismiss()
   ↓
⏱️ setTimeout(duration)
   ↓
🗑️ toastService.dismiss(id)
   ↓
📦 Elimina toast de array
   ↓
🔔 Notifica a suscriptores
   ↓
🎨 ToastContainer actualiza estado
   ↓
📱 ToastItem anima salida
```

### 3. Dismiss Manual

```
🖱️ Usuario click en X
   ↓
🗑️ ToastItem.onDismiss()
   ↓
📡 toastService.dismiss(id)
   ↓
📦 Elimina toast y timer
   ↓
🔔 Notifica a suscriptores
   ↓
🎨 ToastContainer actualiza estado
   ↓
📱 ToastItem anima salida
```

## 🎨 Sistema de Animaciones

### Animaciones de Entrada/Salida

```typescript
// Entrada
<div className={`
  transform transition-all duration-300 ease-in-out
  ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
`}>

// Salida
const handleDismiss = () => {
  setIsVisible(false);
  setTimeout(() => onDismiss(toast.id), 300);
};
```

### Barra de Progreso

```typescript
useEffect(() => {
  if (toast.options?.persistent) return;

  const interval = 100; // Actualizar cada 100ms
  const decrement = (interval / toast.duration) * 100;

  const timer = setInterval(() => {
    setProgress(prev => {
      const newValue = prev - decrement;
      return newValue <= 0 ? 0 : newValue;
    });
  }, interval);

  return () => clearInterval(timer);
}, [toast.duration, toast.options?.persistent]);
```

## 🎯 Tipos de Toast y Uso

### 1. Success (Verde)

```typescript
toast.success('Operación completada exitosamente');
toast.success('Producto guardado correctamente');
toast.success('Cambios aplicados');
```

**Uso:** Acciones exitosas del usuario, confirmaciones positivas

### 2. Error (Rojo)

```typescript
toast.error('Error de conexión con el servidor');
toast.error('No se pudo guardar el archivo');
toast.error('Error al cargar datos');
```

**Uso:** Errores de red, validación, operaciones fallidas

### 3. Warning (Amarillo)

```typescript
toast.warning('Los cambios no se han guardado');
toast.warning('Sesión a punto de expirar');
toast.warning('Campos incompletos');
```

**Uso:** Advertencias, validaciones no críticas, estado intermedio

### 4. Info (Azul)

```typescript
toast.info('Actualizando datos...');
toast.info('Procesando solicitud');
toast.info('Nuevas características disponibles');
```

**Uso:** Información neutra, estado de progreso, notificaciones informativas

### 5. Persistent (Sin auto-dismiss)

```typescript
toast.error('Tu sesión expiró', { persistent: true });
toast.warning('Requiere acción manual', { persistent: true });
```

**Uso:** Errores críticos que requieren acción del usuario

## 🔧 Integración en la Aplicación

### 1. Configuración en App.tsx

```typescript
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';

function App() {
  return (
    <ErrorBoundary>
      <ToastContainer />
      <AppProvider>
        <AuthProvider>
          <Router>
            <div className="App">
              <AppRouter />
            </div>
          </Router>
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
```

**Posicionamiento estratégico:**
- ✅ **Dentro de ErrorBoundary**: Protegido contra errores
- ✅ **Fuera de Router**: No se recarga con navegación
- ✅ **Al nivel raíz**: Accesible globalmente

### 2. Uso en Componentes

```typescript
function ProductForm() {
  const toast = useToast();

  const handleSubmit = async (data) => {
    try {
      await api.saveProduct(data);
      toast.success('Producto guardado correctamente');
    } catch (error) {
      toast.error('Error al guardar producto');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Campos del formulario */}
      <button type="submit">Guardar</button>
    </form>
  );
}
```

### 3. Uso con useFetch

```typescript
function ProductList() {
  const toast = useToast();
  const { data, error, revalidate } = useFetch(
    buildKey(ENTITIES.PRODUCTS),
    fetcher,
    { ttl: TTL.LONG }
  );

  const handleDelete = async (productId) => {
    try {
      await api.deleteProduct(productId);
      toast.success('Producto eliminado');
      revalidate(); // Actualizar lista
    } catch (error) {
      toast.error('Error al eliminar producto');
    }
  };

  // Renderizado...
}
```

## 🌐 Integración con HTTP Client

### Uso Directo del Servicio

```typescript
// En axiosInstance.ts
import { toastService } from '../services/toast.service';

// Interceptor de errores
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Toast global para errores de red
    if (!error.response) {
      toastService.error('Error de conexión con el servidor');
    } else if (error.response?.status >= 500) {
      toastService.error('Error interno del servidor');
    } else if (error.response?.status === 401) {
      toastService.warning('Tu sesión expiró', { persistent: true });
    }
    
    return Promise.reject(error);
  }
);
```

### Ventajas del Servicio Directo:

- ✅ **Global**: Accesible fuera de componentes
- ✅ **Centralizado**: Lógica de toast en un lugar
- ✅ **Consistente**: Misma experiencia en toda la app
- ✅ **Independiente**: No requiere hook en servicios

## 📊 Gestión de Estado y Performance

### Patrón Pub/Sub

```typescript
class ToastService {
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]); // Estado inicial
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const toastsCopy = [...this.toasts];
    this.listeners.forEach(listener => listener(toastsCopy));
  }
}
```

**Beneficios:**
- ✅ **Desacoplado**: Servicio independiente de React
- ✅ **Eficiente**: Una notificación a todos los suscriptores
- ✅ **Flexible**: Múltiples componentes pueden suscribirse

### Gestión de Temporizadores

```typescript
private timers: Map<string, number> = new Map();

private scheduleDismiss(toast: Toast): void {
  if (toast.options?.persistent) return;

  const timer = setTimeout(() => {
    this.dismiss(toast.id);
  }, toast.duration);

  this.timers.set(toast.id, timer);
}

private clearTimer(id: string): void {
  const timer = this.timers.get(id);
  if (timer) {
    clearTimeout(timer);
    this.timers.delete(id);
  }
}
```

**Características:**
- ✅ **Limpieza automática**: Timers se eliminan al dismiss
- ✅ **Memoria eficiente**: Map para tracking de timers
- ✅ **Persistent support**: No timer para toasts persistentes

### Límite de Toasts Simultáneos

```typescript
private addToast(type: ToastType, message: string, options?: ToastOptions): string {
  // Mantener máximo 5 toasts visibles
  if (this.toasts.length >= 5) {
    const oldestToast = this.toasts[0];
    this.clearTimer(oldestToast.id);
    this.toasts.shift();
  }

  this.toasts.push(toast);
  // ...
}
```

**Comportamiento:**
- ✅ **FIFO**: El más viejo se elimina primero
- ✅ **Límite exacto**: Máximo 5 toasts visibles
- ✅ **Limpieza**: Timer del toast eliminado se limpia

## 🧪 Testing y Debugging

### Componente de Prueba

```typescript
function ToastTestComponent() {
  const toast = useToast();
  const [toastIds, setToastIds] = useState<string[]>([]);

  const handleSuccess = () => {
    const id = toast.success('Operación completada exitosamente');
    setToastIds(prev => [...prev, id]);
  };

  const handleError = () => {
    const id = toast.error('Error de conexión con el servidor');
    setToastIds(prev => [...prev, id]);
  };

  const handlePersistentError = () => {
    const id = toast.error('Tu sesión expiró', { persistent: true });
    setToastIds(prev => [...prev, id]);
  };

  return (
    <div>
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
      <button onClick={handlePersistentError}>Error Persistente</button>
      <div>Toasts activos: {toastIds.length}</div>
    </div>
  );
}
```

### Debugging Tips

```typescript
// En toast.service.ts
console.log('🔔 Toast creado:', { type, message, duration });

// En ToastItem.tsx
useEffect(() => {
  console.log('🔔 Toast renderizado:', toast.message);
}, [toast.message]);

// En ToastContainer.tsx
useEffect(() => {
  console.log('🔔 Toasts actualizados:', toasts.length);
}, [toasts]);
```

## 🚀 Mejores Prácticas

### 1. Mensajes Claros y Concisos

```typescript
✅ Buenos mensajes:
- 'Producto guardado correctamente'
- 'Error de conexión con el servidor'
- 'Los cambios no se han guardado'

❌ Malos mensajes:
- 'Success: Product saved successfully'
- 'Error: Network request failed'
- 'Warning: Changes not saved'
```

### 2. Duraciones Apropiadas

```typescript
✅ Duraciones correctas:
- Success/Info/Warning: 4000ms (4s)
- Error: 6000s (6s, más tiempo para leer)
- Persistent: Solo para errores críticos

❌ Prácticas incorrectas:
- Duraciones muy cortas (< 2s): Usuario no puede leer
- Duraciones muy largas (> 10s): Molesto
- Todos persistentes: Pierde el propósito del auto-dismiss
```

### 3. Uso Consistente

```typescript
✅ Buen patrón:
// Componentes usan hook
const toast = useToast();
toast.success('Mensaje');

// Servicios usan servicio directo
toastService.error('Error global');

❌ Mal patrón:
// Importar servicio en componentes
import { toastService } from '../services/toast.service';
toastService.success('Mensaje'); // No usar en componentes
```

### 4. Manejo de Errores

```typescript
✅ Buen manejo:
try {
  await apiCall();
  toast.success('Operación completada');
} catch (error) {
  console.error('API Error:', error);
  toast.error('Error en la operación');
}

❌ Mal manejo:
try {
  await apiCall();
} catch (error) {
  // Sin logging, sin feedback al usuario
}
```

## 📈 Métricas y Análisis

### Tracking de Uso

```typescript
class ToastService {
  private metrics = {
    totalCreated: 0,
    byType: { success: 0, error: 0, warning: 0, info: 0 },
    dismissedByUser: 0,
    dismissedByTimeout: 0
  };

  private addToast(type: ToastType, message: string, options?: ToastOptions): string {
    this.metrics.totalCreated++;
    this.metrics.byType[type]++;
    // ...
  }

  dismiss(id: string): void {
    this.metrics.dismissedByUser++;
    // ...
  }
}
```

### Performance Monitoring

```typescript
// En desarrollo
if (process.env.NODE_ENV === 'development') {
  console.log('🔔 Toast Metrics:', {
    active: this.toasts.length,
    total: this.metrics.totalCreated,
    byType: this.metrics.byType
  });
}
```

## 🎯 Resumen de Beneficios

### ✅ Características Principales

- **Sin dependencias externas**: Solo React, TypeScript y Tailwind
- **Patrón pub/sub**: Comunicación eficiente entre servicio y componentes
- **Animaciones fluidas**: Transiciones CSS de Tailwind
- **Tipos múltiples**: Success, error, warning, info con colores diferenciados
- **Auto-dismiss**: Configurable por tipo con duraciones apropiadas
- **Persistent option**: Toasts críticos que requieren acción manual
- **Límite automático**: Máximo 5 toasts simultáneos
- **Posición óptima**: Esquina superior derecha
- **z-index alto**: Siempre visible sobre otros elementos

### 📊 Impacto en Experiencia de Usuario

- **Feedback inmediato**: Notificaciones instantáneas
- **No intrusivo**: No interfiere con el contenido principal
- **Accesible**: Botón de cierre claro y visible
- **Informativo**: Barra de progreso muestra tiempo restante
- **Consistente**: Misma experiencia en toda la aplicación

### 🏗️ Arquitectura Sostenible

- **Modular**: Cada componente tiene una responsabilidad clara
- **Desacoplado**: Servicio independiente de React
- **Escalable**: Fácil añadir nuevos tipos o características
- **Mantenible**: Código organizado y documentado
- **Testeable**: Cada pieza se puede probar independientemente

---

**El sistema de Toast Service proporciona una base sólida para notificaciones de usuario efectivas y consistentes en aplicaciones React, sin dependencias externas y con una arquitectura limpia y mantenible.**
