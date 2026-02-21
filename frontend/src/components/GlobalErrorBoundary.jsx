// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: GlobalErrorBoundary.jsx                     ║
// ║  UPDATED: 20260219-162200                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

import React from 'react';

/**
 * Global Error Boundary for Frontend Error Collection
 * Catches all React errors and reports them to central API
 */

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    
    // Create comprehensive error report
    const errorReport = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      buildId: process.env.REACT_APP_BUILD_ID || 'unknown',
      version: process.env.REACT_APP_VERSION || '1.0.0',
      
      // Error details
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      
      // React component stack
      componentStack: errorInfo.componentStack,
      
      // User context
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      
      // System context
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      
      // Network context
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null,
      
      // Performance context
      performance: {
        loadTime: window.performance ? window.performance.timing.loadEventEnd - window.performance.timing.navigationStart : null,
        domContentLoaded: window.performance ? window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart : null
      }
    };

    // Send to central error API
    this.reportError(errorReport);
    
    // Also emit to analytics if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  }

  getUserId() {
    // Try to get user ID from various sources
    return (
      window.localStorage.getItem('userId') ||
      window.sessionStorage.getItem('userId') ||
      'anonymous'
    );
  }

  getSessionId() {
    // Generate or retrieve session ID
    let sessionId = window.sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      window.sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  async reportError(errorReport) {
    try {
      // Send to production API - NO localhost
      const response = await fetch('https://api.headyme.com/api/frontend-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0'
        },
        body: JSON.stringify(errorReport)
      });

      if (!response.ok) {
        console.warn('Failed to report error to API:', response.status);
      }
    } catch (error) {
      console.error('Error reporting failed:', error);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <div className="error-container">
            <div className="error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#ef4444"/>
              </svg>
            </div>
            
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">
              We're sorry, but something unexpected happened. Our team has been notified 
              and is working to fix this issue.
            </p>
            
            <div className="error-actions">
              <button 
                onClick={this.handleRetry}
                className="retry-button"
              >
                Try Again
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                className="refresh-button"
              >
                Refresh Page
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
          
          <style jsx>{`
            .error-boundary-fallback {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 20px;
            }
            
            .error-container {
              background: white;
              border-radius: 12px;
              padding: 40px;
              max-width: 500px;
              text-align: center;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            }
            
            .error-icon {
              margin-bottom: 20px;
            }
            
            .error-title {
              color: #1f2937;
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 16px;
            }
            
            .error-message {
              color: #6b7280;
              font-size: 16px;
              line-height: 1.5;
              margin-bottom: 32px;
            }
            
            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
              flex-wrap: wrap;
            }
            
            .retry-button,
            .refresh-button {
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .retry-button {
              background: #3b82f6;
              color: white;
              border: none;
            }
            
            .retry-button:hover {
              background: #2563eb;
            }
            
            .refresh-button {
              background: #f3f4f6;
              color: #374151;
              border: 1px solid #d1d5db;
            }
            
            .refresh-button:hover {
              background: #e5e7eb;
            }
            
            .error-details {
              margin-top: 24px;
              text-align: left;
            }
            
            .error-details summary {
              cursor: pointer;
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 8px;
            }
            
            .error-stack {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 12px;
              font-size: 12px;
              color: #374151;
              overflow-x: auto;
              max-height: 200px;
              overflow-y: auto;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Global Error Handler for non-React errors
 * Catches unhandled promise rejections and runtime errors
 */

class GlobalErrorHandler {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        type: 'unhandledrejection',
        reason: event.reason,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    });

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.reportError({
        type: 'uncaughterror',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    });
  }

  async reportError(errorData) {
    try {
      await fetch('https://api.headyme.com/api/frontend-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorData)
      });
    } catch (error) {
      console.error('Failed to report global error:', error);
    }
  }
}

// Initialize global error handler
const globalErrorHandler = new GlobalErrorHandler();

export { GlobalErrorBoundary, GlobalErrorHandler };
export default GlobalErrorBoundary;
