import { Wallet } from 'lucide-react';
import { EmptyState } from '../components/ui';

// F0: cáscara de la sección. El gate de contraseña llega en F1 y el contenido
// (gastos únicos, recurrentes, derivados y gráficos) en F2–F5.
// Diseño: backend/docs/gastos-superadmin.md
function GastosPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gastos</h1>
        <p className="text-gray-600 mt-2">Control de gastos de la peluquería mes a mes</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <EmptyState
          icon={Wallet}
          title="Sección en construcción"
          message="Acá van los gastos del mes: los que ya calcula el sistema, los recurrentes y los únicos, con sus métricas y gráficos comparativos."
        />
      </div>
    </div>
  );
}

export default GastosPage;
