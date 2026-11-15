import { api } from './client';
import type { InventoryItem } from '../types';
import { deleteWithUnlink } from './deletion';
import type { RemoveOptions } from '../utils/deletionConflict';

export interface InventoryItemPayload {
  name: string;
  sku?: string;
  description?: string;
  minQuantity?: number;
  unit?: string;
  costPrice?: number;
  expiryNotifyDaysBefore?: number | null;
}

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface MovementPayload {
  type: MovementType;
  quantity: number;
  reason?: string;
  /** Obrigatório para entradas (IN) — validade do lote */
  expiresAt?: string;
  /** Valor total da compra — obrigatório em entradas; gera despesa no financeiro */
  totalPrice?: number;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
  expiresAt?: string;
  createdAt: string;
}

export type InventoryItemWithMovements = InventoryItem & {
  movements: InventoryMovement[];
};

export interface BulkPurchaseLinePayload {
  itemId?: string;
  newItem?: InventoryItemPayload;
  quantity: number;
  /** Valor do produto sem frete */
  productTotal: number;
  expiresAt: string;
}

export interface BulkPurchasePayload {
  reason?: string;
  freight?: number;
  lines: BulkPurchaseLinePayload[];
}

export interface BulkPurchaseResult {
  linesProcessed: number;
  productsTotal: number;
  freight: number;
  grandTotal: number;
  items: {
    itemId: string;
    name: string;
    quantity: number;
    productTotal: number;
    freightShare: number;
    totalPrice: number;
    unitCost: number;
  }[];
}

export const inventoryApi = {
  list: async (): Promise<InventoryItem[]> => {
    const { data } = await api.get<InventoryItem[]>('/inventory');
    return data;
  },
  listLowStock: async (): Promise<InventoryItem[]> => {
    const { data } = await api.get<InventoryItem[]>('/inventory/low-stock');
    return data;
  },
  findOne: async (id: string): Promise<InventoryItemWithMovements> => {
    const { data } = await api.get<InventoryItemWithMovements>(`/inventory/${id}`);
    return data;
  },
  create: async (payload: InventoryItemPayload): Promise<InventoryItem> => {
    const { data } = await api.post<InventoryItem>('/inventory', payload);
    return data;
  },
  update: async (id: string, payload: InventoryItemPayload): Promise<InventoryItem> => {
    const { data } = await api.patch<InventoryItem>(`/inventory/${id}`, payload);
    return data;
  },
  remove: async (id: string, options?: RemoveOptions): Promise<void> => {
    await deleteWithUnlink(`/inventory/${id}`, options);
  },
  createMovement: async (id: string, payload: MovementPayload) => {
    const { data } = await api.post(`/inventory/${id}/movements`, payload);
    return data;
  },
  createBulkPurchase: async (payload: BulkPurchasePayload): Promise<BulkPurchaseResult> => {
    const { data } = await api.post<BulkPurchaseResult>('/inventory/bulk-purchase', payload);
    return data;
  },
};
