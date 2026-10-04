import { eq, and, sql } from "drizzle-orm";
import { AppDatabase, Money, generateUUIDv7 } from "@/modules/core/public-api";
import { CashSession, CashSessionStatus } from "../../domain/entities/cash-session.entity";
import {
  SaleOrder,
  SaleOrderItemProps,
  SalePaymentProps,
  PosPaymentMethod,
} from "../../domain/entities/sale-order.entity";
import { PosRepository } from "../../domain/repositories/pos.repository";
import {
  cashSessions,
  saleOrders,
  saleOrderItems,
  salePayments,
  CashSessionRow,
  SaleOrderRow,
  SaleOrderItemRow,
  SalePaymentRow,
} from "../database/schema/pos.schema";

export class DrizzlePosRepository implements PosRepository {
  constructor(private readonly db: AppDatabase) {}

  public async findOpenSessionByUser(userId: string): Promise<CashSession | null> {
    const rows = await this.db
      .select()
      .from(cashSessions)
      .where(and(eq(cashSessions.userId, userId), eq(cashSessions.status, "OPEN")))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toSessionDomain(row);
  }

  public async findOpenSessionByTerminal(terminalCode: string): Promise<CashSession | null> {
    const rows = await this.db
      .select()
      .from(cashSessions)
      .where(
        and(
          eq(cashSessions.terminalCode, terminalCode.toUpperCase()),
          eq(cashSessions.status, "OPEN")
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toSessionDomain(row);
  }

  public async findSessionById(id: string): Promise<CashSession | null> {
    const rows = await this.db
      .select()
      .from(cashSessions)
      .where(eq(cashSessions.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toSessionDomain(row);
  }

  public async saveSession(session: CashSession): Promise<void> {
    await this.db
      .insert(cashSessions)
      .values({
        id: session.getId(),
        userId: session.getUserId(),
        terminalCode: session.getTerminalCode(),
        establishmentCode: session.getEstablishmentCode(),
        emissionPointCode: session.getEmissionPointCode(),
        openingTime: session.getOpeningTime(),
        closingTime: session.getClosingTime(),
        initialFloatCents: session.getInitialFloat().toCents(),
        declaredCashCents: session.getDeclaredCash()?.toCents() ?? null,
        expectedCashCents: session.getExpectedCash()?.toCents() ?? null,
        discrepancyCents: session.getDiscrepancy()?.toCents() ?? null,
        status: session.getStatus(),
        closingNotes: session.getClosingNotes(),
      })
      .onConflictDoUpdate({
        target: cashSessions.id,
        set: {
          closingTime: session.getClosingTime(),
          declaredCashCents: session.getDeclaredCash()?.toCents() ?? null,
          expectedCashCents: session.getExpectedCash()?.toCents() ?? null,
          discrepancyCents: session.getDiscrepancy()?.toCents() ?? null,
          status: session.getStatus(),
          closingNotes: session.getClosingNotes(),
        },
      });
  }

  public async calculateSessionExpectedCash(sessionId: string): Promise<Money> {
    const session = await this.findSessionById(sessionId);
    const initialFloatCents = session ? session.getInitialFloat().toCents() : 0;

    // Sumar todos los pagos en efectivo de las ventas de esta sesión
    const cashPaymentsResult = await this.db
      .select({
        totalCash: sql<number>`coalesce(sum(${salePayments.amountCents}), 0)`,
      })
      .from(salePayments)
      .innerJoin(saleOrders, eq(salePayments.saleOrderId, saleOrders.id))
      .where(
        and(
          eq(saleOrders.cashSessionId, sessionId),
          eq(salePayments.paymentMethod, "CASH")
        )
      );

    const totalCashPaid = Number(cashPaymentsResult[0]?.totalCash ?? 0);

    // Restar el vuelto entregado a los clientes en esta sesión
    const totalChangeResult = await this.db
      .select({
        totalChange: sql<number>`coalesce(sum(${saleOrders.changeCents}), 0)`,
      })
      .from(saleOrders)
      .where(eq(saleOrders.cashSessionId, sessionId));

    const totalChangeReturned = Number(totalChangeResult[0]?.totalChange ?? 0);

    const netCashInDrawer = initialFloatCents + totalCashPaid - totalChangeReturned;
    return Money.fromCents(netCashInDrawer);
  }

  public async getNextSaleSequential(): Promise<string> {
    const year = new Date().getFullYear();
    const countResult = await this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(saleOrders);

    const nextNumber = Number(countResult[0]?.count ?? 0) + 1;
    return `VTA-${year}-${String(nextNumber).padStart(7, "0")}`;
  }

  public async saveSaleOrder(order: SaleOrder): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Guardar orden de venta
      await tx.insert(saleOrders).values({
        id: order.getId(),
        sequentialCode: order.getSequentialCode(),
        cashSessionId: order.getCashSessionId(),
        customerId: order.getCustomerId(),
        warehouseId: order.getWarehouseId(),
        subtotal0Cents: order.getSubtotal0().toCents(),
        subtotal15Cents: order.getSubtotal15().toCents(),
        discountCents: order.getDiscount().toCents(),
        ivaCents: order.getIva().toCents(),
        totalAmountCents: order.getTotalAmount().toCents(),
        changeCents: order.getChange().toCents(),
        createdAt: order.getCreatedAt(),
      });

      // 2. Guardar líneas de ítems
      const itemRows = order.getItems().map((item) => ({
        id: item.id || generateUUIDv7(),
        saleOrderId: order.getId(),
        productId: item.productId,
        presentationId: item.presentationId,
        quantity: item.quantity.toFixed(2),
        unitPriceCents: item.unitPrice.toCents(),
        discountCents: item.discount.toCents(),
        taxRate: item.taxRate,
        totalCents: item.total.toCents(),
      }));

      if (itemRows.length > 0) {
        await tx.insert(saleOrderItems).values(itemRows);
      }

      // 3. Guardar pagos
      const paymentRows = order.getPayments().map((p) => ({
        id: p.id || generateUUIDv7(),
        saleOrderId: order.getId(),
        paymentMethod: p.paymentMethod,
        amountCents: p.amount.toCents(),
        referenceCode: p.referenceCode,
        createdAt: order.getCreatedAt(),
      }));

      if (paymentRows.length > 0) {
        await tx.insert(salePayments).values(paymentRows);
      }
    });
  }

  public async findSaleOrderById(id: string): Promise<SaleOrder | null> {
    const orderRows = await this.db.select().from(saleOrders).where(eq(saleOrders.id, id)).limit(1);
    const orderRow = orderRows[0];
    if (!orderRow) return null;

    const itemRows = await this.db
      .select()
      .from(saleOrderItems)
      .where(eq(saleOrderItems.saleOrderId, id));

    const paymentRows = await this.db
      .select()
      .from(salePayments)
      .where(eq(salePayments.saleOrderId, id));

    return this.toSaleOrderDomain(orderRow, itemRows, paymentRows);
  }

  // --- Mapeadores de Dominio ---

  private toSessionDomain(row: CashSessionRow): CashSession {
    return CashSession.reconstitute({
      id: row.id,
      userId: row.userId,
      terminalCode: row.terminalCode,
      establishmentCode: row.establishmentCode,
      emissionPointCode: row.emissionPointCode,
      openingTime: row.openingTime,
      closingTime: row.closingTime,
      initialFloat: Money.fromCents(row.initialFloatCents),
      declaredCash: row.declaredCashCents !== null ? Money.fromCents(row.declaredCashCents) : null,
      expectedCash: row.expectedCashCents !== null ? Money.fromCents(row.expectedCashCents) : null,
      discrepancy: row.discrepancyCents !== null ? Money.fromCents(row.discrepancyCents) : null,
      status: row.status as CashSessionStatus,
      closingNotes: row.closingNotes,
    });
  }

  private toSaleOrderDomain(
    order: SaleOrderRow,
    items: SaleOrderItemRow[],
    payments: SalePaymentRow[]
  ): SaleOrder {
    const domainItems: SaleOrderItemProps[] = items.map((i) => ({
      id: i.id,
      productId: i.productId,
      presentationId: i.presentationId,
      quantity: parseFloat(i.quantity),
      unitPrice: Money.fromCents(i.unitPriceCents),
      discount: Money.fromCents(i.discountCents),
      taxRate: i.taxRate,
      total: Money.fromCents(i.totalCents),
    }));

    const domainPayments: SalePaymentProps[] = payments.map((p) => ({
      id: p.id,
      paymentMethod: p.paymentMethod as PosPaymentMethod,
      amount: Money.fromCents(p.amountCents),
      referenceCode: p.referenceCode,
    }));

    return SaleOrder.reconstitute({
      id: order.id,
      sequentialCode: order.sequentialCode,
      cashSessionId: order.cashSessionId,
      customerId: order.customerId,
      warehouseId: order.warehouseId,
      subtotal0: Money.fromCents(order.subtotal0Cents),
      subtotal15: Money.fromCents(order.subtotal15Cents),
      discount: Money.fromCents(order.discountCents),
      iva: Money.fromCents(order.ivaCents),
      totalAmount: Money.fromCents(order.totalAmountCents),
      change: Money.fromCents(order.changeCents),
      items: domainItems,
      payments: domainPayments,
      createdAt: order.createdAt,
    });
  }
}
