import express, { type Request, type Response } from "express";
import path from "path";
import http from "http";
import { setupVite } from "./vite";
import { registerContentGenerationRoutes } from "./routes/content-generation";

async function main() {
  const app = express();
  const server = http.createServer(app);
  
  // Middleware for parsing JSON
  app.use(express.json());
  
  // Register content generation routes
  registerContentGenerationRoutes(app);
  
  // Setup Vite for development
  await setupVite(app, server);
  
  // Start server
  const port = process.env.PORT || 5000;
  server.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

main().catch(console.error);