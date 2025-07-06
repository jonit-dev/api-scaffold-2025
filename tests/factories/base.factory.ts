import { IBaseEntity } from "@common-types/database.types";

export class BaseFactory {
  static createBaseEntity(overrides: Partial<IBaseEntity> = {}): IBaseEntity {
    return {
      id: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: "2023-01-01T00:00:00.000Z",
      updatedAt: "2023-01-01T00:00:00.000Z",
      deletedAt: undefined,
      ...overrides,
    };
  }

  static createDeletedEntity(
    overrides: Partial<IBaseEntity> = {},
  ): IBaseEntity {
    return this.createBaseEntity({
      deletedAt: "2023-01-02T00:00:00.000Z",
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
        createdAt: `2023-01-0${index + 1}T00:00:00.000Z`,
        updatedAt: `2023-01-0${index + 1}T00:00:00.000Z`,
        ...overrides,
      }),
    );
  }
}
