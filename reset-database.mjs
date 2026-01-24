import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🗑️  Starting database reset...\n');

const connection = await mysql.createConnection(DATABASE_URL);

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

console.log('Disabling foreign key checks...');
await connection.query('SET FOREIGN_KEY_CHECKS = 0');

for (const table of tables) {
  try {
    console.log(`Clearing table: ${table}`);
    await connection.query(`DELETE FROM ${table}`);
    
    // Reset auto-increment counter
    await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
    console.log(`✓ Cleared ${table}`);
  } catch (error) {
    // Table might not exist, skip it
    console.log(`⚠ Skipped ${table} (table may not exist)`);
  }
}

console.log('\nRe-enabling foreign key checks...');
await connection.query('SET FOREIGN_KEY_CHECKS = 1');

console.log('\n✅ Database reset complete!');
console.log('📊 All data cleared, auto-increment counters reset');
console.log('👤 User accounts preserved\n');

await connection.end();
process.exit(0);
