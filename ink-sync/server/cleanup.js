// server/cleanup.js  (one-time dev tool: wipes legacy rooms/boards)
require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const rooms = await db.collection('rooms').deleteMany({});
  const boards = await db.collection('boards').deleteMany({});

  console.log(`🧹 Deleted ${rooms.deletedCount} rooms and ${boards.deletedCount} boards`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});