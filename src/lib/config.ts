/**
 * Configuration validation and management
 * 
 * Validates all environment variables at startup
 * Provides type-safe access to configuration
 */

import { z } from 'zod';

/**
 * Environment variable schema
 */
const envSchema = z.object({
  // Required for production
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Chub AI API key for Zahra
  CHUB_API_KEY: z.string().min(20, {
    message: 'CHUB_API_KEY must be at least 20 characters long'
  }),
  
  // JWT secret for session management
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET must be at least 32 characters long for security'
  }),
  
  // Optional: Database path (defaults to ./data/protocol-police.db)
  DATABASE_PATH: z.string().optional(),
  
  // Optional: Server port
  PORT: z.coerce.number().int().positive().optional().default(3000),
  
  // Optional: Session cookie settings
  SESSION_MAX_AGE: z.coerce.number().int().positive().optional().default(60 * 60 * 24 * 7), // 7 days
});

/**
 * Validated environment configuration
 */
export interface EnvConfig {
  nodeEnv: 'development' | 'production' | 'test';
  chubApiKey: string;
  jwtSecret: string;
  databasePath: string;
  port: number;
  sessionMaxAge: number;
  isDev: boolean;
  isProd: boolean;
  isTest: boolean;
}

/**
 * Parse and validate environment variables
 * Throws an error if validation fails
 */
export function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.format();
    const errorMessages: string[] = [];
    
    for (const [key, value] of Object.entries(errors)) {
      if (value && typeof value === 'object' && '_errors' in value) {
        const messages = (value as any)._errors;
        errorMessages.push(`  ${key}: ${messages.join(', ')}`);
      }
    }
    
    throw new Error(
      'CRITICAL: Environment configuration is invalid.\n' +
      errorMessages.join('\n') + '\n\n' +
      'Please fix these issues in your .env file.'
    );
  }
  
  const env = result.data;
  
  // Additional security checks
  const insecurePatterns = ['your_', '12345', 'password', 'secret', 'chub-', 'chk-'];
  
  if (insecurePatterns.some(pattern => env.CHUB_API_KEY.toLowerCase().includes(pattern))) {
    throw new Error(
      'CRITICAL: CHUB_API_KEY contains an insecure pattern. ' +
      'Please generate a new API key.'
    );
  }
  
  if (insecurePatterns.some(pattern => env.JWT_SECRET.toLowerCase().includes(pattern))) {
    throw new Error(
      'CRITICAL: JWT_SECRET contains an insecure pattern. ' +
      'Please generate a new secure secret using: openssl rand -base64 48'
    );
  }
  
  return {
    nodeEnv: env.NODE_ENV,
    chubApiKey: env.CHUB_API_KEY,
    jwtSecret: env.JWT_SECRET,
    databasePath: env.DATABASE_PATH || './data/protocol-police.db',
    port: env.PORT,
    sessionMaxAge: env.SESSION_MAX_AGE,
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  };
}

/**
 * Parsed and validated configuration
 * Import this in other modules to access config
 */
export const config = parseEnv();

/**
 * Runtime configuration that can be updated
 */
interface RuntimeConfig {
  maintenanceMode: boolean;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export const runtimeConfig: RuntimeConfig = {
  maintenanceMode: false,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  }
};

/**
 * Check if we're in a server-side rendering context (Astro/Node)
 */
export function isSSR(): boolean {
  return typeof window === 'undefined';
}

/**
 * Check if we're in a browser context
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
