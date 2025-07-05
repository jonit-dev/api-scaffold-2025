import { UserRole, UserStatus } from "../enums";

export interface IUserFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  email_verified?: boolean;
}
