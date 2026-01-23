import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry for frontend error tracking and performance monitoring
 * 
 * Set VITE_SENTRY_DSN environment variable to enable Sentry
 * Get your DSN from: https://sentry.io/settings/projects/
 */
export function initSentry() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn('[Sentry] VITE_SENTRY_DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || 'development',
    
    // Performance monitoring - adjust sample rate as needed
    // 1.0 = 100% of transactions, 0.1 = 10% of transactions
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION,
    
    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Session Replay - capture 10% of all sessions, 100% of error sessions
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
    
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            delete breadcrumb.data.password;
            delete breadcrumb.data.token;
            delete breadcrumb.data.apiKey;
          }
          return breadcrumb;
        });
      }
      
      return event;
    },
  });

  console.log('[Sentry] Initialized successfully');
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
