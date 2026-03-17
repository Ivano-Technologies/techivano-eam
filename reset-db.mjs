#!/usr/bin/env node
/**
 * Database Reset Script
 * Clears all sample data from tables while preserving schema
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client);

async function resetDatabase() {
  console.log('🔄 Starting database reset...');
  
  try {
    // Clear all tables (except users table to preserve admin access)
    const tables = [
      'assetPhotos',
      'scheduledReports',
      'notificationPreferences',
      'notifications',
      'documents',
      'auditLogs',
      'complianceRecords',
      'financialTransactions',
      'inventoryTransactions',
      'inventoryItems',
      'vendors',
      'maintenanceSchedules',
      'workOrders',
      'assets',
      'assetCategories',
      'sites',
    ];
    
    for (const table of tables) {
      console.log(`  Clearing ${table}...`);
      await db.execute(sql.raw(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`));
    }
    
    console.log('✅ Database reset complete!');
    console.log('📝 All sample data has been removed.');
    console.log('👤 User accounts have been preserved.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Add your sites/locations');
    console.log('2. Create asset categories');
    console.log('3. Start adding your actual assets');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
