import dotenv from "dotenv";
import postgres from 'postgres';

dotenv.config();
dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🗑️  Starting database reset...\n');

const client = postgres(DATABASE_URL, { prepare: false });

// List of all tables to clear (in order to respect foreign key constraints)
const tables = [
  'financialTransactions',
  'maintenanceSchedules',
  'workOrders',
  'assets',
  'assetCategories',
  'inventory',
  'vendors',
  'sites',
  'notifications',
  'notificationPreferences',
  'scheduledReports',
  'emailNotificationHistory',
  'userPreferences',
  'dashboardWidgetPreferences',
  'sidebarPreferences',
  // Keep users table - don't delete user accounts
];

for (const table of tables) {
  try {
    console.log(`Clearing table: ${table}`);
    await client.unsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    console.log(`✓ Cleared ${table}`);
  } catch (error) {
    // Table might not exist, skip it
    console.log(`⚠ Skipped ${table} (table may not exist)`);
  }
}

console.log('\n✅ Database reset complete!');
console.log('📊 All data cleared, auto-increment counters reset');
console.log('👤 User accounts preserved\n');

await client.end();
process.exit(0);
