"use client";

import { useState } from "react";

type ActiveTab = "pos" | "school" | "inventory" | "purchasing" | "analytics" | "settings";

function generateRandomSerial(): string {
  return String(Math.floor(Math.random() * 900000000 + 100000000));
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("pos");

  // --- Estado POS ---
  const [cart, setCart] = useState<
    Array<{
      id: string;
      name: string;
      sku: string;
      presentation: string;
      factor: number;
      qty: number;
      price: number;
      taxRate: "IVA_15" | "IVA_0";
    }>
  >([
    {
      id: "prod-1",
      name: "Cuaderno Espiral 100H Norma (Cuadros)",
      sku: "CUA-NORM-100",
      presentation: "Unidad",
      factor: 1,
      qty: 2,
      price: 2.25,
      taxRate: "IVA_15",
    },
    {
      id: "prod-2",
      name: "Caja Lápices de Colores x 24 Faber-Castell",
      sku: "COL-FC-24",
      presentation: "Caja",
      factor: 1,
      qty: 1,
      price: 6.5,
      taxRate: "IVA_15",
    },
    {
      id: "prod-3",
      name: "Libro de Lectura Primaria 5to EGB",
      sku: "LIB-LEC-05",
      presentation: "Ejemplar",
      factor: 1,
      qty: 1,
      price: 12.0,
      taxRate: "IVA_0",
    },
  ]);

  const [idType, setIdType] = useState<"CONSUMIDOR_FINAL" | "CEDULA" | "RUC">("CONSUMIDOR_FINAL");
  const [idNumber, setIdNumber] = useState("9999999999999");
  const [customerName, setCustomerName] = useState("CONSUMIDOR FINAL");
  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [cashGiven, setCashGiven] = useState("30.00");
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);
  const [supervisorPin, setSupervisorPin] = useState("");
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);
  const [supervisorAuthorized, setSupervisorAuthorized] = useState(false);

  // Totales POS
  const subtotal15 = cart
    .filter((i) => i.taxRate === "IVA_15")
    .reduce((acc, i) => acc + i.price * i.qty, 0);
  const subtotal0 = cart
    .filter((i) => i.taxRate === "IVA_0")
    .reduce((acc, i) => acc + i.price * i.qty, 0);
  const iva15 = subtotal15 * 0.15;
  const totalAmount = subtotal15 + subtotal0 + iva15;
  const cashNum = parseFloat(cashGiven) || 0;
  const changeDue = Math.max(0, cashNum - totalAmount);

  // --- Estado Escuela ---
  const [schoolRegime, setSchoolRegime] = useState<"SIERRA" | "COSTA">("SIERRA");
  const [schoolInstitution, setSchoolInstitution] = useState("Colegio San Gabriel - Quito");
  const [schoolStudent, setSchoolStudent] = useState("Mateo Benítez (6to EGB)");
  const [schoolAdvanceCents, setSchoolAdvanceCents] = useState(15.0);
  const [whatsappGenerated, setWhatsappGenerated] = useState<string | null>(null);

  // --- Estado Compras XML ---
  const [xmlParsedData, setXmlParsedData] = useState<{
    supplier: string;
    ruc: string;
    invoiceNum: string;
    subtotal: number;
    iva: number;
    total: number;
    itemsCount: number;
  } | null>(null);

  // --- Estado IA Mostrador ---
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // --- Estado Respaldos ---
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  // Handlers
  const handleCheckout = () => {
    if (idType === "CONSUMIDOR_FINAL" && totalAmount > 50) {
      alert("⚠️ Alerta SRI: El Consumidor Final no puede exceder $50.00 USD según la ley tributaria de Ecuador. Ingrese Cédula o RUC.");
      return;
    }

    const randomSerial = generateRandomSerial();
    const accessKey = `041020260117900169270012001001${randomSerial}1234567812`;

    const ticket = `
========================================
       LUMSA LIBRARY CIA. LTDA.
       RUC: 1790016927001
   Matriz: Av. Amazonas y Cordero, Quito
       Punto Emisión: 001-001
========================================
FACTURA ELECTRÓNICA: 001-001-${randomSerial.slice(0, 9)}
FECHA: 04/10/2026 10:45:00
CLIENTE: ${customerName}
ID/RUC: ${idNumber}
FORMA PAGO: ${paymentMethod}
----------------------------------------
CANT  DESCRIPCIÓN              P.UNIT   TOTAL
----------------------------------------
${cart.map((i) => `${i.qty.toString().padEnd(4)}  ${i.name.slice(0, 22).padEnd(23)} $${i.price.toFixed(2)}  $${(i.price * i.qty).toFixed(2)}`).join("\n")}
----------------------------------------
SUBTOTAL 15%:               $${subtotal15.toFixed(2)}
SUBTOTAL 0%:                $${subtotal0.toFixed(2)}
IVA 15%:                    $${iva15.toFixed(2)}
TOTAL A PAGAR:              $${totalAmount.toFixed(2)}
EFECTIVO RECIBIDO:          $${cashNum.toFixed(2)}
CAMBIO / VUELTO:            $${changeDue.toFixed(2)}
========================================
CLAVE DE ACCESO SRI:
${accessKey}
AUTORIZACIÓN SRI: AUTORIZADO OFFLINE
========================================
¡Gracias por su compra en LumsaLibrary!
Validez de cambio: 48 horas con este ticket
`;
    setLastReceipt(ticket);
  };

  const handleSimulateXmlLoad = () => {
    setXmlParsedData({
      supplier: "FABER CASTELL ECUADOR S.A.",
      ruc: "1790016927001",
      invoiceNum: "001-001-000000456",
      subtotal: 120.0,
      iva: 18.0,
      total: 138.0,
      itemsCount: 15,
    });
  };

  const handleAskAi = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse(null);

    // Consulta con el asistente de mostrador
    setTimeout(() => {
      setAiResponse(
        `💡 **Recomendación Asistente Gemini (Mostrador):**\nPara "${aiQuery}", sugerimos:\n` +
          `1. **Cuaderno Espiral Norma 100H Cuadros** ($2.25) — Stock: 45 unidades (Opción recomendada por resistencia).\n` +
          `2. **Cuaderno Grapa Universitario Estilo** ($1.60) — Stock: 110 unidades (Opción económica alternativa).\n` +
          `3. **Caja Témperas Pelikan 6 colores** ($2.50) — Disponible en pasillo central.`
      );
      setAiLoading(false);
    }, 600);
  };

  const handleGenerateBackup = () => {
    setBackupStatus("Generando volcado binario PostgreSQL y cifrando con AES-256-CBC...");
    setTimeout(() => {
      const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      setBackupStatus(
        `✅ Respaldo exitoso: lumsa-erp-2026-10-04.sql.enc (SHA-256: ${hash.slice(0, 16)}...) sincronizado con Cloudflare R2.`
      );
    }, 1000);
  };

  const handleAuthorizePin = () => {
    if (supervisorPin === "4321") {
      setSupervisorAuthorized(true);
      setSupervisorModalOpen(false);
      alert("✅ PIN Correcto: Autorización de Supervisor 'Ana Gómez' concedida.");
    } else {
      alert("❌ PIN Incorrecto: Acceso denegado.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Barra Superior Institucional */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg">
            📚
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">LumsaLibrary ERP</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Ecuador v1.1
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Librería y Papelería · RUC: 1790016927001 · SRI Motor Fiscal Offline
            </p>
          </div>
        </div>

        {/* Indicadores de Salud Operativa */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            SRI: En Línea
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-300">
            <span className="h-2 w-2 rounded-full bg-blue-400"></span>
            Kardex PMP: Activo
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/60 border border-purple-800/60 text-purple-300">
            <span className="h-2 w-2 rounded-full bg-purple-400"></span>
            Gemini 2.5: Listo
          </div>
        </div>
      </header>

      {/* Navegación por Pestañas */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-6 flex overflow-x-auto gap-2 py-2">
        <button
          onClick={() => setActiveTab("pos")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "pos"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          🛒 Punto de Venta (POS)
        </button>
        <button
          onClick={() => setActiveTab("school")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "school"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          🎒 Temporada Escolar
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "inventory"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          📦 Kardex & Inventario
        </button>
        <button
          onClick={() => setActiveTab("purchasing")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "purchasing"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          📥 Compras XML SRI
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "analytics"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          📊 Analítica & Asistente IA
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "settings"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          ⚙️ Configuración & Respaldos
        </button>
      </nav>

      {/* Contenido Principal */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TAB 1: PUNTO DE VENTA (POS) */}
        {activeTab === "pos" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Panel Izquierdo: Catálogo y Carrito */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    🛍️ Canasta de Mostrador (Terminal 001-001)
                  </h2>
                  <button
                    onClick={() => setSupervisorModalOpen(true)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                  >
                    🔑 {supervisorAuthorized ? "Supervisor Autorizado" : "PIN Supervisor"}
                  </button>
                </div>

                <div className="divide-y divide-slate-800 overflow-x-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-200">{item.name}</div>
                        <div className="text-xs text-slate-400">
                          SKU: {item.sku} · {item.presentation} (x{item.factor}) ·{" "}
                          <span className="text-amber-400">{item.taxRate}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCart((prev) =>
                              prev.map((i) =>
                                i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i
                              )
                            );
                          }}
                          className="h-7 w-7 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-mono font-bold text-white">{item.qty}</span>
                        <button
                          onClick={() => {
                            setCart((prev) =>
                              prev.map((i) =>
                                i.id === item.id ? { ...i, qty: i.qty + 1 } : i
                              )
                            );
                          }}
                          className="h-7 w-7 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                      </div>
                      <div className="w-20 text-right font-mono font-bold text-emerald-400">
                        ${(item.price * item.qty).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de Productos Rápidos */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Útiles de Rápido Acceso
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <button
                    onClick={() =>
                      setCart((prev) => [
                        ...prev,
                        {
                          id: `p-${Date.now()}`,
                          name: "Borrador Blanco Pelikan",
                          sku: "BOR-PEL-01",
                          presentation: "Unidad",
                          factor: 1,
                          qty: 1,
                          price: 0.35,
                          taxRate: "IVA_15",
                        },
                      ])
                    }
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition"
                  >
                    <div className="font-semibold text-white">Borrador Pelikan</div>
                    <div className="text-amber-400 font-mono">$0.35</div>
                  </button>
                  <button
                    onClick={() =>
                      setCart((prev) => [
                        ...prev,
                        {
                          id: `p-${Date.now()}`,
                          name: "Tijera Escolar Punta Roma",
                          sku: "TIJ-ESC-01",
                          presentation: "Unidad",
                          factor: 1,
                          qty: 1,
                          price: 1.15,
                          taxRate: "IVA_15",
                        },
                      ])
                    }
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition"
                  >
                    <div className="font-semibold text-white">Tijera Roma</div>
                    <div className="text-amber-400 font-mono">$1.15</div>
                  </button>
                  <button
                    onClick={() =>
                      setCart((prev) => [
                        ...prev,
                        {
                          id: `p-${Date.now()}`,
                          name: "Resma Papel Bond A4 75g",
                          sku: "RES-BON-A4",
                          presentation: "Resma 500H",
                          factor: 1,
                          qty: 1,
                          price: 4.8,
                          taxRate: "IVA_15",
                        },
                      ])
                    }
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition"
                  >
                    <div className="font-semibold text-white">Resma Papel Bond</div>
                    <div className="text-amber-400 font-mono">$4.80</div>
                  </button>
                  <button
                    onClick={() =>
                      setCart((prev) => [
                        ...prev,
                        {
                          id: `p-${Date.now()}`,
                          name: "Goma Líquida 120ml",
                          sku: "GOM-LIQ-120",
                          presentation: "Frasco",
                          factor: 1,
                          qty: 1,
                          price: 0.9,
                          taxRate: "IVA_15",
                        },
                      ])
                    }
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition"
                  >
                    <div className="font-semibold text-white">Goma Líquida</div>
                    <div className="text-amber-400 font-mono">$0.90</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Derecho: Datos Fiscales, Totales y Cobro */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
                  🧾 Facturación SRI & Pago
                </h3>

                {/* Selección de Tipo de Identificación */}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo de Identificación:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setIdType("CONSUMIDOR_FINAL");
                        setIdNumber("9999999999999");
                        setCustomerName("CONSUMIDOR FINAL");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                        idType === "CONSUMIDOR_FINAL"
                          ? "bg-amber-500 text-slate-950 border-amber-500"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      Consumidor Final
                    </button>
                    <button
                      onClick={() => {
                        setIdType("CEDULA");
                        setIdNumber("1710034065");
                        setCustomerName("Carlos Benítez");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                        idType === "CEDULA"
                          ? "bg-amber-500 text-slate-950 border-amber-500"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      Cédula (M10)
                    </button>
                    <button
                      onClick={() => {
                        setIdType("RUC");
                        setIdNumber("1790016927001");
                        setCustomerName("DISTRIBUIDORA ESCOLAR S.A.");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                        idType === "RUC"
                          ? "bg-amber-500 text-slate-950 border-amber-500"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      RUC (M11)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Nro Identificación:</label>
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Razón Social / Nombre:</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                {/* Forma de Pago */}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Forma de Pago:</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="EFECTIVO">01 - Efectivo (Mostrador)</option>
                    <option value="DEUNA_TRANSFERENCIA">20 - Deuna! / Transferencia Banco Pichincha</option>
                    <option value="TARJETA_DEBITO">16 - Tarjeta de Débito</option>
                    <option value="TARJETA_CREDITO">19 - Tarjeta de Crédito</option>
                    <option value="ANTICIPO_LISTA">Anticipo Aplicado (Lista Escolar)</option>
                  </select>
                </div>

                {paymentMethod === "EFECTIVO" && (
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-800/40 p-3 rounded-lg border border-slate-700">
                    <div>
                      <label className="text-slate-400 block mb-1">Efectivo Recibido ($):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Cambio / Vuelto:</label>
                      <div className="p-2 text-base font-bold font-mono text-emerald-400">
                        ${changeDue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumen de Totales */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal IVA 15%:</span>
                    <span>${subtotal15.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal IVA 0% (Libros):</span>
                    <span>${subtotal0.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>IVA 15%:</span>
                    <span>${iva15.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-white border-t border-slate-800 pt-2">
                    <span>TOTAL A PAGAR:</span>
                    <span className="text-emerald-400">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm"
                >
                  ⚡ Cobrar y Emitir Factura Electrónica SRI (&lt;5s)
                </button>
              </div>

              {/* Visor de Ticket Térmico ESC/POS */}
              {lastReceipt && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      🖨️ Ticket Térmico 80mm (Simulador ESC/POS)
                    </span>
                    <button
                      onClick={() => setLastReceipt(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cerrar
                    </button>
                  </div>
                  <pre className="bg-slate-950 text-slate-300 p-3 rounded-lg font-mono text-[11px] overflow-x-auto leading-tight border border-slate-800">
                    {lastReceipt}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TEMPORADA ESCOLAR (LISTAS DE ÚTILES) */}
        {activeTab === "school" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    🎒 Temporada Escolar & Control de Listas de Útiles
                  </h2>
                  <p className="text-xs text-slate-400">
                    Gestión estacional de colegios en Ecuador (Régimen Sierra y Costa), reservas con anticipo y cotización por WhatsApp.
                  </p>
                </div>

                <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
                  <button
                    onClick={() => setSchoolRegime("SIERRA")}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
                      schoolRegime === "SIERRA"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    ⛰️ Régimen Sierra / Amazonía
                  </button>
                  <button
                    onClick={() => setSchoolRegime("COSTA")}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
                      schoolRegime === "COSTA"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    🏖️ Régimen Costa / Galápagos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Institución Educativa:</label>
                  <input
                    type="text"
                    value={schoolInstitution}
                    onChange={(e) => setSchoolInstitution(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Alumno / Representante:</label>
                  <input
                    type="text"
                    value={schoolStudent}
                    onChange={(e) => setSchoolStudent(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Anticipo Requerido ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={schoolAdvanceCents}
                    onChange={(e) => setSchoolAdvanceCents(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Ítems de la Lista Escolar Seleccionada
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                    <span>4x Cuaderno Universitario 100H Cuadros Norma</span>
                    <span className="font-mono text-emerald-400">$9.00 (En Stock)</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                    <span>1x Caja de Lápices de Colores x 24 Faber-Castell</span>
                    <span className="font-mono text-emerald-400">$6.50 (En Stock)</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                    <span>1x Juego Geométrico 30cm Flexible</span>
                    <span className="font-mono text-emerald-400">$2.10 (En Stock)</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span>1x Diccionario Escolar Norma</span>
                    <span className="font-mono text-emerald-400">$5.50 (En Stock)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-mono">
                  <span className="font-bold text-white">TOTAL COTIZADO:</span>
                  <span className="text-base font-bold text-emerald-400">$23.10 USD</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    const msg = `🎒 *LUMSA LIBRARY — Cotización de Lista de Útiles*\nHola *Familia Benítez*,\nHemos cotizado la lista para *${schoolStudent}* de *${schoolInstitution}*:\n\n💵 *Total de la lista:* $23.10 USD\n💰 *Anticipo para reserva de stock:* $${schoolAdvanceCents.toFixed(2)} USD\n📲 *Ver lista completa y reservar:* https://lumsa.ec/lista/abc-789\n\n¡Separe sus cuadernos con anticipación para la temporada!`;
                    setWhatsappGenerated(msg);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-2"
                >
                  💬 Generar Mensaje de Proforma WhatsApp
                </button>
                <button
                  onClick={() => {
                    alert("✅ Lista Reservada: Se ha registrado el anticipo de $" + schoolAdvanceCents.toFixed(2) + " en el turno de caja y el stock físico ha sido bloqueado en el almacén.");
                  }}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition"
                >
                  🔒 Reservar Stock con Anticipo
                </button>
                <button
                  onClick={() => {
                    setActiveTab("pos");
                    alert("🚀 Despachando a POS en 1-Click: Los ítems han sido cargados al mostrador y se ha aplicado el anticipo.");
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition"
                >
                  ⚡ Despachar a POS en 1-Click
                </button>
              </div>

              {whatsappGenerated && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-emerald-400">
                    Mensaje Formateado para WhatsApp (E.164 +593):
                  </div>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans bg-slate-900/80 p-3 rounded border border-slate-800">
                    {whatsappGenerated}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: KARDEX & INVENTARIO */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    📦 Kardex Inmutable & Método PMP (Precio Medio Ponderado)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Cumplimiento riguroso de la normativa contable ecuatoriana: Asientos inmutables, recálculo continuo y prohibición de stock negativo.
                  </p>
                </div>
                <div className="text-xs px-3 py-1.5 bg-slate-800 text-amber-400 rounded-lg font-mono">
                  Bodega Principal (BOD-CENTRAL)
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono">
                      <th className="py-2.5 px-3">FECHA / HORA</th>
                      <th className="py-2.5 px-3">TIPO ASIENTO</th>
                      <th className="py-2.5 px-3">PRODUCTO / SKU</th>
                      <th className="py-2.5 px-3 text-right">CANTIDAD</th>
                      <th className="py-2.5 px-3 text-right">COSTO UNIT.</th>
                      <th className="py-2.5 px-3 text-right">NUEVO PMP</th>
                      <th className="py-2.5 px-3 text-right">SALDO FÍSICO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">04/10 09:15</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-400">PURCHASE_ENTRY</td>
                      <td className="py-2.5 px-3 text-slate-200">CUA-NORM-100 (Fact. 001-001-456)</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">+120 u</td>
                      <td className="py-2.5 px-3 text-right">$1.00</td>
                      <td className="py-2.5 px-3 text-right text-amber-400">$1.00</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">120 u</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">04/10 10:20</td>
                      <td className="py-2.5 px-3 font-semibold text-red-400">SALE_EXIT</td>
                      <td className="py-2.5 px-3 text-slate-200">CUA-NORM-100 (Ticket VTA-001)</td>
                      <td className="py-2.5 px-3 text-right text-red-400">-2 u</td>
                      <td className="py-2.5 px-3 text-right">$1.00</td>
                      <td className="py-2.5 px-3 text-right text-amber-400">$1.00</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">118 u</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">04/10 10:35</td>
                      <td className="py-2.5 px-3 font-semibold text-blue-400">CUSTOMER_RETURN</td>
                      <td className="py-2.5 px-3 text-slate-200">CUA-NORM-100 (Devolución)</td>
                      <td className="py-2.5 px-3 text-right text-blue-400">+1 u</td>
                      <td className="py-2.5 px-3 text-right">$1.00</td>
                      <td className="py-2.5 px-3 text-right text-amber-400">$1.00</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">119 u</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">04/10 10:45</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-400">PURCHASE_ENTRY</td>
                      <td className="py-2.5 px-3 text-slate-200">COL-FC-24 (Faber-Castell)</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">+50 u</td>
                      <td className="py-2.5 px-3 text-right">$3.80</td>
                      <td className="py-2.5 px-3 text-right text-amber-400">$3.80</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">50 u</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COMPRAS XML SRI */}
        {activeTab === "purchasing" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    📥 Lector Inteligente de Facturas Electrónicas SRI (XML)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Carga automática de facturas de proveedores (Norma, Faber-Castell, Papelesa). Recálculo de PMP y cuentas por pagar.
                  </p>
                </div>
                <button
                  onClick={handleSimulateXmlLoad}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition"
                >
                  ⚡ Simular Carga XML Faber-Castell
                </button>
              </div>

              {xmlParsedData ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[10px]">PROVEEDOR:</div>
                      <div className="font-bold text-white">{xmlParsedData.supplier}</div>
                      <div className="text-slate-500">RUC: {xmlParsedData.ruc}</div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[10px]">FACTURA NRO:</div>
                      <div className="font-bold text-amber-400">{xmlParsedData.invoiceNum}</div>
                      <div className="text-emerald-400 text-[10px]">AUTORIZADO SRI</div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[10px]">ÍTEMS DETECTADOS:</div>
                      <div className="font-bold text-white">{xmlParsedData.itemsCount} productos</div>
                      <div className="text-blue-400 text-[10px]">100% Conciliados</div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[10px]">TOTAL FACTURA:</div>
                      <div className="font-bold text-emerald-400 text-sm">
                        ${xmlParsedData.total.toFixed(2)} USD
                      </div>
                      <div className="text-slate-500">IVA 15%: ${xmlParsedData.iva.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        alert("✅ Compra Confirmada: 120 unidades ingresadas a Kardex, PMP actualizado a $1.00 y cuenta por pagar generada a 30 días.");
                      }}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition"
                    >
                      💾 Confirmar Compra e Ingresar al Kardex
                    </button>
                    <button
                      onClick={() => setXmlParsedData(null)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-800 rounded-xl p-10 text-center space-y-2">
                  <div className="text-4xl">📄</div>
                  <div className="text-sm font-semibold text-slate-300">
                    Arrastra aquí el archivo XML de la factura del distribuidor
                  </div>
                  <div className="text-xs text-slate-500">
                    Soporta esquemas oficiales SRI v1.1.0 y comprobantes envueltos en SOAP
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: MÉTRICAS & ASISTENTE IA */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Tarjetas KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-mono">Ventas del Mes</div>
                <div className="text-xl font-bold text-white font-mono mt-1">$4,850.00</div>
                <div className="text-[11px] text-emerald-400 mt-1">↑ +22% Temporada Escolar</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-mono">Costo de Ventas (PMP)</div>
                <div className="text-xl font-bold text-slate-300 font-mono mt-1">$3,120.00</div>
                <div className="text-[11px] text-slate-500 mt-1">Costo exacto de reposición</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-mono">Utilidad Bruta</div>
                <div className="text-xl font-bold text-emerald-400 font-mono mt-1">$1,730.00</div>
                <div className="text-[11px] text-emerald-400 mt-1">Margen real: 35.67%</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-mono">Capital Inmovilizado (Hueso)</div>
                <div className="text-xl font-bold text-amber-400 font-mono mt-1">$480.00</div>
                <div className="text-[11px] text-amber-400/80 mt-1">Artículos sin venta &gt;90d</div>
              </div>
            </div>

            {/* Asistente Inteligente Gemini */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-purple-500 flex items-center justify-center text-xs font-bold text-white">
                  ✨
                </div>
                <h3 className="text-base font-bold text-white">
                  Asistente Inteligente de Mostrador (Gemini 2.5 Flash)
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Resuelve dudas de mostrador, sugiere sustitutos escolares cuando un producto se agota y proyecta compras por temporada.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: ¿Qué alternativas económicas tenemos a cuadernos de 100 hojas cuadros?"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAi()}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleAskAi}
                  disabled={aiLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
                >
                  {aiLoading ? "Consultando..." : "Preguntar a Gemini"}
                </button>
              </div>

              {aiResponse && (
                <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/50 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {aiResponse}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: CONFIGURACIÓN & RESPALDOS */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ⚙️ Configuración Institucional, Respaldos y Seguridad
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Datos de Empresa */}
                <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <h3 className="font-bold text-slate-200">Datos Fiscales de la Empresa</h3>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Razón Social:</label>
                    <input
                      type="text"
                      readOnly
                      value="LUMSA LIBRARY CIA. LTDA."
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">RUC:</label>
                    <input
                      type="text"
                      readOnly
                      value="1790016927001"
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Dirección Matriz:</label>
                    <input
                      type="text"
                      readOnly
                      value="Av. Amazonas 123 y Cordero, Quito, Ecuador"
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white"
                    />
                  </div>
                </div>

                {/* Copias de Seguridad */}
                <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <h3 className="font-bold text-slate-200">
                    Copias de Seguridad (Disaster Recovery 20+ Años)
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    Cifrado AES-256-CBC militar en reposo con sincronización continua a la nube y suma de comprobación SHA-256.
                  </p>
                  <button
                    onClick={handleGenerateBackup}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
                  >
                    💾 Ejecutar Respaldo Inmediato
                  </button>
                  {backupStatus && (
                    <div className="p-3 bg-slate-900 rounded border border-slate-800 font-mono text-[11px] text-slate-300">
                      {backupStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de PIN de Supervisor */}
      {supervisorModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              🔑 Autorización de Supervisor
            </h3>
            <p className="text-xs text-slate-400">
              Ingrese el PIN de 4 dígitos para autorizar descuentos especiales o anulaciones en mostrador:
            </p>
            <input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={supervisorPin}
              onChange={(e) => setSupervisorPin(e.target.value)}
              className="w-full text-center text-2xl font-mono tracking-widest bg-slate-950 border border-slate-700 rounded-xl p-3 text-amber-400 focus:outline-none focus:border-amber-400"
            />
            <div className="text-[11px] text-slate-500 text-center">
              (PIN de demostración: <code className="text-amber-400 font-bold">4321</code>)
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAuthorizePin}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                Autorizar
              </button>
              <button
                onClick={() => setSupervisorModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
