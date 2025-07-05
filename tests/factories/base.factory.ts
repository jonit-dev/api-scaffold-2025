import { IBaseEntity } from "@models/entities/base.entity";

export class BaseFactory {
  static createBaseEntity(overrides: Partial<IBaseEntity> = {}): IBaseEntity {
    return {
      id: "550e8400-e29b-41d4-a716-446655440000",
      created_at: "2023-01-01T00:00:00.000Z",
      updated_at: "2023-01-01T00:00:00.000Z",
      deleted_at: undefined,
      ...overrides,
    };
  }

  static createDeletedEntity(
    overrides: Partial<IBaseEntity> = {},
  ): IBaseEntity {
    return this.createBaseEntity({
      deleted_at: "2023-01-02T00:00:00.000Z",
      ...overrides,
    });
  }

  static createMultipleEntities(
    count: number,
    overrides: Partial<IBaseEntity> = {},
  ): IBaseEntity[] {
    return Array.from({ length: count }, (_, index) =>
      this.createBaseEntity({
        id: `550e8400-e29b-41d4-a716-44665544000${index}`,
        created_at: `2023-01-0${index + 1}T00:00:00.000Z`,
        updated_at: `2023-01-0${index + 1}T00:00:00.000Z`,
        ...overrides,
      }),
    );
  }
}
