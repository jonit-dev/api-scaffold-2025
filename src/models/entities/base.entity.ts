import { IBaseEntity as IBaseEntityType } from "../../types/database.types";

export interface IBaseEntity extends IBaseEntityType {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export abstract class BaseEntityModel implements IBaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  constructor(data: Partial<IBaseEntity>) {
    this.id = data.id || "";
    const now = new Date().toISOString();
    this.created_at = data.created_at || now;
    this.updated_at = data.updated_at || now;
    this.deleted_at = data.deleted_at;
    this.createdAt = this.created_at;
    this.updatedAt = this.updated_at;
    this.deletedAt = this.deleted_at;
  }

  // Check if entity is soft deleted
  get isDeleted(): boolean {
    return this.deleted_at !== null && this.deleted_at !== undefined;
  }

  // Mark entity as deleted
  markAsDeleted(): void {
    const now = new Date().toISOString();
    this.deleted_at = now;
    this.deletedAt = now;
    this.updated_at = now;
    this.updatedAt = now;
  }

  // Restore soft deleted entity
  restore(): void {
    this.deleted_at = undefined;
    this.deletedAt = undefined;
    const now = new Date().toISOString();
    this.updated_at = now;
    this.updatedAt = now;
  }

  // Update the updated_at timestamp
  touch(): void {
    const now = new Date().toISOString();
    this.updated_at = now;
    this.updatedAt = now;
  }

  // Convert to plain object for database operations
  toPlainObject(): Record<string, unknown> {
    return {
      id: this.id,
      created_at: this.created_at,
      updated_at: this.updated_at,
      deleted_at: this.deleted_at,
    };
  }
}

export default IBaseEntity;
