import "./_env";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/db";
import * as s from "../src/db/schema";
import { hashPassword } from "../src/server/security/password";
import { encrypt } from "../src/server/security/crypto";
import { poTotals, lineTotal } from "../src/lib/po-status";

/* Idempotent seed: masters are upserted by natural key, transactional data is
   inserted only when the PO / invoice number does not exist yet. All names are
   fictional but plausible for a Ka-band satellite broadband operator serving
   the Pacific and South-East Asia. */

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Kacific2026!";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin12345";

function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}
const rand = rng(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const daysAgo = (d: number, h = 9) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 0, 0, 0);
  return t;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

const USERS = [
  { email: "admin@kacific.example", name: "Ana Pereira", role: "admin" },
  { email: "manager@kacific.example", name: "Tevita Fifita", role: "manager" },
  { email: "procurement@kacific.example", name: "Mei Lin Chua", role: "procurement" },
  { email: "finance@kacific.example", name: "Joseph Kaupa", role: "finance" },
  { email: "requester@kacific.example", name: "Litia Ravuvu", role: "requester" },
  { email: "viewer@kacific.example", name: "Rafael Ximenes", role: "viewer" },
] as const;

const WAREHOUSES = [
  { code: "SIN-HQ", name: "Singapore HQ", country: "Singapore", city: "Singapore" },
  { code: "POM", name: "Port Moresby Depot", country: "Papua New Guinea", city: "Port Moresby" },
  { code: "SUV", name: "Suva Depot", country: "Fiji", city: "Suva" },
  { code: "MNL", name: "Manila Hub", country: "Philippines", city: "Manila" },
  { code: "HIR", name: "Honiara Depot", country: "Solomon Islands", city: "Honiara" },
  { code: "VLI", name: "Port Vila Depot", country: "Vanuatu", city: "Port Vila" },
  { code: "DIL", name: "Dili Depot", country: "Timor-Leste", city: "Dili" },
  { code: "JKT", name: "Jakarta Hub", country: "Indonesia", city: "Jakarta" },
];

const VENDORS = [
  { code: "V-ORB", name: "Orbitel Systems Pte Ltd", country: "Singapore", contactName: "Daniel Koh", email: "sales@orbitel.example", leadTimeDays: 21, paymentTermsDays: 30, rating: 5, notes: "Primary Gigstarter terminal kit supplier (1.2 m / 0.75 m Ka-band antennas, CommsBox integration)." },
  { code: "V-SKY", name: "SkyBridge RF Pty Ltd", country: "Australia", contactName: "Hannah Price", email: "orders@skybridge.example", leadTimeDays: 28, paymentTermsDays: 45, rating: 4, notes: "BUCs, LNBs and RF assemblies." },
  { code: "V-MOD", name: "Meridian Modem Technologies", country: "Taiwan", contactName: "Wen-Chi Lai", email: "apac@meridianmodem.example", leadTimeDays: 35, paymentTermsDays: 30, rating: 4, notes: "Distributor for ST Engineering iDirect MDM2010 / MDM2510 modems and iLNB 3210 transceivers." },
  { code: "V-PAS", name: "Pasifika Solar Co", country: "Fiji", contactName: "Semi Naulu", email: "hello@pasifikasolar.example", leadTimeDays: 14, paymentTermsDays: 30, rating: 4, notes: "Solar kits and LiFePO4 batteries for off-grid sites." },
  { code: "V-COR", name: "Coral Sea Cabling", country: "Papua New Guinea", contactName: "Grace Tavul", email: "sales@coralseacabling.example", leadTimeDays: 10, paymentTermsDays: 30, rating: 3, notes: "RF and CAT6 cabling, connectors." },
  { code: "V-MRF", name: "Manila RF Works Inc", country: "Philippines", contactName: "Carlo Reyes", email: "cs@manilarf.example", leadTimeDays: 12, paymentTermsDays: 30, rating: 4, notes: "Mounting hardware, enclosures, installer tooling." },
  { code: "V-NET", name: "Archipelago Networks Sdn Bhd", country: "Malaysia", contactName: "Farah Aziz", email: "sales@archnet.example", leadTimeDays: 14, paymentTermsDays: 30, rating: 4, notes: "Wi-Fi 6 routers, switches and community hotspot kits for the reseller network (500+ ISPs)." },
  { code: "V-GWY", name: "Gateway Spares GmbH", country: "Germany", contactName: "Lukas Brandt", email: "service@gatewayspares.example", leadTimeDays: 45, paymentTermsDays: 60, rating: 3, notes: "Teleport / gateway spare parts. Long lead times." },
  { code: "V-TST", name: "Nusantara Test & Measurement", country: "Indonesia", contactName: "Putri Handayani", email: "sales@nusantaratm.example", leadTimeDays: 20, paymentTermsDays: 30, rating: 4, notes: "Spectrum analysers, power meters, calibration." },
  { code: "V-LOG", name: "Pacific Freight Logistics", country: "New Zealand", contactName: "Aroha Ngata", email: "ops@pacfreight.example", leadTimeDays: 7, paymentTermsDays: 14, rating: 4, notes: "Inter-island freight, crating and customs." },
];

type SkuSeed = { sku: string; name: string; category: string; unit: string; unitCost: number; reorderLevel: number; reorderQty: number; vendor: string; leadTimeDays: number };
const SKUS: SkuSeed[] = [
  { sku: "TRM-1200", name: "Gigstarter 1.2 m Ka-band VSAT Terminal Kit", category: "Terminals", unit: "kit", unitCost: 1850, reorderLevel: 40, reorderQty: 60, vendor: "V-ORB", leadTimeDays: 21 },
  { sku: "TRM-0750", name: "Gigstarter 0.75 m Ka-band VSAT Terminal Kit", category: "Terminals", unit: "kit", unitCost: 1120, reorderLevel: 60, reorderQty: 100, vendor: "V-ORB", leadTimeDays: 21 },
  { sku: "TRM-COMM", name: "CommsBox Rapid-Deploy Connectivity Kit", category: "Terminals", unit: "kit", unitCost: 2400, reorderLevel: 20, reorderQty: 30, vendor: "V-ORB", leadTimeDays: 28 },
  { sku: "ANT-1200", name: "1.2 m Ka-band Reflector Assembly", category: "RF", unit: "ea", unitCost: 640, reorderLevel: 30, reorderQty: 50, vendor: "V-ORB", leadTimeDays: 21 },
  { sku: "ANT-0750", name: "0.75 m Ka-band Reflector Assembly", category: "RF", unit: "ea", unitCost: 380, reorderLevel: 40, reorderQty: 80, vendor: "V-ORB", leadTimeDays: 21 },
  { sku: "RF-BUC4", name: "4 W Ka-band BUC (1.2 m terminal)", category: "RF", unit: "ea", unitCost: 920, reorderLevel: 50, reorderQty: 80, vendor: "V-SKY", leadTimeDays: 28 },
  { sku: "RF-BUC2", name: "2 W Ka-band BUC", category: "RF", unit: "ea", unitCost: 610, reorderLevel: 40, reorderQty: 60, vendor: "V-SKY", leadTimeDays: 28 },
  { sku: "RF-LNB", name: "iLNB 3210 Ka-band Transceiver", category: "RF", unit: "ea", unitCost: 145, reorderLevel: 80, reorderQty: 150, vendor: "V-SKY", leadTimeDays: 21 },
  { sku: "RF-FEED", name: "Ka-band Feed Horn + OMT", category: "RF", unit: "ea", unitCost: 210, reorderLevel: 40, reorderQty: 60, vendor: "V-SKY", leadTimeDays: 28 },
  { sku: "MDM-KX100", name: "iDirect MDM2010 IP Satellite Modem", category: "Networking", unit: "ea", unitCost: 480, reorderLevel: 100, reorderQty: 200, vendor: "V-MOD", leadTimeDays: 35 },
  { sku: "MDM-KX300", name: "iDirect MDM2510 Enterprise Satellite Modem", category: "Networking", unit: "ea", unitCost: 1350, reorderLevel: 25, reorderQty: 40, vendor: "V-MOD", leadTimeDays: 35 },
  { sku: "NET-WIFI6", name: "Wi-Fi 6 Router, Dual Band", category: "Networking", unit: "ea", unitCost: 89, reorderLevel: 150, reorderQty: 300, vendor: "V-NET", leadTimeDays: 14 },
  { sku: "NET-AP-OUT", name: "Community Wi-Fi Outdoor Access Point, PoE", category: "Networking", unit: "ea", unitCost: 165, reorderLevel: 60, reorderQty: 100, vendor: "V-NET", leadTimeDays: 14 },
  { sku: "NET-SW8", name: "8-port PoE Switch", category: "Networking", unit: "ea", unitCost: 120, reorderLevel: 40, reorderQty: 60, vendor: "V-NET", leadTimeDays: 14 },
  { sku: "PWR-SOL200", name: "Solar Power Kit 200 W", category: "Power", unit: "kit", unitCost: 540, reorderLevel: 30, reorderQty: 50, vendor: "V-PAS", leadTimeDays: 14 },
  { sku: "PWR-SOL400", name: "Solar Power Kit 400 W", category: "Power", unit: "kit", unitCost: 960, reorderLevel: 15, reorderQty: 25, vendor: "V-PAS", leadTimeDays: 14 },
  { sku: "PWR-BAT100", name: "LiFePO4 Battery 12 V 100 Ah", category: "Power", unit: "ea", unitCost: 410, reorderLevel: 30, reorderQty: 50, vendor: "V-PAS", leadTimeDays: 14 },
  { sku: "PWR-PSU48", name: "48 V PoE Power Supply", category: "Power", unit: "ea", unitCost: 38, reorderLevel: 100, reorderQty: 200, vendor: "V-NET", leadTimeDays: 14 },
  { sku: "PWR-UPS1K", name: "1 kVA Line-interactive UPS", category: "Power", unit: "ea", unitCost: 290, reorderLevel: 10, reorderQty: 20, vendor: "V-MRF", leadTimeDays: 12 },
  { sku: "MNT-NPR", name: "Non-penetrating Roof Mount", category: "Mounting", unit: "ea", unitCost: 175, reorderLevel: 40, reorderQty: 80, vendor: "V-MRF", leadTimeDays: 12 },
  { sku: "MNT-POLE", name: "Galvanised Pole Mount Kit 76 mm", category: "Mounting", unit: "kit", unitCost: 95, reorderLevel: 60, reorderQty: 120, vendor: "V-MRF", leadTimeDays: 12 },
  { sku: "MNT-WALL", name: "Heavy-duty Wall Mount", category: "Mounting", unit: "ea", unitCost: 62, reorderLevel: 40, reorderQty: 80, vendor: "V-MRF", leadTimeDays: 12 },
  { sku: "MNT-ENC", name: "IP66 Outdoor Enclosure 400x300", category: "Mounting", unit: "ea", unitCost: 140, reorderLevel: 25, reorderQty: 40, vendor: "V-MRF", leadTimeDays: 12 },
  { sku: "CAB-RF30", name: "RF Coax Cable LMR-400, 30 m, N-type", category: "Cabling", unit: "ea", unitCost: 68, reorderLevel: 120, reorderQty: 250, vendor: "V-COR", leadTimeDays: 10 },
  { sku: "CAB-RF50", name: "RF Coax Cable LMR-400, 50 m, N-type", category: "Cabling", unit: "ea", unitCost: 104, reorderLevel: 60, reorderQty: 120, vendor: "V-COR", leadTimeDays: 10 },
  { sku: "CAB-CAT6", name: "Outdoor CAT6 Cable 305 m drum", category: "Cabling", unit: "drum", unitCost: 210, reorderLevel: 15, reorderQty: 30, vendor: "V-COR", leadTimeDays: 10 },
  { sku: "CAB-NCON", name: "N-type Connector, Crimp (pack of 25)", category: "Cabling", unit: "pack", unitCost: 55, reorderLevel: 40, reorderQty: 80, vendor: "V-COR", leadTimeDays: 10 },
  { sku: "CAB-GND", name: "Grounding Kit", category: "Cabling", unit: "kit", unitCost: 24, reorderLevel: 80, reorderQty: 150, vendor: "V-COR", leadTimeDays: 10 },
  { sku: "SPR-GWLC", name: "Gateway Line Card (spare)", category: "Spares", unit: "ea", unitCost: 8900, reorderLevel: 2, reorderQty: 2, vendor: "V-GWY", leadTimeDays: 45 },
  { sku: "SPR-HPA", name: "Gateway HPA Module (spare)", category: "Spares", unit: "ea", unitCost: 14500, reorderLevel: 1, reorderQty: 1, vendor: "V-GWY", leadTimeDays: 60 },
  { sku: "SPR-FAN", name: "Rack Fan Tray (spare)", category: "Spares", unit: "ea", unitCost: 260, reorderLevel: 4, reorderQty: 6, vendor: "V-GWY", leadTimeDays: 30 },
  { sku: "TLS-INST", name: "Installer Tool Kit", category: "Tools", unit: "kit", unitCost: 320, reorderLevel: 10, reorderQty: 15, vendor: "V-MRF", leadTimeDays: 12 },
  { sku: "TLS-SATF", name: "Satellite Finder / Pointing Meter", category: "Tools", unit: "ea", unitCost: 790, reorderLevel: 6, reorderQty: 10, vendor: "V-TST", leadTimeDays: 20 },
  { sku: "TLS-PWRM", name: "RF Power Meter, Ka-band", category: "Tools", unit: "ea", unitCost: 2450, reorderLevel: 2, reorderQty: 3, vendor: "V-TST", leadTimeDays: 20 },
];

/* Deliberately low / zero stock for these so the dashboard has something to say. */
const LOW = new Set(["TRM-1200", "RF-BUC4", "MDM-KX100", "PWR-BAT100", "CAB-RF30", "SPR-GWLC", "NET-WIFI6", "TLS-SATF"]);
const ZERO = new Set(["SPR-HPA", "PWR-SOL400"]);

async function main() {
  const db = getDb();
  console.log("Seeding…");

  // Company + users
  await db.insert(s.companySettings).values({ id: 1, address: "Singapore (HQ) · gateways in Asia-Pacific · Kacific1 Ka-band HTS, 25 countries" }).onConflictDoNothing();
  const passwordHash = await hashPassword(SEED_PASSWORD);
  // Six named admin logins requested for the pilot (admin1…admin6@kacific.com / admin12345).
  const adminHash = await hashPassword(ADMIN_PASSWORD);
  for (let i = 1; i <= 6; i++) {
    await db
      .insert(s.users)
      .values({ email: `admin${i}@kacific.com`, name: `Admin ${i}`, role: "admin", passwordHash: adminHash })
      .onConflictDoUpdate({ target: s.users.email, set: { role: "admin", isActive: true, passwordHash: adminHash } });
  }
  // Department logins (same password as the admins) for role-based access demos.
  for (const [email, name, role] of [["sales@kacific.com", "Sales Team", "sales"], ["procurement@kacific.com", "Procurement Team", "procurement"], ["operations@kacific.com", "Operations Team", "operations"]] as const) {
    await db.insert(s.users).values({ email, name, role, passwordHash: adminHash }).onConflictDoUpdate({ target: s.users.email, set: { role, isActive: true, passwordHash: adminHash } });
  }
  await db.insert(s.users).values({ email: "hermes-telegram@api.kacific.local", name: "Hermes (Telegram)", role: "sales", isServiceAccount: true }).onConflictDoNothing();
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const [row] = await db
      .insert(s.users)
      .values({ ...u, passwordHash })
      .onConflictDoUpdate({ target: s.users.email, set: { name: u.name, role: u.role, isActive: true } })
      .returning();
    userIds[u.role] = row.id;
  }

  // Warehouses
  const whIds: Record<string, string> = {};
  for (const w of WAREHOUSES) {
    const [row] = await db.insert(s.warehouses).values(w).onConflictDoUpdate({ target: s.warehouses.code, set: { name: w.name, country: w.country, city: w.city } }).returning();
    whIds[w.code] = row.id;
  }

  // Vendors
  const vendorIds: Record<string, string> = {};
  for (const v of VENDORS) {
    const [row] = await db.insert(s.vendors).values(v).onConflictDoUpdate({ target: s.vendors.code, set: { ...v } }).returning();
    vendorIds[v.code] = row.id;
  }

  // SKUs + stock
  const skuIds: Record<string, string> = {};
  const skuMeta: Record<string, SkuSeed> = {};
  const existingStock = await db.select({ n: sql<number>`count(*)` }).from(s.stockLevels);
  const seedStock = Number(existingStock[0].n) === 0;
  for (const k of SKUS) {
    const { vendor, ...rest } = k;
    const values = { ...rest, preferredVendorId: vendorIds[vendor] };
    const [row] = await db.insert(s.skus).values(values).onConflictDoUpdate({ target: s.skus.sku, set: values }).returning();
    skuIds[k.sku] = row.id;
    skuMeta[k.sku] = k;
    if (seedStock) {
      for (const w of WAREHOUSES) {
        const isHub = w.code === "SIN-HQ" || w.code === "MNL" || w.code === "JKT";
        let qty: number;
        if (ZERO.has(k.sku)) qty = 0;
        else if (LOW.has(k.sku)) qty = Math.floor(rand() * Math.max(1, k.reorderLevel * 0.15));
        else qty = Math.floor(k.reorderLevel * (isHub ? 1.4 : 0.5) + rand() * k.reorderLevel);
        await db.insert(s.stockLevels).values({ skuId: row.id, warehouseId: whIds[w.code], qty }).onConflictDoNothing();
        if (qty > 0) {
          await db.insert(s.stockMovements).values({ skuId: row.id, warehouseId: whIds[w.code], delta: qty, reason: "seed", note: "Opening balance" });
        }
      }
    }
  }

  // Purchase orders across the lifecycle over the last 6 months
  type PoSeed = { n: number; status: s.PurchaseOrder["status"]; vendor: string; wh: string; ageDays: number; lines: [string, number][]; source?: s.PurchaseOrder["source"]; requester?: string; note?: string };
  const POS: PoSeed[] = [
    { n: 1, status: "closed", vendor: "V-ORB", wh: "SUV", ageDays: 170, lines: [["TRM-1200", 40], ["MNT-NPR", 40]] },
    { n: 2, status: "closed", vendor: "V-SKY", wh: "SIN-HQ", ageDays: 158, lines: [["RF-BUC4", 60], ["RF-LNB", 120]] },
    { n: 3, status: "closed", vendor: "V-MOD", wh: "SIN-HQ", ageDays: 140, lines: [["MDM-KX100", 150]] },
    { n: 4, status: "closed", vendor: "V-PAS", wh: "POM", ageDays: 121, lines: [["PWR-SOL200", 30], ["PWR-BAT100", 40]] },
    { n: 5, status: "closed", vendor: "V-NET", wh: "MNL", ageDays: 104, lines: [["NET-WIFI6", 250], ["PWR-PSU48", 150]] },
    { n: 6, status: "received", vendor: "V-COR", wh: "POM", ageDays: 75, lines: [["CAB-RF30", 200], ["CAB-NCON", 60], ["CAB-GND", 100]] },
    { n: 7, status: "received", vendor: "V-ORB", wh: "HIR", ageDays: 62, lines: [["TRM-0750", 80], ["MNT-POLE", 80]] },
    { n: 8, status: "ordered", vendor: "V-GWY", wh: "SIN-HQ", ageDays: 48, lines: [["SPR-GWLC", 2], ["SPR-FAN", 4]], note: "Gateway resilience spares — Q3 capex." },
    { n: 9, status: "ordered", vendor: "V-MRF", wh: "MNL", ageDays: 33, lines: [["MNT-ENC", 40], ["TLS-INST", 10], ["MNT-WALL", 60]] },
    { n: 10, status: "approved", vendor: "V-PAS", wh: "VLI", ageDays: 21, lines: [["PWR-SOL400", 25], ["PWR-BAT100", 50]], note: "Vanuatu school connectivity roll-out, phase 2 — solar-powered Gigstarter sites." },
    { n: 11, status: "approved", vendor: "V-TST", wh: "SIN-HQ", ageDays: 12, lines: [["TLS-SATF", 10], ["TLS-PWRM", 2]] },
    { n: 12, status: "pending_approval", vendor: "V-ORB", wh: "SUV", ageDays: 5, lines: [["TRM-1200", 60], ["ANT-1200", 20], ["MNT-NPR", 60]], source: "low_stock", note: "Fiji cyclone-season readiness stock for Gigstarter installs (schools and clinics programme)." },
    { n: 13, status: "pending_approval", vendor: "V-MOD", wh: "DIL", ageDays: 2, lines: [["MDM-KX100", 200], ["MDM-KX300", 20]], source: "agent", note: "Reorder agent recommendation — KX-100 below reorder level in 6 of 8 depots." },
    { n: 14, status: "rejected", vendor: "V-GWY", wh: "SIN-HQ", ageDays: 26, lines: [["SPR-HPA", 1]], note: "Rejected: defer to next capex cycle; one HPA already in transit." },
    { n: 15, status: "draft", vendor: "V-NET", wh: "JKT", ageDays: 1, lines: [["NET-AP-OUT", 100], ["NET-SW8", 60]], requester: "requester", note: "Community Wi-Fi hotspot expansion for reseller ISPs, Sulawesi cluster." },
    { n: 16, status: "cancelled", vendor: "V-LOG", wh: "SIN-HQ", ageDays: 90, lines: [["CAB-CAT6", 10]], note: "Cancelled: consolidated into PO-0006 freight." },
  ];

  const company = (await db.query.companySettings.findFirst({ where: eq(s.companySettings.id, 1) }))!;
  const year = new Date().getFullYear();
  const poIds: Record<number, string> = {};
  const names: Record<string, string> = {};
  for (const u of USERS) names[u.role] = u.name;

  for (const p of POS) {
    const poNumber = `${company.poPrefix}-${year}-${String(p.n).padStart(4, "0")}`;
    const existing = await db.query.purchaseOrders.findFirst({ where: eq(s.purchaseOrders.poNumber, poNumber) });
    if (existing) {
      poIds[p.n] = existing.id;
      continue;
    }
    const lines = p.lines.map(([sku, qty], i) => ({ skuId: skuIds[sku], description: skuMeta[sku].name, qty, unitCost: skuMeta[sku].unitCost, lineNo: i + 1 }));
    const totals = poTotals(lines, 0);
    const created = daysAgo(p.ageDays);
    const requesterRole = p.requester ?? pick(["requester", "procurement", "requester"]);
    const timeline: { type: string; at: Date; actor: string; message: string }[] = [
      { type: "created", at: created, actor: requesterRole, message: `Draft created${p.source === "agent" ? " by the reorder agent" : p.source === "low_stock" ? " from the low-stock list" : ""}` },
    ];
    const submittedAt = p.status === "draft" ? null : daysAgo(p.ageDays, 11);
    if (submittedAt) {
      timeline.push({ type: "submitted", at: submittedAt, actor: requesterRole, message: "Submitted for approval" });
      timeline.push({ type: "approval_email_sent", at: submittedAt, actor: "system", message: `Approval request emailed to ${names.manager}` });
    }
    const decided = ["approved", "ordered", "received", "closed", "rejected"].includes(p.status) ? daysAgo(p.ageDays - 1, 15) : null;
    if (decided) {
      timeline.push(p.status === "rejected" ? { type: "rejected", at: decided, actor: "manager", message: p.note ?? "Rejected" } : { type: "approved", at: decided, actor: "manager", message: "Approved via email link" });
    }
    const orderedAt = ["ordered", "received", "closed"].includes(p.status) ? daysAgo(p.ageDays - 3, 10) : null;
    if (orderedAt) timeline.push({ type: "ordered", at: orderedAt, actor: "procurement", message: "PO sent to vendor" });
    const receivedAt = ["received", "closed"].includes(p.status) ? daysAgo(Math.max(1, p.ageDays - 3 - skuMeta[p.lines[0][0]].leadTimeDays), 14) : null;
    if (receivedAt) timeline.push({ type: "received", at: receivedAt, actor: "procurement", message: "All lines received into " + p.wh });
    const closedAt = p.status === "closed" ? daysAgo(Math.max(0, p.ageDays - 30), 16) : null;
    if (closedAt) timeline.push({ type: "closed", at: closedAt, actor: "finance", message: "Invoice paid — PO closed" });
    if (p.status === "cancelled") timeline.push({ type: "cancelled", at: daysAgo(p.ageDays - 2), actor: "procurement", message: p.note ?? "Cancelled" });

    const [po] = await db
      .insert(s.purchaseOrders)
      .values({
        poNumber,
        status: p.status,
        source: p.source ?? "manual",
        vendorId: vendorIds[p.vendor],
        warehouseId: whIds[p.wh],
        requesterId: userIds[requesterRole],
        approverId: decided ? userIds.manager : null,
        ...totals,
        notes: p.note ?? "",
        neededBy: iso(daysAgo(p.ageDays - 30)),
        submittedAt,
        decidedAt: decided,
        decisionNote: p.status === "rejected" ? (p.note ?? "") : decided ? "Approved" : "",
        orderedAt,
        receivedAt,
        closedAt,
        asanaTaskGid: submittedAt ? `mock-seed-${p.n}` : null,
        createdAt: created,
        updatedAt: closedAt ?? receivedAt ?? orderedAt ?? decided ?? submittedAt ?? created,
      })
      .returning();
    poIds[p.n] = po.id;
    await db.insert(s.purchaseOrderLines).values(
      lines.map((l) => ({ poId: po.id, ...l, lineTotal: lineTotal(l.qty, l.unitCost), qtyReceived: receivedAt ? l.qty : 0 })),
    );
    await db.insert(s.poEvents).values(
      timeline.map((t) => ({
        poId: po.id,
        type: t.type,
        actorType: t.actor === "system" ? ("system" as const) : ("user" as const),
        actorId: t.actor === "system" ? null : userIds[t.actor],
        actorLabel: t.actor === "system" ? "System" : names[t.actor],
        message: t.message,
        createdAt: t.at,
      })),
    );
  }
  await db.update(s.companySettings).set({ nextPoSeq: Math.max(company.nextPoSeq, POS.length + 1) }).where(eq(s.companySettings.id, 1));

  // Invoices
  type InvSeed = { number: string; po: number; status: s.Invoice["status"]; ageDays: number; variance?: number; note?: string };
  const INVOICES: InvSeed[] = [
    { number: "ORB-2026-0412", po: 1, status: "paid", ageDays: 140 },
    { number: "SKY-88213", po: 2, status: "paid", ageDays: 128 },
    { number: "MMT-INV-5521", po: 3, status: "paid", ageDays: 110 },
    { number: "PSC-0093", po: 4, status: "paid", ageDays: 92 },
    { number: "ARC-2026-1187", po: 5, status: "paid", ageDays: 74 },
    { number: "CSC-3310", po: 6, status: "approved", ageDays: 40 },
    { number: "ORB-2026-0466", po: 7, status: "matched", ageDays: 28 },
    { number: "GWS-7781", po: 8, status: "received", ageDays: 9, note: "Partial shipment invoiced ahead of delivery." },
    { number: "MRF-2026-215", po: 9, status: "disputed", ageDays: 6, variance: 0.08, note: "Unit price 8% above PO — vendor quoted new list price." },
    { number: "CSC-3355", po: 6, status: "received", ageDays: 3, note: "Freight surcharge, second invoice against PO." },
    { number: "PSC-0117", po: 10, status: "draft", ageDays: 1 },
    { number: "ARC-2026-1302", po: 5, status: "disputed", ageDays: 15, variance: 0.12, note: "Quantity invoiced exceeds quantity received." },
  ];
  for (const inv of INVOICES) {
    const poId = poIds[inv.po];
    const po = await db.query.purchaseOrders.findFirst({ where: eq(s.purchaseOrders.id, poId), with: { lines: true } });
    if (!po) continue;
    const exists = await db.query.invoices.findFirst({ where: sql`${s.invoices.vendorId} = ${po.vendorId} and ${s.invoices.invoiceNumber} = ${inv.number}` });
    if (exists) continue;
    const factor = 1 + (inv.variance ?? 0);
    const lines = po.lines.map((l) => ({ skuId: l.skuId, description: l.description, qty: inv.number === "ARC-2026-1302" ? l.qty + 20 : l.qty, unitCost: Math.round(l.unitCost * factor * 100) / 100 }));
    const totals = poTotals(lines, 0);
    const issued = daysAgo(inv.ageDays);
    const matchedStatuses: s.Invoice["status"][] = ["matched", "approved", "paid"];
    const [row] = await db
      .insert(s.invoices)
      .values({
        invoiceNumber: inv.number,
        vendorId: po.vendorId,
        poId,
        status: inv.status,
        ...totals,
        issuedAt: iso(issued),
        dueAt: iso(daysAgo(inv.ageDays - 30)),
        receivedAt: inv.status === "draft" ? null : issued,
        matchedAt: matchedStatuses.includes(inv.status) ? daysAgo(inv.ageDays - 2) : null,
        paidAt: inv.status === "paid" ? daysAgo(inv.ageDays - 25) : null,
        match: inv.status === "draft" ? null : {
          poMatch: true,
          receiptMatch: inv.number !== "ARC-2026-1302" && inv.status !== "received",
          priceMatch: !inv.variance || inv.variance <= 0.02,
          qtyMatch: inv.number !== "ARC-2026-1302",
          variance: Math.round((totals.total - po.total) * 100) / 100,
          notes: inv.note ? [inv.note] : [],
          checkedAt: issued.toISOString(),
        },
        notes: inv.note ?? "",
        createdBy: userIds.finance,
        createdAt: issued,
        updatedAt: issued,
      })
      .returning();
    await db.insert(s.invoiceLines).values(lines.map((l) => ({ invoiceId: row.id, ...l, lineTotal: lineTotal(l.qty, l.unitCost) })));
    await db.insert(s.poEvents).values({ poId, type: "invoice_linked", actorType: "user", actorId: userIds.finance, actorLabel: names.finance, message: `Invoice ${inv.number} linked`, createdAt: issued });
  }

  // Default scheduled tasks (disabled until an admin enables them)
  const existingTasks = await db.select({ n: sql<number>`count(*)` }).from(s.scheduledTasks);
  if (Number(existingTasks[0].n) === 0) {
    await db.insert(s.scheduledTasks).values([
      { name: "Low-stock scan", kind: "low_stock_scan", cronExpr: "0 8 * * 1-5", enabled: true, createdBy: userIds.admin },
      { name: "Overdue invoice reminder", kind: "overdue_invoice_reminder", cronExpr: "0 9 * * 1", enabled: true, createdBy: userIds.admin },
      { name: "Daily digest", kind: "daily_digest", cronExpr: "30 8 * * 1-5", enabled: false, createdBy: userIds.admin },
      { name: "Webhook retry sweep", kind: "webhook_retry", cronExpr: "*/15 * * * *", enabled: true, createdBy: userIds.admin },
      { name: "Reorder agent", kind: "reorder_agent", cronExpr: "0 7 * * 1", enabled: false, createdBy: userIds.admin },
      { name: "Asana sync", kind: "asana_sync", cronExpr: "*/30 * * * *", enabled: false, createdBy: userIds.admin },
    ]);
  }

  // Example webhook endpoint (mock URL so it never leaves the box)
  await db
    .insert(s.webhookEndpoints)
    .values({ name: "Example: ops notifier (mock)", url: "mock://ops-notifier", secretCiphertext: encrypt("whsec_example_do_not_use"), events: ["po.submitted", "po.approved", "stock.low"], enabled: false, inboundKey: "example-inbound-key", createdBy: userIds.admin })
    .onConflictDoNothing();

  console.log("\nSeed complete. Sign in with any of these (password: %s):", SEED_PASSWORD);
  for (const u of USERS) console.log(`  ${u.role.padEnd(12)} ${u.email}`);
  console.log("Admin logins (password: %s): admin1@kacific.com … admin6@kacific.com", ADMIN_PASSWORD);
  console.log("Department logins (password: %s): sales@kacific.com, procurement@kacific.com, operations@kacific.com", ADMIN_PASSWORD);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
