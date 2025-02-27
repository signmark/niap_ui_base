import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Create mock DB if DATABASE_URL is not set
let pool;
let db;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Using mock database. Some features may not work correctly."
  );
  
  // Create mock implementations
  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({}),
    end: async () => {},
  };
  
  db = {
    query: async () => [],
    select: () => ({ from: () => ({ where: () => ({ get: async () => null }) }) }),
    insert: () => ({ values: () => ({ returning: () => ({ get: async () => null }) }) }),
    // Add other mock methods as needed
  };
} else {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { pool, db };
