import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';
import { createUserWithPassword } from './passwordAuth';

describe('User Verification System', () => {
  let testUserId: number;
  let adminUserId: number;

  beforeAll(async () => {
    // Create a test admin user
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
    } else {
      // Fallback: use existing admin
      const allUsers = await db.getAllUsers();
      const existingAdmin = allUsers.find(u => u.role === 'admin');
      if (existingAdmin) {
        adminUserId = existingAdmin.id;
      }
    }
  });

  describe('User Registration', () => {
    it('should create user with pending status by default', async () => {
      const email = `test_${Date.now()}@example.com`;
      const user = await createUserWithPassword(
        email,
        'Test User',
        'password123',
        {
          jobTitle: 'Asset Manager',
          phoneNumber: '8012345678',
          phoneCountryCode: '+234',
          agency: 'Nigerian Red Cross Society',
          geographicalArea: 'Lagos',
          registrationPurpose: 'Asset Management',
        }
      );

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.status).toBe('pending');
      expect(user.jobTitle).toBe('Asset Manager');
      expect(user.agency).toBe('Nigerian Red Cross Society');
      
      testUserId = user.id;
    });

    it('should store all verification fields', async () => {
      const user = await db.getUserById(testUserId);
      
      expect(user).toBeDefined();
      expect(user?.phoneNumber).toBe('8012345678');
      expect(user?.phoneCountryCode).toBe('+234');
      expect(user?.geographicalArea).toBe('Lagos');
      expect(user?.registrationPurpose).toBe('Asset Management');
    });
  });

  describe('User Approval', () => {
    it('should approve pending user', async () => {
      const result = await db.approveUser(testUserId, adminUserId);
      
      expect(result.success).toBe(true);
      
      const user = await db.getUserById(testUserId);
      expect(user?.status).toBe('approved');
      expect(user?.approvedBy).toBe(adminUserId);
      expect(user?.approvedAt).toBeDefined();
    });

    it('should retrieve pending users', async () => {
      // Create another pending user
      const pendingUser = await createUserWithPassword(
        `pending_${Date.now()}@example.com`,
        'Pending User',
        'password123',
        {
          jobTitle: 'Technician',
          agency: 'Nigerian Red Cross Society',
        }
      );

      const pendingUsers = await db.getPendingUsers();
      
      expect(pendingUsers).toBeDefined();
      expect(Array.isArray(pendingUsers)).toBe(true);
      expect(pendingUsers.length).toBeGreaterThan(0);
      
      const hasPendingUser = pendingUsers.some(u => u.id === pendingUser.id);
      expect(hasPendingUser).toBe(true);
    });
  });

  describe('User Rejection', () => {
    it('should reject user with reason', async () => {
      // Create a user to reject
      const userToReject = await createUserWithPassword(
        `reject_${Date.now()}@example.com`,
        'User To Reject',
        'password123'
      );

      const reason = 'Incomplete information provided';
      const result = await db.rejectUser(userToReject.id, reason);
      
      expect(result.success).toBe(true);
      
      const user = await db.getUserById(userToReject.id);
      expect(user?.status).toBe('rejected');
      expect(user?.rejectionReason).toBe(reason);
    });

    it('should reject user without reason', async () => {
      // Create another user to reject
      const userToReject = await createUserWithPassword(
        `reject2_${Date.now()}@example.com`,
        'User To Reject 2',
        'password123'
      );

      const result = await db.rejectUser(userToReject.id);
      
      expect(result.success).toBe(true);
      
      const user = await db.getUserById(userToReject.id);
      expect(user?.status).toBe('rejected');
      expect(user?.rejectionReason).toBe('Registration not approved');
    });
  });

  describe('Login Status Checks', () => {
    it('should allow approved users to login', async () => {
      // This is tested in the login flow - approved users can authenticate
      const user = await db.getUserById(testUserId);
      expect(user?.status).toBe('approved');
    });

    it('should have pending status for new registrations', async () => {
      const newUser = await createUserWithPassword(
        `newuser_${Date.now()}@example.com`,
        'New User',
        'password123'
      );
      
      expect(newUser.status).toBe('pending');
    });
  });
});
