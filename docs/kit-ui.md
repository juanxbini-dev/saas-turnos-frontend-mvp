---
description: Documentación completa del Kit UI - Sistema de diseño unificado
---

# Kit UI - Sistema de Diseño Unificado

El Kit UI es un sistema de diseño completo y consistente para la aplicación Turnos 2.0. Proporciona componentes reutilizables que siguen los patrones visuales establecidos del proyecto.

## 🎨 Principios de Diseño

### Colores del Sistema
- **Fondo general:** `bg-gray-50`
- **Superficies y cards:** `bg-white rounded-lg shadow-lg`
- **Sidebar y navegación:** `bg-gray-800` con `text-gray-300` y activo `bg-blue-600 text-white`
- **Color primario:** `blue-600` con hover `blue-700`
- **Tipografía títulos:** `text-gray-800 font-bold`
- **Tipografía secundaria:** `text-gray-600`
- **Bordes sutiles:** `border border-gray-200`
- **Transiciones:** `transition-colors`

### Iconos
- **Librería:** Lucide React
- **Tamaño navegación:** `size={20}`
- **Tamaño inline:** `size={18}`

## 📦 Componentes del Kit

### 🔘 Button

Botón principal con múltiples variantes y estados.

**Variantes:**
- `primary` (default): Azul principal
- `secondary`: Gris claro
- `danger`: Rojo para acciones destructivas
- `ghost`: Sin fondo, hover gris

**Tamaños:**
- `sm`: Pequeño
- `md` (default): Mediano
- `lg`: Grande

**Props especiales:**
- `loading`: Muestra spinner y deshabilita
- `leftIcon`: Icono a la izquierda
- `rightIcon`: Icono a la derecha
- `block`: Ancho completo

```tsx
// Uso básico
<Button onClick={handleClick}>Guardar</Button>

// Con icono y carga
<Button loading={isLoading} leftIcon={SaveIcon}>
  Guardando...
</Button>

// Variantes
<Button variant="secondary" size="sm">Cancelar</Button>
<Button variant="danger" rightIcon={TrashIcon}>Eliminar</Button>
<Button block>Enviar formulario</Button>
```

### 📝 Input

Campo de texto con label, validación y soporte para prefix.

**Características:**
- Label opcional arriba
- Mensaje de error en rojo
- Mensaje de ayuda en gris
- Estados: focus con ring, error con borde rojo, disabled con opacidad
- Variante prefix para icono o texto

```tsx
// Básico con validación
<Input 
  label="Email"
  value={email}
  onChange={setEmail}
  error="El email es inválido"
  placeholder="email@ejemplo.com"
/>

// Con texto de ayuda
<Input 
  label="Contraseña"
  type="password"
  value={password}
  onChange={setPassword}
  help="Mínimo 8 caracteres"
/>

// Con prefix de texto
<Input 
  label="Teléfono"
  prefix="+54"
  value={phone}
  onChange={setPhone}
  placeholder="11 1234 5678"
/>

// Con icono prefix
<Input 
  label="Buscar"
  prefix={SearchIcon}
  value={search}
  onChange={setSearch}
  placeholder="Buscar productos..."
/>
```

### 📋 Select

Select con estilo consistente al Input y opciones dinámicas.

**Características:**
- Mismo estilo visual que Input
- Array de opciones `{ value, label }`
- Manejo de estados y errores igual que Input
- Soporte para prefix

```tsx
<Select 
  label="Categoría"
  options={[
    { value: 'electronics', label: 'Electrónica' },
    { value: 'clothing', label: 'Ropa' },
    { value: 'food', label: 'Alimentos' }
  ]}
  value={category}
  onChange={(e) => setCategory(e.target.value)}
  error="Debes seleccionar una categoría"
/>

// Con icono prefix
<Select 
  label="Moneda"
  prefix={DollarSignIcon}
  options={currencyOptions}
  value={currency}
  onChange={setCurrency}
/>
```

### 🪟 Modal

Modal con overlay oscuro y panel centrado con animaciones.

**Tamaños:**
- `sm`: Pequeño
- `md` (default): Mediano
- `lg`: Grande

**Características:**
- Cierra con click en overlay
- Cierra con tecla Escape
- Animación de entrada
- Header opcional con botón de cierre
- Footer opcional para acciones

```tsx
<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  title="Confirmar acción"
  size="md"
  footer={
    <div className="flex justify-end gap-3">
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={handleConfirm}>
        Confirmar
      </Button>
    </div>
  }
>
  <p>¿Estás seguro de que deseas realizar esta acción?</p>
</Modal>

// Sin título (solo overlay)
<Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
  <div className="text-center">
    <h3 className="text-lg font-medium">¡Éxito!</h3>
    <p>Operación completada</p>
  </div>
</Modal>
```

### 📊 Table

Tabla genérica con soporte para loading y estado vacío.

**Características:**
- Columnas configurables con render functions
- Header con estilo `bg-gray-50`
- Filas con hover `hover:bg-gray-50`
- Estado vacío personalizable
- Loading con skeleton animation
- Responsive con overflow horizontal

```tsx
interface User {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

const columns: TableColumn<User>[] = [
  { key: 'name', header: 'Nombre' },
  { key: 'email', header: 'Email' },
  { 
    key: 'status', 
    header: 'Estado',
    render: (status) => (
      <Badge 
        variant={status === 'active' ? 'green' : 'red'}
        size="sm"
      >
        {status === 'active' ? 'Activo' : 'Inactivo'}
      </Badge>
    )
  },
  {
    key: 'actions',
    header: 'Acciones',
    render: (_, item) => (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost">Editar</Button>
        <Button size="sm" variant="danger">Eliminar</Button>
      </div>
    )
  }
];

<Table 
  columns={columns}
  data={users}
  loading={isLoading}
  emptyMessage="No se encontraron usuarios"
  loadingRows={5}
/>
```

### 🃏 Card

Contenedor versátil con header opcional y variantes.

**Características:**
- Header con título, subtítulo y acción opcional
- Footer opcional con estilo `bg-gray-50`
- Variante `flat` sin shadow para anidar
- Totalmente personalizable con `className`

```tsx
// Básica
<Card>
  <p>Contenido de la card</p>
</Card>

// Con header y footer
<Card 
  title="Estadísticas"
  subtitle="Últimos 30 días"
  footer={
    <div className="flex justify-end gap-3">
      <Button variant="secondary">Cancelar</Button>
      <Button>Guardar</Button>
    </div>
  }
>
  <div className="space-y-4">
    <div className="flex justify-between">
      <span>Ventas:</span>
      <span className="font-semibold">$45,230</span>
    </div>
  </div>
</Card>

// Con acción en header
<Card 
  title="Usuarios"
  headerAction={
    <Button size="sm">Nuevo usuario</Button>
  }
>
  <p>Lista de usuarios del sistema</p>
</Card>

// Plana (anidada)
<Card flat className="border border-gray-200">
  <h4 className="font-medium">Subtítulo</h4>
  <p className="text-sm text-gray-600">Contenido anidado</p>
</Card>
```

### 🏷️ Badge

Etiquetas inline con variantes de color y dot indicator.

**Variantes de color:**
- `blue`: Azul para información
- `green`: Verde para éxito/activo
- `red`: Rojo para error/inactivo
- `yellow`: Amarillo para advertencia
- `gray`: Gris para neutro

**Tamaños:**
- `sm`: Pequeño
- `md` (default): Mediano

**Dot indicator:**
- Muestra un círculo de color antes del texto

```tsx
// Básicos
<Badge variant="blue">Nuevo</Badge>
<Badge variant="green">Activo</Badge>
<Badge variant="red">Error</Badge>
<Badge variant="yellow">Pendiente</Badge>
<Badge variant="gray">Inactivo</Badge>

// Con dot indicator
<Badge variant="green" dot>En línea</Badge>
<Badge variant="red" dot>Desconectado</Badge>
<Badge variant="yellow" dot>Ausente</Badge>

// Tamaños
<Badge variant="blue" size="sm">Mini</Badge>
<Badge variant="green" size="md" dot>Activo</Badge>

// Personalizado
<Badge 
  variant="blue" 
  className="uppercase tracking-wide"
>
  Premium
</Badge>
```

### ⏳ Spinner

Indicador de carga circular animado.

**Tamaños:**
- `sm`: Pequeño
- `md` (default): Mediano
- `lg`: Grande

**Colores:**
- `blue` (default): Azul principal
- `white`: Blanco para fondos oscuros
- `gray`: Gris neutro

**Overlay:**
- Centrado sobre contenedor con fondo semitransparente

```tsx
// Básicos
<Spinner size="sm" />
<Spinner size="md" />
<Spinner size="lg" />

// Colores
<Spinner color="blue" />
<Spinner color="white" className="bg-gray-800 p-2 rounded" />
<Spinner color="gray" />

// Overlay
<div className="relative h-64">
  <Spinner overlay size="lg" />
  <div className="opacity-50">Contenido de fondo...</div>
</div>

// En botones
<Button loading>
  <Spinner size="sm" color="white" className="mr-2" />
  Procesando...
</Button>
```

### 👤 Avatar

Avatar que muestra iniciales o imagen con indicador de estado.

**Tamaños:**
- `sm`: Pequeño (32px)
- `md` (default): Mediano (40px)
- `lg`: Grande (48px)

**Estados:**
- `online`: Verde
- `offline`: Gris
- `away`: Amarillo

**Características:**
- Genera iniciales automáticamente del nombre
- Muestra imagen si se proporciona `src`
- Fallback automático si la imagen falla
- Indicador de estado en esquina inferior derecha

```tsx
// Solo iniciales
<Avatar name="Juan Pérez" size="sm" />
<Avatar name="María García" size="md" status="online" />
<Avatar name="Carlos López" size="lg" status="offline" />

// Con imagen
<Avatar 
  name="Ana Martínez" 
  src="https://ejemplo.com/avatar.jpg"
  status="online"
/>

// En tabla
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
    }
  ]}
  data={users}
/>

// Personalizado
<Avatar 
  name="Usuario Especial"
  className="ring-2 ring-blue-500 ring-offset-2"
  status="online"
/>
```

## 🚀 Uso del Kit

### Importación

```tsx
// Import individual
import { Button, Input, Card } from '../components/ui';

// Import todo el kit
import * as UI from '../components/ui';
```

### Tipos TypeScript

```tsx
// Importar tipos para uso en componentes
import type { 
  ButtonProps, 
  InputProps, 
  TableProps, 
  TableColumn 
} from '../components/ui';
```

## 📋 Convenciones

### ForwardRef
Todos los componentes usan `React.forwardRef` para compatibilidad con formularios y refs.

### Props Extends
Los componentes extienden las props HTML estándar para máxima compatibilidad:

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  // ...props personalizadas
}
```

### className Personalizable
Todos los componentes aceptan `className` opcional para overrides específicos:

```tsx
<Card className="border-2 border-blue-500">
  <Button className="text-lg font-bold">
    Botón personalizado
  </Button>
</Card>
```

## 🧪 Testing y Demo

Para ver todos los componentes en acción, navega a `/test-component` donde encontrarás:

- Demo interactiva de cada componente
- Ejemplos de uso con datos reales
- Estados de loading y error
- Layouts complejos y combinaciones
- Debug information en tiempo real

## 🔄 Mantenimiento

### Agregar Nuevo Componente

1. Crear archivo en `src/components/ui/ComponentName.tsx`
2. Seguir estructura estándar:
   ```tsx
   import React, { forwardRef } from 'react';
   
   export interface ComponentProps extends React.HTMLAttributes<HTMLElement> {
     // props personalizadas
   }
   
   export const Component = forwardRef<HTMLElement, ComponentProps>(
     ({ className = '', ...props }, ref) => {
       return (
         <element ref={ref} className={classes} {...props}>
           {/* contenido */}
         </element>
       );
     }
   );
   
   Component.displayName = 'Component';
   ```
3. Agregar export en `src/components/ui/index.ts`
4. Agregar demo en `TestComponentPage.tsx`
5. Actualizar esta documentación

### Principios a Seguir

- **Consistencia visual** con el diseño existente
- **TypeScript strict** con interfaces explícitas
- **Accesibilidad** con props ARIA adecuadas
- **Performance** con React.memo si es necesario
- **Testing** con ejemplos en TestComponentPage

## 🎯 Mejores Prácticas

### Composición vs Herencia
Prefiere composición de componentes sobre herencia compleja:

```tsx
// ✅ Bueno
<Card>
  <div className="flex items-center gap-4">
    <Avatar name="User" status="online" />
    <div>
      <h3 className="font-semibold">Título</h3>
      <p className="text-sm text-gray-600">Descripción</p>
    </div>
  </div>
</Card>

// ❌ Evitar
<UserCard title="Título" description="Descripción" showAvatar />
```

### Estados Consistentes
Usa los mismos patrones de estado en todos los componentes:

```tsx
// ✅ Estados estándar
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// ✅ Manejo de errores
try {
  setLoading(true);
  await operation();
} catch (err) {
  setError(err.message);
} finally {
  setLoading(false);
}
```

### Responsive Design
Los componentes son responsive por defecto usando Tailwind:

```tsx
// ✅ Grid responsivo
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>Contenido</Card>
</div>

// ✅ Textos responsivos
<h1 className="text-lg md:text-xl lg:text-2xl">
  Título responsivo
</h1>
```

---

## 📚 Referencias

- **Documentación Tailwind CSS:** https://tailwindcss.com/docs
- **Documentación Lucide React:** https://lucide.dev/docs/react
- **React ForwardRef:** https://react.dev/reference/react/forwardRef
- **TypeScript React:** https://react-typescript-cheatsheet.netlify.app/

---

*Última actualización: v1.0.0 - Febrero 2026*
