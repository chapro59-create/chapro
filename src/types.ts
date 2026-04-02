export type Tonnage = '0.5t' | '1t' | '1.4t' | '2.5t' | '3.5t' | '5t' | '11t' | '18t' | '25t' | 'other';
export type VehicleBody = 'none' | 'cargo' | 'wing' | 'top' | 'lift';

export interface QuoteRequest {
  contact: string;
  date: string;
  time: string;
  origin: string;
  destination: string;
  cargoDetails: string;
  tonnage: Tonnage;
  vehicleBody: VehicleBody;
}

export const TONNAGES = [
  { id: '0.5t', name: '0.5톤', baseFare: 35000 },
  { id: '1t', name: '1톤', baseFare: 40000 },
  { id: '1.4t', name: '1.4톤', baseFare: 50000 },
  { id: '2.5t', name: '2.5톤', baseFare: 70000 },
  { id: '3.5t', name: '3.5톤', baseFare: 80000 },
  { id: '5t', name: '5톤', baseFare: 110000 },
  { id: '11t', name: '11톤', baseFare: 180000 },
  { id: '18t', name: '18톤', baseFare: 250000 },
  { id: '25t', name: '25톤', baseFare: 320000 },
  { id: 'other', name: '기타', baseFare: 100000 },
] as const;

export const VEHICLE_BODIES = [
  { id: 'none', name: '차종무관' },
  { id: 'cargo', name: '카고' },
  { id: 'wing', name: '윙바디' },
  { id: 'top', name: '탑' },
  { id: 'lift', name: '리프트' },
] as const;

export function calculateFare(distance: number, tonnage: Tonnage, body: VehicleBody): number {
  const vehicle = TONNAGES.find(t => t.id === tonnage) || TONNAGES[1];
  const base = vehicle.baseFare;
  
  let fare = 0;
  // Standard market-rate logic (approximate)
  if (distance <= 10) {
    fare = base;
  } else if (distance <= 50) {
    fare = base + (distance - 10) * 1000;
  } else if (distance <= 100) {
    fare = base + 40000 + (distance - 50) * 800;
  } else if (distance <= 200) {
    fare = base + 80000 + (distance - 100) * 600;
  } else {
    fare = base + 140000 + (distance - 200) * 500;
  }

  // Body multipliers (reduced for competitiveness)
  if (body === 'wing') fare *= 1.1;
  if (body === 'top') fare *= 1.05;
  if (body === 'lift') fare += 15000;

  return Math.round(fare / 1000) * 1000;
}
