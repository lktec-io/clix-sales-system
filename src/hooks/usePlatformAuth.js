import { useContext } from 'react';
import { PlatformAuthContext } from '../contexts/platformAuthContextInstance';

export function usePlatformAuth() {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  }
  return context;
}
