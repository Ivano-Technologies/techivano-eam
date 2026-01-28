import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';
import { createUserWithPassword } from './passwordAuth';

describe('Bulk User Management', () => {
  let adminUserId: number;
  let testUserIds: number[] = [];

  beforeAll(async () => {
    // Get or create admin user
    const allUsers = await db.getAllUsers();
    const existingAdmin = allUsers.find(u => u.role === 'admin');
    if (existingAdmin) {
      adminUserId = existingAdmin.id;
    } else {
      const adminUser = await db.upsertUser({
        openId: `test_admin_${Date.now()}`,
        name: 'Test Admin',
        email: `admin_${Date.now()}@test.com`,
        role: 'admin',
        lastSignedIn: new Date(),
        status: 'approved',
      });
      if (adminUser) {
        adminUserId = adminUser.id;
      }
    }

    // Create test users for bulk operations
    for (let i = 0; i < 5; i++) {
      const user = await createUserWithPassword(
        `bulktest_${Date.now()}_${i}@example.com`,
        `Bulk Test User ${i}`,
        'password123',
        {
          jobTitle: 'Test Position',
          agency: 'Test Agency',
        }
      );
      testUserIds.push(user.id);
    }
  });

  describe('Bulk Approval', () => {
    it('should approve multiple users at once', async () => {
      const usersToApprove = testUserIds.slice(0, 3);
      const result = await db.bulkApproveUsers(usersToApprove, adminUserId);
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      
      // Verify all users are approved
      for (const userId of usersToApprove) {
        const user = await db.getUserById(userId);
        expect(user?.status).toBe('approved');
        expect(user?.approvedBy).toBe(adminUserId);
        expect(user?.approvedAt).toBeDefined();
      }
    });

    it('should handle empty array gracefully', async () => {
      const result = await db.bulkApproveUsers([], adminUserId);
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe('Bulk Rejection', () => {
    it('should reject multiple users at once with reason', async () => {
      const usersToReject = testUserIds.slice(3, 5);
      const reason = 'Bulk test rejection';
      const result = await db.bulkRejectUsers(usersToReject, reason);
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      
      // Verify all users are rejected
      for (const userId of usersToReject) {
        const user = await db.getUserById(userId);
        expect(user?.status).toBe('rejected');
        expect(user?.rejectionReason).toBe(reason);
      }
    });

    it('should reject users without reason', async () => {
      // Create new users for this test
      const newUsers = [];
      for (let i = 0; i < 2; i++) {
        const user = await createUserWithPassword(
          `bulkreject_${Date.now()}_${i}@example.com`,
          `Reject Test User ${i}`,
          'password123'
        );
        newUsers.push(user.id);
      }

      const result = await db.bulkRejectUsers(newUsers);
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      
      // Verify default reason is used
      for (const userId of newUsers) {
        const user = await db.getUserById(userId);
        expect(user?.status).toBe('rejected');
        expect(user?.rejectionReason).toBe('Registration not approved');
      }
    });

    it('should handle empty array gracefully', async () => {
      const result = await db.bulkRejectUsers([]);
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe('Mixed Operations', () => {
    it('should handle bulk operations on different user sets', async () => {
      // Create 6 new users
      const newUserIds = [];
      for (let i = 0; i < 6; i++) {
        const user = await createUserWithPassword(
          `mixed_${Date.now()}_${i}@example.com`,
          `Mixed Test User ${i}`,
          'password123'
        );
        newUserIds.push(user.id);
      }

      // Approve first 3
      const approveResult = await db.bulkApproveUsers(newUserIds.slice(0, 3), adminUserId);
      expect(approveResult.success).toBe(true);
      expect(approveResult.count).toBe(3);

      // Reject last 3
      const rejectResult = await db.bulkRejectUsers(newUserIds.slice(3, 6), 'Test rejection');
      expect(rejectResult.success).toBe(true);
      expect(rejectResult.count).toBe(3);

      // Verify statuses
      for (let i = 0; i < 3; i++) {
        const user = await db.getUserById(newUserIds[i]);
        expect(user?.status).toBe('approved');
      }
      
      for (let i = 3; i < 6; i++) {
        const user = await db.getUserById(newUserIds[i]);
        expect(user?.status).toBe('rejected');
      }
    });
  });

  describe('Pending Users Query', () => {
    it('should retrieve all users with various statuses', async () => {
      const pendingUsers = await db.getPendingUsers();
      
      expect(pendingUsers).toBeDefined();
      expect(Array.isArray(pendingUsers)).toBe(true);
      
      // Should include pending, approved, and rejected users
      const hasPending = pendingUsers.some(u => u.status === 'pending');
      const hasApproved = pendingUsers.some(u => u.status === 'approved');
      const hasRejected = pendingUsers.some(u => u.status === 'rejected');
      
      // At least one of these should be true based on our test data
      expect(hasPending || hasApproved || hasRejected).toBe(true);
    });
  });
});
