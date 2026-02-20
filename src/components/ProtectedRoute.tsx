import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isDemo, signInWithDemo } = useAuth();

  // Auto-activate demo mode if no user is logged in
  // This allows the platform to work without authentication setup
  React.useEffect(() => {
    if (!loading && !user && !isDemo) {
      signInWithDemo();
    }
  }, [loading, user, isDemo, signInWithDemo]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Carregando...</p>
      </div>
    );
  }

  // Allow access - demo mode is auto-activated
  return <>{children}</>;
};

const styles: { [key: string]: React.CSSProperties } = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #334155',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: '16px',
    fontSize: '16px',
  },
};
