import type { Entity } from "./types";

export const customerMetricFields = [
  ["customerIds", "Customer"],
  ["customerCount", "Customer count"],
  ["customerRequestCount", "Request count"],
  ["customerTier", "Customer tier"],
  ["customerStatus", "Customer status"],
  ["customerRevenue", "Total customer revenue"],
  ["customerSize", "Total customer size"],
  ["customerImportantCount", "Important customer count"],
  ["customerOwnerIds", "Customer owner"],
  ["customerRevenueValues", "Customer revenue"],
  ["customerSizeValues", "Customer size"],
  ["customerImportant", "Important to customer"],
] as const;
export type CustomerMetrics = {
  customerIds: (string|null)[];
  customerCount: number;
  customerRequestCount: number;
  customerTier: string[];
  customerStatus: string[];
  customerRevenue: number;
  customerSize: number;
  customerImportant: boolean;
  customerImportantCount:number;
  customerOwnerIds:(string|null)[];
  customerRevenueValues:number[];
  customerSizeValues:number[];
};
export function buildCustomerMetrics(
  customers: Entity[],
  requests: Entity[],
  kind: "issues" | "projects",
  entities: Entity[] = [],
): Map<string, CustomerMetrics> {
  const customersById = new Map(
    customers
      .filter((c) => !c.deletedAt && !c.archivedAt)
      .map((c) => [c.id, c]),
  );
  const linked = new Map<
    string,
    { ids: Set<string>; requests: number; important: boolean; importantIds:Set<string>; unknown:boolean }
  >();
  const get = (id: string) => {
    let value = linked.get(id);
    if (!value) {
      value = { ids: new Set(), requests: 0, important: false, importantIds:new Set(), unknown:false };
      linked.set(id, value);
    }
    return value;
  };
  for (const request of requests) {
    if (
      request.deletedAt ||
      request.archivedAt ||
      (request.customerId!=null&&!customersById.has(request.customerId))
    )
      continue;
    const id = kind === "issues" ? request.issueId : request.projectId;
    if (!id) continue;
    const value = get(id);
    if(request.customerId==null){value.unknown=true;value.requests++;continue;}
    value.ids.add(request.customerId);
    value.requests++;
    value.important ||= !!request.important;
    if(request.important)value.importantIds.add(request.customerId);
  }
  for (const entity of entities)
    if (entity.customerId && customersById.has(entity.customerId))
      get(entity.id).ids.add(entity.customerId);
  const result = new Map<string, CustomerMetrics>();
  for (const [id, value] of linked) {
    const items = [...value.ids].map((id) => customersById.get(id)!);
    result.set(id, {
      customerIds: [...value.ids,...(value.unknown?[null]:[])],
      customerCount: items.length,
      customerRequestCount: value.requests,
      customerTier: [...new Set(items.map((c) => c.tier).filter(Boolean))],
      customerStatus: [...new Set(items.map((c) => c.status).filter(Boolean))],
      customerRevenue: items.reduce(
        (sum, c) => sum + (Number(c.revenue) || 0),
        0,
      ),
      customerSize: items.reduce((sum, c) => sum + (Number(c.size) || 0), 0),
      customerImportant: value.important,
      customerImportantCount:value.importantIds.size,
      customerOwnerIds:[...new Set(items.map(c=>c.ownerId??null))],
      customerRevenueValues:items.filter(c=>c.revenue!=null).map(c=>Number(c.revenue)).filter(Number.isFinite),
      customerSizeValues:items.filter(c=>c.size!=null).map(c=>Number(c.size)).filter(Number.isFinite),
    });
  }
  return result;
}
const empty: CustomerMetrics = {
  customerIds: [],
  customerCount: 0,
  customerRequestCount: 0,
  customerTier: [],
  customerStatus: [],
  customerRevenue: 0,
  customerSize: 0,
  customerImportant: false,
  customerImportantCount:0,
  customerOwnerIds:[],
  customerRevenueValues:[],
  customerSizeValues:[],
};
export function withCustomerMetrics<T extends Entity>(
  entity: T,
  metrics: Map<string, CustomerMetrics>,
): T & CustomerMetrics {
  return { ...entity, ...(metrics.get(entity.id) ?? empty) };
}
export function usesCustomerMetrics(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(usesCustomerMetrics);
  if (!value || typeof value !== "object")
    return (
      typeof value === "string" &&
      customerMetricFields.some(([field]) => field === value)
    );
  return Object.entries(value).some(
    ([key, v]) =>
      customerMetricFields.some(([field]) => field === key) ||
      usesCustomerMetrics(v),
  );
}
