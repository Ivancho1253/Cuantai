import { connectDatabase, migrate } from '../src/lib/db';
async function main() {
  const connection = await connectDatabase();
  try {
    await migrate(connection);
    console.log('Database migrations applied.');
  } finally {
    await connection.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
