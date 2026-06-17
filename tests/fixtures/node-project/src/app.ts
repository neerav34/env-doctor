// Fixture: Node.js / TypeScript app with various env var patterns

const dbUrl = process.env.DATABASE_URL;
const port = process.env.PORT ?? '3000';
const apiKey = process.env.API_KEY;

// Bracket notation
const secret = process.env['JWT_SECRET'];

// Vite-style
const viteApiUrl = import.meta.env.VITE_API_URL;

// This should NOT be detected (commented out)
// const old = process.env.DEPRECATED_VAR;

export { dbUrl, port, apiKey, secret, viteApiUrl };
