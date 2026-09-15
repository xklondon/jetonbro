export const TABLE_STATUSES = ["SETUP", "ACTIVE", "ARCHIVED"] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];
