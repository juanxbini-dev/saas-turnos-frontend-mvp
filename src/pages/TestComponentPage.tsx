import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useToast } from '../hooks/useToast';
import { 
  Button, 
  Input, 
  Select, 
  Modal, 
  Table, 
  Card, 
  Badge, 
  Spinner, 
  Avatar 
} from '../components/ui';
import type { TableColumn } from '../components/ui';
import { 
  Search, 
  Save, 
  Trash2, 
  Edit, 
  Plus, 
  Calendar,
  Users,
  Package
} from 'lucide-react';

interface TestComponentProps {
  // Props para componentes de prueba
  [key: string]: any;
}

// Componente que lanza error intencionalmente
function BuggyComponent() {
  const [shouldThrow, setShouldThrow] = useState(false);
  
  console.log('🐛 BuggyComponent render - shouldThrow:', shouldThrow);
  
  if (shouldThrow) {
    console.log('🐛 BuggyComponent - Lanzando error ahora');
    throw new Error('Este es un error de render intencional para probar ErrorBoundary');
  }
  
  return (
    <div className="p-4 bg-green-100 border border-green-400 rounded">
      <p className="text-green-800">Componente funcionando correctamente</p>
      <button 
        onClick={() => {
          console.log('🐛 BuggyComponent - Botón clickeado, setShouldThrow(true)');
          setShouldThrow(true);
        }}
        className="mt-2 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
      >
        Lanzar Error de Render
      </button>
    </div>
  );
}

// Componente con error async
function AsyncErrorComponent() {
  const { throwError } = useErrorHandler();
  
  const handleAsyncError = () => {
    console.log('🔥 AsyncErrorComponent - Botón clickeado');
    // Simular error de red o async de forma síncrona
    // para que lo capture el ErrorBoundary inmediatamente
    try {
      console.log('🔥 AsyncErrorComponent - Lanzando error en try/catch');
      throw new Error('Error async simulado desde componente');
    } catch (error) {
      console.log('🔥 AsyncErrorComponent - Error capturado, llamando a throwError');
      throwError(error instanceof Error ? error : new Error('Error desconocido'));
    }
  };
  
  return (
    <div className="p-4 bg-blue-100 border border-blue-400 rounded">
      <p className="text-blue-800">Componente con manejo de errores async</p>
      <button 
        onClick={handleAsyncError}
        className="mt-2 bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
      >
        Lanzar Error Async
      </button>
    </div>
  );
}

// Componente para probar el sistema de toasts
function ToastTestComponent() {
  const toast = useToast();
  const [toastIds, setToastIds] = useState<string[]>([]);

  const addToastId = (id: string) => {
    setToastIds(prev => [...prev, id]);
  };

  const handleSuccess = () => {
    const id = toast.success('Operación completada exitosamente');
    addToastId(id);
  };

  const handleError = () => {
    const id = toast.error('Error de conexión con el servidor');
    addToastId(id);
  };

  const handleWarning = () => {
    const id = toast.warning('Los cambios no se han guardado');
    addToastId(id);
  };

  const handleInfo = () => {
    const id = toast.info('Actualizando datos...');
    addToastId(id);
  };

  const handlePersistentError = () => {
    const id = toast.error('Tu sesión expiró', { persistent: true });
    addToastId(id);
  };

  const handleDismissLast = () => {
    if (toastIds.length > 0) {
      const lastId = toastIds[toastIds.length - 1];
      toast.dismiss(lastId);
      setToastIds(prev => prev.slice(0, -1));
    }
  };

  const handleDismissAll = () => {
    toast.dismissAll();
    setToastIds([]);
  };

  return (
    <div className="p-4 bg-purple-100 border border-purple-400 rounded">
      <p className="text-purple-800 font-medium mb-3">🔔 Sistema de Toasts</p>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button 
          onClick={handleSuccess}
          className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
        >
          Success
        </button>
        <button 
          onClick={handleError}
          className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
        >
          Error
        </button>
        <button 
          onClick={handleWarning}
          className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
        >
          Warning
        </button>
        <button 
          onClick={handleInfo}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
        >
          Info
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={handlePersistentError}
          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
        >
          Error Persistente
        </button>
        <button 
          onClick={handleDismissLast}
          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
        >
          Cerrar Último
        </button>
      </div>
      
      <button 
        onClick={handleDismissAll}
        className="w-full mt-2 bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
      >
        Cerrar Todos
      </button>
      
      <div className="mt-3 text-xs text-purple-600">
        Toasts activos: {toastIds.length}
      </div>
    </div>
  );
}

// Datos de ejemplo para la tabla del Kit UI
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  avatar?: string;
}

const sampleUsers: User[] = [
  { id: '1', name: 'Juan Pérez', email: 'juan@ejemplo.com', role: 'Admin', status: 'active' },
  { id: '2', name: 'María García', email: 'maria@ejemplo.com', role: 'User', status: 'active' },
  { id: '3', name: 'Carlos López', email: 'carlos@ejemplo.com', role: 'Editor', status: 'inactive' },
  { id: '4', name: 'Ana Martínez', email: 'ana@ejemplo.com', role: 'User', status: 'active' },
];

const roleOptions = [
  { value: 'admin', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
  { value: 'user', label: 'Usuario' },
];

// Componente de demo del Kit UI
function KitUIDemo() {
  const toast = useToast();
  
  // Estados para los componentes
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  // Handlers
  const handleButtonClick = () => {
    toast.success('Botón clickeado exitosamente');
  };

  const handleLoadingClick = async () => {
    setButtonLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setButtonLoading(false);
    toast.info('Operación completada');
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setInputError(value.length < 3 ? 'Mínimo 3 caracteres' : '');
  };

  const handleTableRefresh = async () => {
    setTableLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTableLoading(false);
    toast.success('Datos actualizados');
  };

  const handleSpinnerDemo = () => {
    setShowSpinner(true);
    setTimeout(() => setShowSpinner(false), 3000);
  };

  // Columnas para la tabla
  const userColumns: TableColumn<User>[] = [
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Rol' },
    {
      key: 'status',
      header: 'Estado',
      render: (status: string) => (
        <Badge 
          variant={status === 'active' ? 'green' : 'red'}
          size="sm"
          dot
        >
          {status === 'active' ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    },
    {
      key: 'id',
      header: 'Acciones',
      render: (_: any, user: User) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost">
            <Edit size={16} />
          </Button>
          <Button size="sm" variant="danger">
            <Trash2 size={16} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header del Kit UI */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              🎨 Kit UI Components
            </h2>
            <p className="text-gray-600">
              Sistema de diseño unificado con componentes reutilizables
            </p>
          </div>
          <Badge variant="blue" size="md">
            v1.0.0
          </Badge>
        </div>
      </Card>

      {/* Grid de componentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Buttons Demo */}
        <Card title="🔘 Buttons" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleButtonClick}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button loading={buttonLoading} onClick={handleLoadingClick}>
              Loading
            </Button>
            <Button leftIcon={Save}>Save</Button>
            <Button rightIcon={Plus}>Add</Button>
            <Button block>Full Width</Button>
          </div>
        </Card>

        {/* Inputs Demo */}
        <Card title="📝 Inputs & Selects" className="space-y-4">
          <Input 
            label="Input básico"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Escribe algo..."
            error={inputError}
            help="Ejemplo de input con validación"
          />
          
          <Input 
            label="Con icono"
            prefix={Search}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Buscar..."
          />
          
          <Select 
            label="Rol de usuario"
            options={roleOptions}
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
          />
        </Card>

        {/* Badges Demo */}
        <Card title="🏷️ Badges" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="blue">Blue</Badge>
            <Badge variant="green">Green</Badge>
            <Badge variant="red">Red</Badge>
            <Badge variant="yellow">Yellow</Badge>
            <Badge variant="gray">Gray</Badge>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="blue" size="sm">Small</Badge>
            <Badge variant="green" size="md">Medium</Badge>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="green" dot>Online</Badge>
            <Badge variant="red" dot>Offline</Badge>
            <Badge variant="yellow" dot>Away</Badge>
          </div>
        </Card>

        {/* Avatars Demo */}
        <Card title="👤 Avatars" className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name="Juan Pérez" size="sm" status="online" />
            <Avatar name="María García" size="md" status="away" />
            <Avatar name="Carlos López" size="lg" status="offline" />
          </div>
          
          <div className="flex items-center gap-4">
            <Avatar 
              name="Ana Martínez" 
              src="https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face"
              status="online"
            />
            <div>
              <div className="font-medium">Ana Martínez</div>
              <div className="text-sm text-gray-500">ana@ejemplo.com</div>
            </div>
          </div>
        </Card>

        {/* Spinners Demo */}
        <Card title="⏳ Spinners" className="space-y-4">
          <div className="flex items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
          
          <div className="flex items-center gap-4">
            <Spinner color="blue" />
            <Spinner color="white" className="bg-gray-800 p-2 rounded" />
            <Spinner color="gray" />
          </div>
          
          <Button onClick={handleSpinnerDemo}>
            Mostrar Spinner Overlay
          </Button>
          
          {showSpinner && (
            <div className="relative h-32 bg-gray-100 rounded-lg">
              <Spinner overlay size="lg" />
            </div>
          )}
        </Card>

        {/* Modal Demo */}
        <Card title="🪟 Modal">
          <Button onClick={() => setModalOpen(true)}>
            Abrir Modal
          </Button>
          
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Ejemplo de Modal"
            size="md"
            footer={
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => {
                  setModalOpen(false);
                  toast.success('Acción confirmada');
                }}>
                  Confirmar
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <p>Este es un ejemplo de modal con el nuevo kit UI.</p>
              <Input label="Campo de ejemplo" placeholder="Escribe algo..." />
              <Select 
                label="Opción"
                options={roleOptions}
              />
            </div>
          </Modal>
        </Card>
      </div>

      {/* Table Demo - Full Width */}
      <Card 
        title="📊 Table"
        headerAction={
          <Button onClick={handleTableRefresh} loading={tableLoading}>
            <Calendar size={16} className="mr-2" />
            Actualizar
          </Button>
        }
      >
        <Table
          columns={userColumns}
          data={sampleUsers}
          loading={tableLoading}
          emptyMessage="No hay usuarios para mostrar"
          loadingRows={3}
        />
      </Card>

      {/* Complex Layout Demo */}
      <Card title="🎨 Layout Complejo">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card flat className="border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">1,234</div>
                <div className="text-sm text-gray-600">Usuarios totales</div>
              </div>
            </div>
          </Card>
          
          <Card flat className="border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package size={20} className="text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">567</div>
                <div className="text-sm text-gray-600">Productos</div>
              </div>
            </div>
          </Card>
          
          <Card flat className="border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar size={20} className="text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">$12,345</div>
                <div className="text-sm text-gray-600">Ingresos</div>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-800">Resumen del sistema</h3>
            <p className="text-sm text-gray-600">Todos los componentes funcionando correctamente</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="green" dot> Sistema OK </Badge>
            <Badge variant="blue">9 Componentes </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TestComponentPage() {
  const { state } = useAuth();
  const [testData, setTestData] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Test Components
            </h2>
            <p className="text-gray-600 mb-6">
              Área de pruebas para componentes UI y funcionalidades
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                🧪 Zona de Testing - Error Boundary
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-yellow-800">
                  Prueba el sistema de Error Boundary con los botones abajo
                </p>
                <p className="text-sm text-yellow-800">
                  Usuario actual: {state.authUser?.email || 'No autenticado'}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4 mb-6">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Test Button 1
              </button>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Test Button 2
              </button>
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Test Button 3
              </button>
            </div>
          </div>

          {/* Kit UI Demo Section */}
          <KitUIDemo />

          {/* Test Areas Originales */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              🛡️ Testing Original
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Error Boundary Test Area 1 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                🛡️ Error Boundary - Render
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[200px]">
                <ErrorBoundary>
                  <BuggyComponent />
                </ErrorBoundary>
              </div>
            </div>

            {/* Error Boundary Test Area 2 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                🛡️ Error Boundary - Async
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[200px]">
                <ErrorBoundary>
                  <AsyncErrorComponent />
                </ErrorBoundary>
              </div>
            </div>

            {/* Form Test Area */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Form Test Area
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="mb-2">📝 Área de prueba para formularios</p>
                  <p className="text-sm">Inserta aquí tu formulario para testing</p>
                </div>
              </div>
            </div>

            {/* Toast Test Area */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                🔔 Toast Service
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[200px]">
                <ToastTestComponent />
              </div>
            </div>
            </div>
          </div>

          {/* Debug Information */}
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Debug Information
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700 overflow-x-auto">
{`Auth Status: ${state.status}
User Email: ${state.authUser?.email || 'N/A'}
User Tenant: ${state.authUser?.tenant || 'N/A'}
Test Data: ${JSON.stringify(testData, null, 2)}`}
              </pre>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default TestComponentPage;
