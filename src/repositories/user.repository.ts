import { Service } from "typedi";
import { BaseRepository } from "./base.repository";
import { IUserEntity } from "../models/entities/user.entity";
import { IUserFilters } from "../models/interfaces/user.interface";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { IPaginatedResult } from "../types/database.types";

@Service()
export class UserRepository extends BaseRepository<IUserEntity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getModel(): any {
    return this.prisma.user;
  }

  // Override create method to properly map the result
  async create(
    data: Omit<
      IUserEntity,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "fullName"
      | "isActive"
      | "isAdmin"
      | "isModerator"
      | "hasRole"
      | "hasAnyRole"
    >,
  ): Promise<IUserEntity> {
    const user = await this.prisma.user.create({
      data: {
        ...data,
        deletedAt: null,
      },
    });
    return this.mapToUserEntity(user);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToUserEntity(user: any): IUserEntity {
    return {
      ...user,
      get fullName(): string {
        return `${user.firstName} ${user.lastName}`;
      },
      isActive(): boolean {
        return user.status === UserStatus.Active;
      },
      isAdmin(): boolean {
        return user.role === UserRole.Admin;
      },
      isModerator(): boolean {
        return user.role === UserRole.Moderator;
      },
      hasRole(role: UserRole): boolean {
        return user.role === role;
      },
      hasAnyRole(...roles: UserRole[]): boolean {
        return roles.includes(user.role);
      },
    };
  }

  async findById(id: string): Promise<IUserEntity | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
    return user ? this.mapToUserEntity(user) : null;
  }

  async findByEmail(email: string): Promise<IUserEntity | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
    return user ? this.mapToUserEntity(user) : null;
  }

  async findUsersPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: IUserFilters,
  ): Promise<IPaginatedResult<IUserEntity>> {
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (filters?.role) {
      where.role = filters.role;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.emailVerified !== undefined) {
      where.emailVerified = filters.emailVerified;
    }
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((user) => this.mapToUserEntity(user)),
      pagination: {
        page,
        limit,
        total,
        hasNext: skip + limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        lastLogin: new Date(),
      },
    });
  }

  async isEmailUnique(email: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, unknown> = {
      email,
      deletedAt: null,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.user.count({ where });
    return count === 0;
  }

  async findByRole(role: UserRole): Promise<IUserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    return users.map((user) => this.mapToUserEntity(user));
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<IUserEntity | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        stripeCustomerId,
        deletedAt: null,
      },
    });
    return user ? this.mapToUserEntity(user) : null;
  }

  async findByStatus(status: UserStatus): Promise<IUserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: {
        status,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    return users.map((user) => this.mapToUserEntity(user));
  }

  async countByRole(role: UserRole): Promise<number> {
    return await this.prisma.user.count({
      where: {
        role,
        deletedAt: null,
      },
    });
  }

  async countByStatus(status: UserStatus): Promise<number> {
    return await this.prisma.user.count({
      where: {
        status,
        deletedAt: null,
      },
    });
  }

  async updateEmailVerification(id: string, verified: boolean): Promise<void> {
    await this.prisma.user.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        emailVerified: verified,
      },
    });
  }

  async findUnverifiedUsers(olderThanDays: number = 7): Promise<IUserEntity[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const users = await this.prisma.user.findMany({
      where: {
        emailVerified: false,
        deletedAt: null,
        createdAt: {
          lt: cutoffDate,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return users.map((user) => this.mapToUserEntity(user));
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        passwordHash,
      },
    });
  }

  async updateEmailVerified(id: string, emailVerified: boolean): Promise<void> {
    await this.prisma.user.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        emailVerified,
      },
    });
  }
}
