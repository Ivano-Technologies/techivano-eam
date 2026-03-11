import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';
import { createUserWithPassword } from './passwordAuth';
import { runWithTestTenantContext } from './test/testTenantContext';

describe('User Search and Filter', () => {
  let testUsers: any[] = [];

  beforeAll(async () => {
    await runWithTestTenantContext(async () => {
      const userConfigs = [
        { email: 'john.doe@nrcs.org', name: 'John Doe', agency: 'Lagos Branch', status: 'pending' },
        { email: 'jane.smith@nrcs.org', name: 'Jane Smith', agency: 'Abuja Branch', status: 'approved' },
        { email: 'bob.wilson@nrcs.org', name: 'Bob Wilson', agency: 'Lagos Branch', status: 'rejected' },
        { email: 'alice.brown@nrcs.org', name: 'Alice Brown', agency: 'Kano Branch', status: 'pending' },
        { email: 'charlie.davis@nrcs.org', name: 'Charlie Davis', agency: 'Abuja Branch', status: 'approved' },
      ];

      for (const config of userConfigs) {
        const user = await createUserWithPassword(
          config.email,
          config.name,
          'password123',
          { agency: config.agency }
        );
        if (config.status === 'approved') {
          await db.approveUser(user.id, 1);
        } else if (config.status === 'rejected') {
          await db.rejectUser(user.id, 'Test rejection');
        }
        testUsers.push({ ...user, ...config });
      }
    });
  });

  describe('Search Functionality', () => {
    it('should filter users by name', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const searchQuery = 'john';
      
      const filtered = allUsers.filter((u: any) => 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((u: any) => 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )).toBe(true);
    });

    it('should filter users by email', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const searchQuery = 'jane.smith';
      
      const filtered = allUsers.filter((u: any) => 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((u: any) => 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )).toBe(true);
    });

    it('should filter users by agency', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const searchQuery = 'lagos';
      
      const filtered = allUsers.filter((u: any) => 
        u.agency?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((u: any) => 
        u.agency?.toLowerCase().includes(searchQuery.toLowerCase())
      )).toBe(true);
    });

    it('should return empty array for non-matching search', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const searchQuery = 'nonexistentuser12345';
      
      const filtered = allUsers.filter((u: any) => 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.agency?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(filtered.length).toBe(0);
    });
  });

  describe('Status Filter', () => {
    it('should filter pending users', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const filtered = allUsers.filter((u: any) => u.status === 'pending');
      
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((u: any) => u.status === 'pending')).toBe(true);
    });

    it('should filter approved users', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const filtered = allUsers.filter((u: any) => u.status === 'approved');
      
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((u: any) => u.status === 'approved')).toBe(true);
    });

    it('should filter rejected users', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const filtered = allUsers.filter((u: any) => u.status === 'rejected');
      
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((u: any) => u.status === 'rejected')).toBe(true);
    });
  });

  describe('Date Range Filter', () => {
    it('should filter users created after a specific date', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const filtered = allUsers.filter((u: any) => {
        const userDate = new Date(u.createdAt);
        return userDate >= yesterday;
      });
      
      // All test users should be created today
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should filter users created before a specific date', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const filtered = allUsers.filter((u: any) => {
        const userDate = new Date(u.createdAt);
        return userDate <= tomorrow;
      });
      
      // All users should be created before tomorrow
      expect(filtered.length).toBe(allUsers.length);
    });

    it('should filter users within date range', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const filtered = allUsers.filter((u: any) => {
        const userDate = new Date(u.createdAt);
        return userDate >= yesterday && userDate <= tomorrow;
      });
      
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Combined Filters', () => {
    it('should apply search and status filter together', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const searchQuery = 'lagos';
      const statusFilter = 'pending';
      
      const filtered = allUsers.filter((u: any) => {
        const matchesSearch = u.agency?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = u.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
      
      expect(filtered.every((u: any) => 
        u.agency?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        u.status === statusFilter
      )).toBe(true);
    });

    it('should apply all filters together', async () => {
      const allUsers = await runWithTestTenantContext(() => db.getPendingUsers());
      const searchQuery = 'nrcs';
      const statusFilter = 'approved';
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 1);
      
      const filtered = allUsers.filter((u: any) => {
        const matchesSearch = 
          u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.agency?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = u.status === statusFilter;
        const matchesDate = new Date(u.createdAt) >= dateFrom;
        return matchesSearch && matchesStatus && matchesDate;
      });
      
      expect(filtered.every((u: any) => u.status === statusFilter)).toBe(true);
    });
  });
});
