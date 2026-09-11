import { ReactNode, useId, useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { TipoCampania } from '../../types/campania.types';
import { INFO_CAMPANIAS, REGLAS_GENERALES } from './textosCampania';

function Desplegable({
  etiqueta,
  ariaLabel,
  children,
}: {
  etiqueta: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
      >
        <HelpCircle size={14} className="flex-shrink-0" />
        {etiqueta}
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!abierto} className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        {children}
      </div>
    </div>
  );
}

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{titulo}</p>
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Explica, para una campaña, cómo funciona y con qué criterio elige a quién le escribe. */
export function InfoCampania({ tipo, titulo }: { tipo: TipoCampania; titulo: string }) {
  const info = INFO_CAMPANIAS[tipo];

  return (
    <Desplegable etiqueta="Info de campaña" ariaLabel={`Info de campaña: ${titulo}`}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{info.comoFunciona}</p>
        <Lista titulo="A quién elige" items={info.comoElige} />
        <Lista titulo="Queda afuera" items={info.quedaAfuera} />
        {info.nota && <p className="text-xs text-gray-500">{info.nota}</p>}
      </div>
    </Desplegable>
  );
}

/** Filtros del motor que valen para todas las campañas por igual. */
export function InfoReglasGenerales() {
  return (
    <Desplegable
      etiqueta="Reglas que valen para todas las campañas"
      ariaLabel="Reglas que valen para todas las campañas"
    >
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
        {REGLAS_GENERALES.map((regla, i) => (
          <li key={i}>{regla}</li>
        ))}
      </ul>
    </Desplegable>
  );
}
