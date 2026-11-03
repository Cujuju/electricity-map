export type Sector = 'RES' | 'COM' | 'IND' | 'ALL';
export type View = 'atlas' | 'orbit' | 'spiral';
export interface Observation {
  period: string;
  state: string;
  sector: Sector;
  price: number | null;
  sales: number | null;
  revenue: number | null;
}
export interface Dataset {
  schemaVersion: number;
  fetchedAt: string;
  source: {
    name: string;
    url: string;
    api: string;
    frequency: string;
    priceUnit: string;
    salesUnit: string;
    revenueUnit: string;
  };
  rows: Observation[];
}
export interface StateInfo {
  id: string;
  fips: string;
  name: string;
  region: 'West' | 'Midwest' | 'South' | 'Northeast';
}
export interface StateDatum extends StateInfo {
  observation?: Observation;
  previous?: Observation;
  change: number | null;
}
