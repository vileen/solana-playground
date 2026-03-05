import { useAuth } from '../hooks/useAuth.js';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, password, setPassword, error, login } = useAuth();

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#e94560', fontSize: '18px' }}>Loading...</div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          background: '#0f3460',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          width: '90%',
          maxWidth: '400px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, #e94560, #ff6b6b)',
            borderRadius: '12px',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
          }}>
            🔒
          </div>
          
          <h1 style={{
            color: '#fff',
            fontSize: '24px',
            marginBottom: '8px',
            fontWeight: 600,
          }}>
            Solana Playground
          </h1>
          
          <p style={{
            color: '#888',
            fontSize: '14px',
            marginBottom: '32px',
          }}>
            Enter password to continue
          </p>

          <form onSubmit={(e) => {
            e.preventDefault();
            login(password);
          }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                padding: '14px 18px',
                fontSize: '16px',
                background: '#1a1a2e',
                border: `2px solid ${error ? '#e94560' : '#333'}`,
                borderRadius: '10px',
                color: '#fff',
                outline: 'none',
                marginBottom: error ? '8px' : '20px',
                transition: 'border-color 0.2s',
              }}
            />
            
            {error && (
              <div style={{
                color: '#e94560',
                fontSize: '13px',
                marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 600,
                background: '#e94560',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Unlock
            </button>
          </form>

          <p style={{
            color: '#666',
            fontSize: '12px',
            marginTop: '24px',
          }}>
            Secure server-side authentication
          </p>
        </div>
      </div>
    );
  }

  // Authenticated - render children
  return <>{children}</>;
}
