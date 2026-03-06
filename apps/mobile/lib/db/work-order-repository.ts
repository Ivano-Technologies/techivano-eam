import { getDb } from "./init";

export interface WorkOrderRow {
  id: string;
  tenant_id: string;
  technician_id: string;
  asset_id: string | null;
  title: string;
  status: "open" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  scheduled_for: string | null;
  due_date: string | null;
  qr_payload: string | null;
  signature: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: "pending" | "synced";
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function listWorkOrders(technicianId: string): WorkOrderRow[] {
  const db = getDb();
  return db.getAllSync<WorkOrderRow>(
    "select * from work_orders where technician_id = ? order by updated_at desc",
    [technicianId],
  );
}

export function createWorkOrder(input: {
  tenantId: string;
  technicianId: string;
  title: string;
  assetId?: string | null;
  priority?: "low" | "medium" | "high";
  scheduledFor?: string | null;
  dueDate?: string | null;
  qrPayload?: string | null;
  notes?: string | null;
}): WorkOrderRow {
  const db = getDb();
  const id = uuid();
  const ts = new Date().toISOString();
  db.runSync(
    `insert into work_orders (
      id, tenant_id, technician_id, asset_id, title, status, priority,
      scheduled_for, due_date, qr_payload, signature, notes, created_at, updated_at, sync_status
    ) values (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, null, ?, ?, ?, 'pending')`,
    [
      id,
      input.tenantId,
      input.technicianId,
      input.assetId ?? null,
      input.title,
      input.priority ?? "medium",
      input.scheduledFor ?? null,
      input.dueDate ?? null,
      input.qrPayload ?? null,
      input.notes ?? null,
      ts,
      ts,
    ],
  );
  return getWorkOrderById(id)!;
}

export function getWorkOrderById(id: string): WorkOrderRow | null {
  const db = getDb();
  const rows = db.getAllSync<WorkOrderRow>(
    "select * from work_orders where id = ? limit 1",
    [id],
  );
  return rows[0] ?? null;
}

export function updateWorkOrderStatus(
  id: string,
  status: WorkOrderRow["status"],
  signature?: string,
): WorkOrderRow | null {
  const db = getDb();
  db.runSync(
    "update work_orders set status = ?, signature = coalesce(?, signature), updated_at = ?, sync_status = 'pending' where id = ?",
    [status, signature ?? null, new Date().toISOString(), id],
  );
  return getWorkOrderById(id);
}

export function addWorkOrderPhoto(
  workOrderId: string,
  localUri: string,
): { id: string; work_order_id: string; local_uri: string } {
  const db = getDb();
  const id = uuid();
  db.runSync(
    "insert into work_order_photos (id, work_order_id, local_uri) values (?, ?, ?)",
    [id, workOrderId, localUri],
  );
  return { id, work_order_id: workOrderId, local_uri: localUri };
}

export function listWorkOrderPhotos(workOrderId: string) {
  const db = getDb();
  return db.getAllSync<{ id: string; local_uri: string; uploaded_url: string | null }>(
    "select id, local_uri, uploaded_url from work_order_photos where work_order_id = ? order by created_at desc",
    [workOrderId],
  );
}
