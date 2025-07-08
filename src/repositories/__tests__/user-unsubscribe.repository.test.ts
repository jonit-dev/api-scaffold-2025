import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Container } from "typedi";
import { UserRepository } from "../user.repository";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";
import { PrismaClient } from "../../../node_modules/.prisma/test-client";

describe("UserRepository - Email Unsubscribe Functionality", () => {
  let userRepository: UserRepository;
  let prisma: PrismaClient;
  let testUsers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
    emailUnsubscribed: boolean;
  }>;

  beforeEach(async () => {
    prisma = Container.get("prisma") as PrismaClient;

    // Create a real UserRepository instance for integration testing
    // This bypasses the mock and uses the actual repository with test database
    userRepository = new UserRepository();

    // Create test users
    testUsers = [
      {
        id: "user1",
        email: "user1@test.com",
        firstName: "User",
        lastName: "One",
        passwordHash: "hash1",
        role: UserRole.User,
        status: UserStatus.Active,
        emailUnsubscribed: false,
      },
      {
        id: "user2",
        email: "user2@test.com",
        firstName: "User",
        lastName: "Two",
        passwordHash: "hash2",
        role: UserRole.User,
        status: UserStatus.Active,
        emailUnsubscribed: true,
      },
      {
        id: "user3",
        email: "user3@test.com",
        firstName: "User",
        lastName: "Three",
        passwordHash: "hash3",
        role: UserRole.User,
        status: UserStatus.PendingVerification,
        emailUnsubscribed: false,
      },
      {
        id: "user4",
        email: "user4@test.com",
        firstName: "User",
        lastName: "Four",
        passwordHash: "hash4",
        role: UserRole.User,
        status: UserStatus.Active,
        emailUnsubscribed: true,
      },
    ];

    // Insert test users
    for (const userData of testUsers) {
      await prisma.user.create({
        data: userData,
      });
    }
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: testUsers.map((user) => user.email),
        },
      },
    });
  });

  describe("findUnsubscribedUsers", () => {
    it("should return only unsubscribed users from the provided email list", async () => {
      // Arrange
      const emailList = [
        "user1@test.com",
        "user2@test.com",
        "user3@test.com",
        "user4@test.com",
      ];

      // Act
      const unsubscribedUsers =
        await userRepository.findUnsubscribedUsers(emailList);

      // Assert
      expect(unsubscribedUsers).toHaveLength(2);
      expect(unsubscribedUsers.map((user) => user.email)).toEqual(
        expect.arrayContaining(["user2@test.com", "user4@test.com"]),
      );

      // Verify all returned users have emailUnsubscribed = true
      unsubscribedUsers.forEach((user) => {
        expect(user.emailUnsubscribed).toBe(true);
      });
    });

    it("should return empty array when no emails are unsubscribed", async () => {
      // Arrange
      const emailList = ["user1@test.com", "user3@test.com"];

      // Act
      const unsubscribedUsers =
        await userRepository.findUnsubscribedUsers(emailList);

      // Assert
      expect(unsubscribedUsers).toHaveLength(0);
    });

    it("should return empty array when provided email list is empty", async () => {
      // Arrange
      const emailList: string[] = [];

      // Act
      const unsubscribedUsers =
        await userRepository.findUnsubscribedUsers(emailList);

      // Assert
      expect(unsubscribedUsers).toHaveLength(0);
    });

    it("should handle non-existent emails gracefully", async () => {
      // Arrange
      const emailList = [
        "user2@test.com", // exists and unsubscribed
        "nonexistent@test.com", // doesn't exist
        "user1@test.com", // exists but subscribed
      ];

      // Act
      const unsubscribedUsers =
        await userRepository.findUnsubscribedUsers(emailList);

      // Assert
      expect(unsubscribedUsers).toHaveLength(1);
      expect(unsubscribedUsers[0].email).toBe("user2@test.com");
    });

    it("should not return deleted users", async () => {
      // Arrange
      // Mark user2 as deleted
      await prisma.user.update({
        where: { email: "user2@test.com" },
        data: { deletedAt: new Date() },
      });

      const emailList = ["user2@test.com", "user4@test.com"];

      // Act
      const unsubscribedUsers =
        await userRepository.findUnsubscribedUsers(emailList);

      // Assert
      expect(unsubscribedUsers).toHaveLength(1);
      expect(unsubscribedUsers[0].email).toBe("user4@test.com");
    });
  });

  describe("updateEmailUnsubscribed", () => {
    it("should update user email subscription status to unsubscribed", async () => {
      // Arrange
      const user = await prisma.user.findUnique({
        where: { email: "user1@test.com" },
      });
      expect(user?.emailUnsubscribed || false).toBe(false);

      // Act
      await userRepository.updateEmailUnsubscribed(user!.id, true);

      // Assert
      const updatedUser = await prisma.user.findUnique({
        where: { email: "user1@test.com" },
      });
      expect(updatedUser?.emailUnsubscribed).toBe(true);
    });

    it("should update user email subscription status to subscribed", async () => {
      // Arrange
      const user = await prisma.user.findUnique({
        where: { email: "user2@test.com" },
      });
      expect(user?.emailUnsubscribed).toBe(true);

      // Act
      await userRepository.updateEmailUnsubscribed(user!.id, false);

      // Assert
      const updatedUser = await prisma.user.findUnique({
        where: { email: "user2@test.com" },
      });
      expect(updatedUser?.emailUnsubscribed).toBe(false);
    });

    it("should not affect other user properties when updating email subscription", async () => {
      // Arrange
      const user = await prisma.user.findUnique({
        where: { email: "user1@test.com" },
      });
      const originalUpdatedAt = user?.updatedAt;

      // Act
      await userRepository.updateEmailUnsubscribed(user!.id, true);

      // Assert
      const updatedUser = await prisma.user.findUnique({
        where: { email: "user1@test.com" },
      });

      expect(updatedUser?.emailUnsubscribed).toBe(true);
      expect(updatedUser?.firstName).toBe(user?.firstName);
      expect(updatedUser?.lastName).toBe(user?.lastName);
      expect(updatedUser?.email).toBe(user?.email);
      expect(updatedUser?.status).toBe(user?.status);
      expect(updatedUser?.role).toBe(user?.role);
      // updatedAt should be different
      expect(updatedUser?.updatedAt).not.toEqual(originalUpdatedAt);
    });
  });

  describe("User entity mapping with unsubscribe status", () => {
    it("should correctly map emailUnsubscribed property in user entities", async () => {
      // Act
      const subscribedUser = await userRepository.findByEmail("user1@test.com");
      const unsubscribedUser =
        await userRepository.findByEmail("user2@test.com");

      // Assert
      expect(subscribedUser?.emailUnsubscribed).toBe(false);

      expect(unsubscribedUser?.emailUnsubscribed).toBe(true);
    });

    it("should maintain email subscription status when creating users", async () => {
      // Arrange
      const newUserData = {
        email: "newuser@test.com",
        firstName: "New",
        lastName: "User",
        passwordHash: "newhash",
        role: UserRole.User,
        status: UserStatus.Active,
        emailUnsubscribed: true,
        deletedAt: null,
      };

      // Act
      const createdUser = await userRepository.create(newUserData);

      // Assert
      expect(createdUser.emailUnsubscribed).toBe(true);

      // Clean up
      await prisma.user.delete({
        where: { email: "newuser@test.com" },
      });
    });
  });
});
