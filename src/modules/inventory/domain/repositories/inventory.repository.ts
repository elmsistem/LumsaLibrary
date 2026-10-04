import { Warehouse } from "../entities/warehouse.entity";
import { InventoryMovement, InventoryMovementType } from "../entities/inventory-movement.entity";
import { InventoryBalance } from "../entities/inventory-balance.entity";

export interface KardexFilterParams {
  productId: string;
  warehouseId?: string;
  from?: Date;
  to?: Date;
  movementType?: InventoryMovementType;
  limit?: number;
  offset?: number;
}

export interface InventoryRepository {
  // --- Almacenes ---
  findWarehouseById(id: string): Promise<Warehouse | null>;
  findWarehouseByCode(code: string): Promise<Warehouse | null>;
  saveWarehouse(warehouse: Warehouse): Promise<void>;
  listWarehouses(): Promise<Warehouse[]>;

  // --- Balances de Stock ---
  getBalance(warehouseId: string, productId: string): Promise<InventoryBalance | null>;

  /**
   * Obtiene el balance bloqueando la fila mediante `SELECT ... FOR UPDATE` en PostgreSQL.
   * Si no existe el registro, debe asegurar el bloqueo de inserción para evitar condiciones de carrera.
   */
  getBalanceForUpdate(warehouseId: string, productId: string): Promise<InventoryBalance | null>;

  // --- Movimientos y Asientos de Kardex ---
  /**
   * Persiste atómicamente el movimiento inmutable en `inventory_movements` y actualiza
   * el snapshot en `inventory_balances` dentro de la misma transacción de base de datos.
   * PROHIBIDO actualizar `inventory_movements` (invariante de auditoría inmutable).
   */
  recordMovementAndUpdateBalance(
    movement: InventoryMovement,
    newBalance: InventoryBalance
  ): Promise<void>;

  // --- Consultas del Libro Mayor (Kardex) ---
  getKardexHistory(filters: KardexFilterParams): Promise<InventoryMovement[]>;
  countKardexHistory(filters: Omit<KardexFilterParams, "limit" | "offset">): Promise<number>;
}
