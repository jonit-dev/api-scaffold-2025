import { BaseEntity as IBaseEntity } from '../../types/database.types';

export interface BaseEntity extends IBaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export abstract class BaseEntityModel implements BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  constructor(data: Partial<BaseEntity>) {
    this.id = data.id || '';
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
    this.deleted_at = data.deleted_at;
  }

  // Check if entity is soft deleted
  get isDeleted(): boolean {
    return this.deleted_at !== null && this.deleted_at !== undefined;
  }

  // Mark entity as deleted
  markAsDeleted(): void {
    this.deleted_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  // Restore soft deleted entity
  restore(): void {
    this.deleted_at = undefined;
    this.updated_at = new Date().toISOString();
  }

  // Update the updated_at timestamp
  touch(): void {
    this.updated_at = new Date().toISOString();
  }

  // Convert to plain object for database operations
  toPlainObject(): Record<string, any> {
    return {
      id: this.id,
      created_at: this.created_at,
      updated_at: this.updated_at,
      deleted_at: this.deleted_at
    };
  }
}

export default BaseEntity;