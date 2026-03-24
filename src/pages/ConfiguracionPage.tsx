import { useState, useEffect } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  closestCenter
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Card, Tabs, Textarea, Spinner, Button } from '../components/ui';
import { ImageUploadCard } from '../components/configuracion/ImageUploadCard';
import { HorarioEditor } from '../components/configuracion/HorarioEditor';
import { SortableProfesionalCard } from '../components/configuracion/SortableProfesionalCard';
import { configuracionService } from '../services/configuracion.service';
import { LandingConfig, LandingProfesional, Horario } from '../types/landing.types';
import { useToast } from '../hooks/useToast';

const TABS = [
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'informacion', label: 'Informacion' },
  { id: 'profesionales', label: 'Profesionales' }
];

function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState('apariencia');
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [profesionales, setProfesionales] = useState<LandingProfesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Campos del form de apariencia e informacion
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [direccionMaps, setDireccionMaps] = useState('');
  const [horarios, setHorarios] = useState<Horario[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cfg, profs] = await Promise.all([
        configuracionService.getConfig(),
        configuracionService.getProfesionales()
      ]);
      setConfig(cfg);
      setTitulo(cfg.titulo || '');
      setDescripcion(cfg.descripcion || '');
      setDireccion(cfg.direccion || '');
      setDireccionMaps(cfg.direccion_maps || '');
      setHorarios(cfg.horarios || []);
      setProfesionales(profs);
    } catch {
      toast.error('Error al cargar la configuracion');
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarApariencia = async () => {
    setSaving(true);
    try {
      const updated = await configuracionService.updateConfig({ titulo, descripcion });
      setConfig(updated);
      toast.success('Apariencia guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarInformacion = async () => {
    setSaving(true);
    try {
      const updated = await configuracionService.updateConfig({ direccion, direccion_maps: direccionMaps, horarios });
      setConfig(updated);
      toast.success('Informacion guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    const updated = await configuracionService.uploadLogo(file);
    setConfig(updated);
  };

  const handleUploadFondo = async (file: File) => {
    const updated = await configuracionService.uploadFondo(file);
    setConfig(updated);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const visibles = profesionales.filter(p => p.visible);
    const oldIndex = visibles.findIndex(p => p.usuario_id === active.id);
    const newIndex = visibles.findIndex(p => p.usuario_id === over.id);
    const reordenados = arrayMove(visibles, oldIndex, newIndex);

    // Actualizar orden local
    const noVisibles = profesionales.filter(p => !p.visible);
    setProfesionales([...reordenados, ...noVisibles]);

    // Persistir orden en backend
    try {
      await configuracionService.updateOrden(
        reordenados.map((p, i) => ({ usuarioId: p.usuario_id, orden: i }))
      );
    } catch {
      toast.error('Error al guardar el orden');
      loadData();
    }
  };

  const handleUpdateProfesional = (usuarioId: string, updates: Partial<LandingProfesional>) => {
    setProfesionales(prev =>
      prev.map(p => p.usuario_id === usuarioId ? { ...p, ...updates } : p)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const visibles = profesionales.filter(p => p.visible);
  const noVisibles = profesionales.filter(p => !p.visible);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto p-4 sm:py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Configuracion de Landing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Personaliza como se vera tu pagina publica.
          </p>
        </div>

        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab: Apariencia */}
        {activeTab === 'apariencia' && (
          <div className="space-y-6">
            <Card>
              <div className="p-6 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <ImageUploadCard
                    label="Logo"
                    hint="Cuadrado. JPG, PNG o WebP. Max 5MB."
                    currentUrl={config?.logo_url}
                    aspectRatio="square"
                    onUpload={handleUploadLogo}
                  />
                  <ImageUploadCard
                    label="Imagen de fondo"
                    hint="Landscape. JPG, PNG o WebP. Max 5MB."
                    currentUrl={config?.fondo_url}
                    aspectRatio="landscape"
                    onUpload={handleUploadFondo}
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titulo</label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ej: Reserva tu turno online"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                    <Textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Ej: Selecciona un profesional y reserva en segundos"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleGuardarApariencia} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab: Informacion */}
        {activeTab === 'informacion' && (
          <div className="space-y-6">
            <Card>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Direccion (texto visible)</label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Ej: Av. Corrientes 1234, CABA"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Se muestra como texto en la landing page.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Direccion para Google Maps</label>
                  <input
                    type="text"
                    value={direccionMaps}
                    onChange={(e) => setDireccionMaps(e.target.value)}
                    placeholder="Ej: Av. Corrientes 1234, Buenos Aires, Argentina"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Se usa para mostrar el mapa. Cuanto mas completa, mas precisa la ubicacion.</p>
                </div>

                <HorarioEditor horarios={horarios} onChange={setHorarios} />

                <div className="flex justify-end">
                  <Button onClick={handleGuardarInformacion} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab: Profesionales */}
        {activeTab === 'profesionales' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Activa el ojo para mostrar un profesional en la landing. Arrastra para cambiar el orden de los visibles.
            </p>

            {profesionales.length === 0 && (
              <Card>
                <div className="p-8 text-center text-gray-500">
                  No hay profesionales activos en la empresa.
                </div>
              </Card>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibles.map(p => p.usuario_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {visibles.map(profesional => (
                    <SortableProfesionalCard
                      key={profesional.usuario_id}
                      profesional={profesional}
                      onUpdate={(updates) => handleUpdateProfesional(profesional.usuario_id, updates)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {noVisibles.length > 0 && (
              <div className="space-y-3">
                {visibles.length > 0 && (
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium pt-2">
                    No visibles en landing
                  </p>
                )}
                {noVisibles.map(profesional => (
                  <SortableProfesionalCard
                    key={profesional.usuario_id}
                    profesional={profesional}
                    onUpdate={(updates) => handleUpdateProfesional(profesional.usuario_id, updates)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default ConfiguracionPage;
