import { CashSession } from "../entities/cash-session.entity";
import { SaleOrder } from "../entities/sale-order.entity";
import { Money } from "../../../core/domain/value-objects/money.vo";

export interface PosRepository {
  // --- Turnos de Caja ---
  findOpenSessionByUser(userId: string): Promise<CashSession | null>;
  findOpenSessionByTerminal(terminalCode: string): Promise<CashSession | null>;
  findSessionById(id: string): Promise<CashSession | null>;
  saveSession(session: CashSession): Promise<void>;

  /**
   * Calcula el efectivo total que debería haber en caja al momento del arqueo:
   * fondo inicial + ventas cobradas en CASH.
   */
  calculateSessionExpectedCash(sessionId: string): Promise<Money>;

  // --- Ventas ---
  getNextSaleSequential(): Promise<string>;
  saveSaleOrder(order: SaleOrder): Promise<void>;
  findSaleOrderById(id: string): Promise<SaleOrder | null>;
}
