import { useContext } from 'react';
import { ModuleContext } from '../contexts/moduleContextInstance';

export function useModules() {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModules must be used within ModuleProvider');
  }
  return context;
}
