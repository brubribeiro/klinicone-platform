// Carrega backend/.env para os testes de integração (o PrismaClient de setup usa DATABASE_URL).
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

// No CI não há .env: só DATABASE_URL vem do job. Valores fixos de teste para o AppModule subir.
process.env.JWT_SECRET ??= 'test-only-jwt-secret-with-at-least-32-chars';
process.env.GOOGLE_CLIENT_ID ??= 'test-client-id.apps.googleusercontent.com';
