import { db } from './server/db';

const sites = await db.query.sites.findMany();
const categories = await db.query.assetCategories.findMany();
const assets = await db.query.assets.findMany();

console.log('Database State:');
console.log('Sites:', sites.length);
console.log('Categories:', categories.length);
console.log('Assets:', assets.length);

process.exit(0);
