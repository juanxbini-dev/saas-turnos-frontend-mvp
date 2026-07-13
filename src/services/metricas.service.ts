import axiosInstance from '../api/axiosInstance';
import {
  MetricasResumen,
  MetricasEvolucionPunto,
  MetricasEquipoItem,
  MetricasAgrupacion,
  MetricasPeriodo,
} from '../types/metricas.types';

const buildParams = (periodo: MetricasPeriodo): URLSearchParams => {
  const params = new URLSearchParams();
  params.append('fecha_desde', periodo.fecha_desde);
  params.append('fecha_hasta', periodo.fecha_hasta);
  return params;
};

export const metricasService = {
  async getResumen(periodo: MetricasPeriodo): Promise<MetricasResumen> {
    const response = await axiosInstance.get(`/api/metricas/resumen?${buildParams(periodo).toString()}`);
    return response.data.data;
  },

  async getEvolucion(periodo: MetricasPeriodo, agrupar: MetricasAgrupacion): Promise<MetricasEvolucionPunto[]> {
    const params = buildParams(periodo);
    params.append('agrupar', agrupar);
    const response = await axiosInstance.get(`/api/metricas/evolucion?${params.toString()}`);
    return response.data.data;
  },

  async getEquipo(periodo: MetricasPeriodo): Promise<MetricasEquipoItem[]> {
    const response = await axiosInstance.get(`/api/metricas/equipo?${buildParams(periodo).toString()}`);
    return response.data.data;
  },
};
