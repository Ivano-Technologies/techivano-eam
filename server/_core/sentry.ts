import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for backend error tracking and performance monitoring
 * 
 * Set SENTRY_DSN environment variable to enable Sentry
 * Get your DSN from: https://sentry.io/settings/projects/
 */
export function initSentry() {
  const sentryDsn = process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn('[Sentry] SENTRY_DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance monitoring - adjust sample rate as needed
    // 1.0 = 100% of transactions, 0.1 = 10% of transactions
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Release tracking - useful for identifying which version has issues
    release: process.env.npm_package_version,
    
    // Integrations - Sentry v10 automatically includes necessary integrations
    
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      return event;
    },
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * Capture a message manually
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; name?: string; role?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
    role: user.role,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}
