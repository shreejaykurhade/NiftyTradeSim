require('dotenv').config();
const { seedHistoricalData } = require('../src/services/historicalSeeder');
const { connectDB } = require('../src/config/db');
const mongoose = require('mongoose');

async function main() {
  try {
    await connectDB();
    await seedHistoricalData();
    console.log('✅ Seeding completed');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

main();
