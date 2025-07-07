import { describe, it, expect } from "vitest";
import { UserEntity } from "../entities/user.entity";
import { UserRole } from "../enums/user-roles.enum";
import { UserStatus } from "../enums/user-status.enum";
import { AuthFactory } from "../../../tests/factories/auth.factory";

describe("UserEntity - Status Consistency", () => {
  describe("isEmailVerified computed property", () => {
    it("should return true when UserStatus is Active", () => {
      // Arrange
      const userData = AuthFactory.createTestUser({
        status: UserStatus.Active,
      });

      const user = new UserEntity(userData);

      // Act & Assert
      expect(user.isEmailVerified).toBe(true);
    });

    it("should return true when UserStatus is Suspended", () => {
      // Arrange
      const userData = AuthFactory.createTestUser({
        status: UserStatus.Suspended,
      });

      const user = new UserEntity(userData);

      // Act & Assert
      expect(user.isEmailVerified).toBe(true);
    });

    it("should return true when UserStatus is Inactive", () => {
      // Arrange
      const userData = AuthFactory.createTestUser({
        status: UserStatus.Inactive,
      });

      const user = new UserEntity(userData);

      // Act & Assert
      expect(user.isEmailVerified).toBe(true);
    });

    it("should return false when UserStatus is PendingVerification", () => {
      // Arrange
      const userData = AuthFactory.createTestUser({
        status: UserStatus.PendingVerification,
      });

      const user = new UserEntity(userData);

      // Act & Assert
      expect(user.isEmailVerified).toBe(false);
    });
  });

  describe("UserStatus-based verification logic", () => {
    it("should rely only on UserStatus for verification state", () => {
      // This test ensures we don't have any separate email_verified field
      // that could cause inconsistency

      // Arrange
      const userData = AuthFactory.createTestUser({
        status: UserStatus.PendingVerification,
      });

      const user = new UserEntity(userData);

      // Act & Assert
      // The user should be considered unverified based solely on UserStatus
      expect(user.isEmailVerified).toBe(false);
      expect(user.isActive()).toBe(false);

      // Verify that the interface doesn't have a separate emailVerified field
      // This is a type-level test to ensure we removed any conflicting fields
      expect(user).not.toHaveProperty("emailVerified");
    });

    it("should correctly determine active status based on UserStatus", () => {
      // Arrange - Active user
      const activeUserData = AuthFactory.createTestUser({
        status: UserStatus.Active,
      });

      const activeUser = new UserEntity(activeUserData);

      // Arrange - Pending user
      const pendingUserData = AuthFactory.createTestUser({
        status: UserStatus.PendingVerification,
      });

      const pendingUser = new UserEntity(pendingUserData);

      // Act & Assert
      expect(activeUser.isActive()).toBe(true);
      expect(activeUser.isEmailVerified).toBe(true);

      expect(pendingUser.isActive()).toBe(false);
      expect(pendingUser.isEmailVerified).toBe(false);
    });

    it("should handle suspended users correctly", () => {
      // Arrange
      const suspendedUserData = AuthFactory.createTestUser({
        status: UserStatus.Suspended,
      });

      const suspendedUser = new UserEntity(suspendedUserData);

      // Act & Assert
      expect(suspendedUser.isActive()).toBe(false); // Suspended users are not active
      expect(suspendedUser.isEmailVerified).toBe(true); // But they are verified
      expect(suspendedUser.isSuspended).toBe(true);
    });
  });

  describe("Email unsubscribe status", () => {
    it("should correctly track email subscription status", () => {
      // Arrange - Subscribed user
      const subscribedUserData = AuthFactory.createTestUser({
        emailUnsubscribed: false,
      });

      const subscribedUser = new UserEntity(subscribedUserData);

      // Arrange - Unsubscribed user
      const unsubscribedUserData = AuthFactory.createTestUser({
        emailUnsubscribed: true,
      });

      const unsubscribedUser = new UserEntity(unsubscribedUserData);

      // Act & Assert
      expect(subscribedUser.isEmailUnsubscribed).toBe(false);
      expect(unsubscribedUser.isEmailUnsubscribed).toBe(true);
    });

    it("should maintain email subscription status independently of verification status", () => {
      // Arrange - Unverified but subscribed user
      const unverifiedSubscribedData = AuthFactory.createTestUser({
        status: UserStatus.PendingVerification,
        emailUnsubscribed: false,
      });

      const unverifiedSubscribedUser = new UserEntity(unverifiedSubscribedData);

      // Arrange - Verified but unsubscribed user
      const verifiedUnsubscribedData = AuthFactory.createTestUser({
        status: UserStatus.Active,
        emailUnsubscribed: true,
      });

      const verifiedUnsubscribedUser = new UserEntity(verifiedUnsubscribedData);

      // Act & Assert
      expect(unverifiedSubscribedUser.isEmailVerified).toBe(false);
      expect(unverifiedSubscribedUser.isEmailUnsubscribed).toBe(false);

      expect(verifiedUnsubscribedUser.isEmailVerified).toBe(true);
      expect(verifiedUnsubscribedUser.isEmailUnsubscribed).toBe(true);
    });
  });
});
