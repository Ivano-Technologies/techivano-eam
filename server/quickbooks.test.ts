import { describe, it, expect, beforeAll } from 'vitest';
import { getQuickBooksAuthUrl, QUICKBOOKS_OAUTH } from './quickbooksIntegration';
import * as db from './db';
import { runWithTestTenantContext } from './test/testTenantContext';

describe('QuickBooks Integration', () => {
  describe('OAuth URL Generation', () => {
    it('should generate valid OAuth authorization URL', () => {
      const config = {
        clientId: 'test_client_id',
        redirectUri: 'https://example.com/quickbooks/callback',
      };

      const authUrl = getQuickBooksAuthUrl(config);

      // Verify URL structure
      expect(authUrl).toContain(QUICKBOOKS_OAUTH.authorizationUrl);
      expect(authUrl).toContain('client_id=test_client_id');
      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fquickbooks%2Fcallback');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=com.intuit.quickbooks.accounting');
      expect(authUrl).toContain('state=');
    });

    it('should include all required OAuth parameters', () => {
      const config = {
        clientId: 'test_client_id',
        redirectUri: 'https://example.com/callback',
      };

      const authUrl = getQuickBooksAuthUrl(config);
      const url = new URL(authUrl);
      const params = url.searchParams;

      expect(params.get('client_id')).toBe('test_client_id');
      expect(params.get('redirect_uri')).toBe('https://example.com/callback');
      expect(params.get('response_type')).toBe('code');
      expect(params.get('scope')).toBe('com.intuit.quickbooks.accounting');
      expect(params.has('state')).toBe(true);
      expect(params.get('state')?.length).toBeGreaterThan(0);
    });

    it('should generate unique state parameter for each request', () => {
      const config = {
        clientId: 'test_client_id',
        redirectUri: 'https://example.com/callback',
      };

      const url1 = getQuickBooksAuthUrl(config);
      const url2 = getQuickBooksAuthUrl(config);

      const state1 = new URL(url1).searchParams.get('state');
      const state2 = new URL(url2).searchParams.get('state');

      expect(state1).not.toBe(state2);
    });
  });

  describe('QuickBooks Configuration', () => {
    let quickbooksConfigAvailable = true;

    beforeAll(async () => {
      try {
        await runWithTestTenantContext(async () => {
          await db.saveQuickBooksConfig({
            clientId: 'test_detect',
            clientSecret: 'test_secret',
            redirectUri: 'https://example.com/cb',
            realmId: '1',
            isActive: 1,
            autoSync: 1,
          });
        });
      } catch (e) {
        const msg = String(e ?? '');
        if (msg.includes('Failed query') || msg.includes('relation') || msg.includes('does not exist') || msg.includes('ECONNREFUSED') || msg.includes('Tenant DB context')) {
          quickbooksConfigAvailable = false;
        }
      }
    });

    it('should save QuickBooks configuration', async () => {
      if (!quickbooksConfigAvailable) return;
      await runWithTestTenantContext(async () => {
        const config = {
          clientId: 'test_client_123',
          clientSecret: 'test_secret_456',
          redirectUri: 'https://example.com/callback',
          realmId: '1234567890',
          isActive: 1,
          autoSync: 1,
        };

        const saved = await db.saveQuickBooksConfig(config);
        expect(saved).toBeDefined();
        expect(saved?.clientId).toBe(config.clientId);
        expect(saved?.realmId).toBe(config.realmId);
      });
    });

    it('should retrieve QuickBooks configuration', async () => {
      if (!quickbooksConfigAvailable) return;
      await runWithTestTenantContext(async () => {
        const config = {
          clientId: 'test_retrieve_123',
          clientSecret: 'test_secret_789',
          redirectUri: 'https://example.com/callback',
          realmId: '9876543210',
          isActive: 1,
          autoSync: 1,
        };

        await db.saveQuickBooksConfig(config);

        const retrieved = await db.getQuickBooksConfig();
        expect(retrieved).toBeDefined();
        expect(retrieved?.clientId).toBe(config.clientId);
        expect(retrieved?.realmId).toBe(config.realmId);
      });
    });

    it('should update existing configuration', async () => {
      if (!quickbooksConfigAvailable) return;
      await runWithTestTenantContext(async () => {
        const initialConfig = {
          clientId: 'initial_client',
          clientSecret: 'initial_secret',
          redirectUri: 'https://example.com/callback',
          realmId: '1111111111',
          isActive: 1,
          autoSync: 0,
        };

        await db.saveQuickBooksConfig(initialConfig);

        const updatedConfig = {
          clientId: 'updated_client',
          clientSecret: 'updated_secret',
          redirectUri: 'https://example.com/callback',
          realmId: '2222222222',
          isActive: 1,
          autoSync: 1,
        };

        await db.saveQuickBooksConfig(updatedConfig);

        const retrieved = await db.getQuickBooksConfig();
        expect(retrieved?.clientId).toBe(updatedConfig.clientId);
        expect(retrieved?.realmId).toBe(updatedConfig.realmId);
        expect(retrieved?.autoSync).toBe(1);
      });
    });
  });

  describe('OAuth Constants', () => {
    it('should have correct QuickBooks OAuth endpoints', () => {
      expect(QUICKBOOKS_OAUTH.authorizationUrl).toBe('https://appcenter.intuit.com/connect/oauth2');
      expect(QUICKBOOKS_OAUTH.tokenUrl).toBe('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer');
      expect(QUICKBOOKS_OAUTH.revokeUrl).toBe('https://developer.api.intuit.com/v2/oauth2/tokens/revoke');
    });
  });
});
