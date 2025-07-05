import { UserRole } from "../enums/user-roles.enum";
import { UserStatus } from "../enums/user-status.enum";

export interface IUserFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  email_verified?: boolean;
}
