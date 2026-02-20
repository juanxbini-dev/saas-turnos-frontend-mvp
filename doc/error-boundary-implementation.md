# Implementación de Error Boundary

## 📋 Overview

Sistema completo de manejo de errores para aplicaciones React con TypeScript que captura errores de render y errores asíncronos, mostrando pantallas de error profesionales sin romper toda la aplicación.

## 🏗️ Arquitectura

### Componentes Principales

```
src/components/
├── ErrorBoundary.tsx     - Componente clase principal con componentDidCatch
└── ErrorFallback.tsx     - Pantalla de error genérica reutilizable

src/hooks/
└── useErrorHandler.ts   - Hook para escalar errores async al boundary
```

### Flujo de Arquitectura

```
Componente
   ↓ useErrorHandler() [para errores async]
   ↓ ErrorBoundary [componentDidCatch + getDerivedStateFromError]
   ↓ ErrorFallback [UI profesional]
   ↓ Recuperación con window.location.reload()
```

## 🗂️ Estructura de Archivos

### 1. Error Boundary Principal (`src/components/ErrorBoundary.tsx`)

Componente clase que implementa el ciclo de vida de error boundaries de React:

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void
  render(): ReactNode
}
```

#### Métodos Clave

- **`getDerivedStateFromError`**: Captura errores síncronos de render
- **`componentDidCatch`**: Registra errores y llama callback externo
- **`render`**: Muestra UI de error o children según estado

### 2. Pantalla de Error (`src/components/ErrorFallback.tsx`)

Componente reutilizable para mostrar errores de forma profesional:

```typescript
interface ErrorFallbackProps {
  onRetry?: () => void;
  title?: string;
  message?: string;
}
```

Características:
- ✅ Diseño limpio con Tailwind CSS
- ✅ Sin tecnicismos ni stack traces
- ✅ Personalizable (title, message, onRetry)
- ✅ Botón de reintentar funcional

### 3. Hook de Manejo de Errores (`src/hooks/useErrorHandler.ts`)

Hook para escalar errores asíncronos al ErrorBoundary:

```typescript
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);
  
  const throwError = useCallback((error: Error) => {
    setError(error);
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Lanza error al ErrorBoundary si existe
  if (error) {
    throw error;
  }

  return { throwError, resetError };
}
```

## 🔄 Flujo de Ejecución

### 1. Error de Render (Síncrono)

```
🎯 Componente lanza error
   ↓
🛡️ getDerivedStateFromError captura
   ↓
📦 Estado actualizado: { hasError: true, error }
   ↓
🎨 render() muestra ErrorFallback
   ↓
📱 UI profesional con botón reintentar
```

### 2. Error Asíncrono (Network, useEffect)

```
🎯 Error en try/catch o fetch
   ↓
🔥 useErrorHandler.throwError()
   ↓
📦 setError(error) en hook
   ↓
⚡ throw error al siguiente render
   ↓
🛡️ getDerivedStateFromError captura
   ↓
🎨 render() muestra ErrorFallback
```

### 3. Recuperación

```
🖱️ Click en "Reintentar"
   ↓
🔄 window.location.reload()
   ↓
🧹 Estado reiniciado completamente
   ↓
✅ Aplicación funcionando normalmente
```

## 🎯 Tipos de Errores Manejados

### 1. Errores de Render (Síncronos)

Errores que ocurren durante el renderizado de componentes:

```typescript
// Error de render
if (shouldThrow) {
  throw new Error('Error de render intencional');
}
```

**Captura automática por ErrorBoundary.**

### 2. Errores Asíncronos

Errores en operaciones asíncronas que React no captura automáticamente:

```typescript
// En useEffect
useEffect(() => {
  const fetchData = async () => {
    try {
      const data = await axiosInstance.get('/api/data');
    } catch (error) {
      throwError(error); // Escala al ErrorBoundary
    }
  };
  fetchData();
}, [throwError]);

// En manejadores de eventos
const handleClick = async () => {
  try {
    await apiCall();
  } catch (error) {
    throwError(error); // Escala al ErrorBoundary
  }
};
```

**Requiere useErrorHandler para escalar al boundary.**

### 3. Errores de Red/Fetch

Errores en peticiones HTTP:

```typescript
// Con useFetch
const { throwError } = useErrorHandler();
const { data, error } = useFetch(key, fetcher, options);

// Opción A: Manejo local
if (error) return <ErrorComponent error={error} />;

// Opción B: Escalar al boundary
if (error) throwError(error);
```

## 🛡️ Estrategias de Implementación

### 1. Envolver la Aplicación Principal

```typescript
// En App.tsx o main.tsx
<ErrorBoundary
  onError={(error, info) => {
    // Futuro: enviar a Sentry o servicio de logging
    console.error('Error global:', error, info);
  }}
>
  <App />
</ErrorBoundary>
```

**Ventajas:**
- ✅ Captura errores no manejados en toda la app
- ✅ Evita que la app se rompa completamente
- ✅ Experiencia de usuario controlada

### 2. Aislar Módulos Específicos

```typescript
// Para módulos críticos o independientes
<ErrorBoundary 
  fallback={
    <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
      <p>No se pudieron cargar los productos.</p>
    </div>
  }
>
  <ProductCatalog />
</ErrorBoundary>
```

**Ventajas:**
- ✅ El error no afecta a otras partes de la UI
- ✅ Mensajes de error contextualizados
- ✅ Recuperación granular

### 3. Combinación de Estrategias

```typescript
// ErrorBoundary global para la app
<ErrorBoundary>
  <Layout>
    <Header />
    <main>
      <ErrorBoundary fallback={<DashboardError />}>
        <Dashboard />
      </ErrorBoundary>
      
      <ErrorBoundary fallback={<ReportsError />}>
        <Reports />
      </ErrorBoundary>
    </main>
    <Footer />
  </Layout>
</ErrorBoundary>
```

## 🎨 Personalización de la UI de Error

### 1. Fallback Personalizado

```typescript
<ErrorBoundary 
  fallback={
    <div className="text-center p-8">
      <h2 className="text-xl font-bold text-red-600">
        Error en el módulo de productos
      </h2>
      <p className="text-gray-600 mt-2">
        No se pudieron cargar los productos en este momento.
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Reintentar
      </button>
    </div>
  }
>
  <ProductList />
</ErrorBoundary>
```

### 2. Componente de Error Reutilizable

```typescript
// CustomErrorComponent.tsx
const CustomError = ({ title, message, onRetry }) => (
  <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
    <h3 className="text-lg font-semibold text-red-800">{title}</h3>
    <p className="text-red-600 mt-1">{message}</p>
    {onRetry && (
      <button 
        onClick={onRetry}
        className="mt-3 bg-red-600 text-white px-4 py-2 rounded text-sm"
      >
        Reintentar
      </button>
    )}
  </div>
);

// Uso
<ErrorBoundary 
  fallback={<CustomError title="Error de API" message="Intenta más tarde" />}
>
  <ApiComponent />
</ErrorBoundary>
```

### 3. ErrorFallback Component

```typescript
// Usando el componente incluido
<ErrorFallback 
  title="Error de Conexión"
  message="No se pudo conectar al servidor"
  onRetry={() => window.location.reload()}
/>
```

## 🔧 Integración con useFetch

### Escenario 1: Manejo Local (Default)

```typescript
function ProductList() {
  const { data, loading, error } = useFetch(
    buildKey(ENTITIES.PRODUCTS),
    () => axiosInstance.get('/products').then(r => r.data.data),
    { ttl: TTL.LONG }
  );

  if (loading) return <Loading />;
  if (error) return <p>Error cargando productos: {error.message}</p>;
  
  return <ProductGrid products={data?.products} />;
}
```

### Escenario 2: Escalar al Boundary

```typescript
function ProductList() {
  const { throwError } = useErrorHandler();
  const { data, loading, error } = useFetch(
    buildKey(ENTITIES.PRODUCTS),
    () => axiosInstance.get('/products').then(r => r.data.data),
    { ttl: TTL.LONG }
  );

  if (loading) return <Loading />;
  
  // Escalar error al ErrorBoundary más cercano
  if (error) {
    throwError(error);
    return null; // No renderizar nada mientras se muestra el error
  }
  
  return <ProductGrid products={data?.products} />;
}
```

### Escenario 3: Manejo Híbrido

```typescript
function ProductList() {
  const { throwError } = useErrorHandler();
  const { data, loading, error } = useFetch(
    buildKey(ENTITIES.PRODUCTS),
    () => axiosInstance.get('/products').then(r => r.data.data),
    { ttl: TTL.LONG }
  );

  if (loading) return <Loading />;
  
  if (error) {
    // Errores de red: escalar al boundary
    if (error.name === 'NetworkError' || error.status >= 500) {
      throwError(error);
      return null;
    }
    
    // Errores de cliente: manejar localmente
    return <p>Error: {error.message}</p>;
  }
  
  return <ProductGrid products={data?.products} />;
}
```

## 📊 Logging y Monitoreo

### Callback onError

```typescript
<ErrorBoundary 
  onError={(error, errorInfo) => {
    // Enviar a servicio de logging (Sentry, LogRocket, etc.)
    loggingService.error({
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Logging local para desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.group('🛡️ Error Boundary');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }}
>
  <App />
</ErrorBoundary>
```

### Métricas de Error

```typescript
// Para implementar métricas
let errorCount = 0;
let errorsByComponent = {};

const errorBoundary = (
  <ErrorBoundary 
    onError={(error, info) => {
      errorCount++;
      
      const componentName = info.componentStack.split('\n')[1]?.trim() || 'Unknown';
      errorsByComponent[componentName] = (errorsByComponent[componentName] || 0) + 1;
      
      analytics.track('error_boundary_triggered', {
        errorType: error.name,
        component: componentName,
        totalErrors: errorCount
      });
    }}
  >
    <App />
  </ErrorBoundary>
);
```

## 🧪 Testing y Debugging

### Componente de Prueba

```typescript
function TestErrorBoundary() {
  const [shouldThrow, setShouldThrow] = useState(false);
  const { throwError } = useErrorHandler();

  const handleRenderError = () => {
    setShouldThrow(true);
  };

  const handleAsyncError = () => {
    try {
      throw new Error('Error async simulado');
    } catch (error) {
      throwError(error);
    }
  };

  return (
    <ErrorBoundary>
      {shouldThrow && <BuggyComponent />}
      
      <button onClick={handleRenderError}>
        Lanzar Error de Render
      </button>
      
      <button onClick={handleAsyncError}>
        Lanzar Error Async
      </button>
    </ErrorBoundary>
  );
}
```

### Logs de Depuración

El sistema incluye logs detallados para debugging:

```
🛡️ getDerivedStateFromError - Error recibido: Error message
🛡️ ErrorBoundary render - hasError: true
🛡️ ErrorBoundary - Mostrando pantalla de error
🔥 useErrorHandler - throwError llamado con: Error message
🔥 useErrorHandler - Lanzando error al ErrorBoundary
```

## 🚀 Mejores Prácticas

### 1. Estrategia de Boundaries

```typescript
✅ Buena práctica:
<ErrorBoundary>           // Global para toda la app
  <ErrorBoundary>         // Para módulos críticos
    <ErrorBoundary>       // Para componentes específicos
      <Component />
    </ErrorBoundary>
  </ErrorBoundary>
</ErrorBoundary>

❌ Evitar:
<ErrorBoundary>
  <ErrorBoundary>
    <ErrorBoundary>
      <ErrorBoundary>    // Demasiados niveles anidados
        <Component />
      </ErrorBoundary>
    </ErrorBoundary>
  </ErrorBoundary>
</ErrorBoundary>
```

### 2. Mensajes de Error

```typescript
✅ Buenos mensajes:
- "No se pudieron cargar los productos"
- "Error de conexión con el servidor"
- "La operación no pudo completarse"

❌ Malos mensajes:
- "Error: fetch failed"
- "TypeError: Cannot read property 'data' of undefined"
- Stack traces completos
```

### 3. Recuperación

```typescript
✅ Buena recuperación:
- Botón de reintentar claro
- Recarga completa del estado
- Opciones alternativas cuando sea posible

❌ Malas prácticas:
- No proporcionar forma de recuperación
- Recargar solo una parte del estado
- Dejar al usuario atascado
```

### 4. Logging

```typescript
✅ Buen logging:
- Información contextual (componente, usuario, acción)
- Datos sanitizados (sin información sensible)
- Estructura consistente para análisis

❌ Mal logging:
- Información personal (emails, tokens)
- Datos muy largos o irrelevantes
- Sin contexto o estructura
```

## 🎯 Resumen de Beneficios

### ✅ Características Principales

- **Captura automática** de errores de render
- **Escalado manual** de errores async con useErrorHandler
- **UI profesional** sin tecnicismos
- **Aislamiento** de errores por módulo
- **Recuperación** completa con recarga
- **Personalización** de fallbacks
- **Logging** estructurado para debugging
- **TypeScript** completo y seguro

### 📊 Impacto en Experiencia de Usuario

- **Sin pantallas en blanco**: Siempre hay UI de error
- **Mensajes comprensibles**: Usuario enti qué pasó
- **Opciones claras**: Botón reintentar visible
- **Aislamiento**: Un error no rompe toda la app
- **Recuperación rápida**: Un click para volver a funcionar

### 🏗️ Arquitectura Sostenible

- **Modular**: Cada componente tiene una responsabilidad
- **Reutilizable**: ErrorFallback en múltiples contextos
- **Escalable**: Fácil añadir logging externo
- **Mantenible**: Código organizado y documentado
- **Testeable**: Cada pieza se puede probar independientemente

---

**El sistema de Error Boundary proporciona una base sólida para manejo robusto de errores en aplicaciones React, garantizando una experiencia de usuario controlada incluso ante errores inesperados.**
