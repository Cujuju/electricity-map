import type { Dataset, Observation, Sector } from '../types';
export interface MonthlyObservation extends Observation {
  customers: number | null;
}
export interface MonthlyDataset extends Dataset {
  rows: MonthlyObservation[];
}
export interface UtilityObservation {
  year: number;
  id: string;
  name: string;
  state: string;
  sector: Sector;
  service: string;
  ownership: string;
  price: number | null;
  sales: number | null;
  revenue: number | null;
  customers: number | null;
  imputed: boolean;
}
export interface UtilityDataset {
  schemaVersion: number;
  fetchedAt: string;
  years: number[];
  source: {
    url: string;
    name: string;
    coverage: string;
    archives: { year: number; url: string }[];
  };
  territories: Record<string, string[]>;
  records: UtilityObservation[];
}
export type AnalysisMode = 'changes' | 'utilities';
export type Metric =
  | 'change'
  | 'delta'
  | 'price'
  | 'cost'
  | 'costChange'
  | 'usage'
  | 'spending'
  | 'salesChange'
  | 'gap';
