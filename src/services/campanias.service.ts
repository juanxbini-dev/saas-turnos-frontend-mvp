import axiosInstance from '../api/axiosInstance';
import {
  CampaniaConfig,
  CampaniasConfigResponse,
  DryRunResponse,
  MetricasCampanias,
  ParametrosCampania,
  TipoCampania,
} from '../types/campania.types';

export const campaniasService = {
  async getConfig(): Promise<CampaniasConfigResponse> {
    const response = await axiosInstance.get('/api/campanias');
    return response.data.data;
  },

  async updateCampania(tipo: TipoCampania, habilitada: boolean, parametros: ParametrosCampania): Promise<CampaniaConfig> {
    const response = await axiosInstance.put(`/api/campanias/${tipo}`, { habilitada, parametros });
    return response.data.data;
  },

  async dryRun(tipo?: TipoCampania): Promise<DryRunResponse> {
    const query = tipo ? `?tipo=${tipo}` : '';
    const response = await axiosInstance.get(`/api/campanias/dry-run${query}`);
    return response.data.data;
  },

  async getMetricas(desde: string, hasta: string): Promise<MetricasCampanias> {
    const response = await axiosInstance.get(`/api/campanias/metricas?desde=${desde}&hasta=${hasta}`);
    return response.data.data;
  },
};
