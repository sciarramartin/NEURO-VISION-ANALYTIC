'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '@/lib/types/database';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  activePatientId: string;
  setActivePatientId: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('admin');
  const [activePatientId, setActivePatientIdState] = useState<string>('mock-p1');

  // Load from localStorage on client side
  useEffect(() => {
    const savedRole = localStorage.getItem('parkinson_role') as UserRole;
    const savedPatientId = localStorage.getItem('parkinson_patient_id');
    
    if (savedRole) setRoleState(savedRole);
    if (savedPatientId) setActivePatientIdState(savedPatientId);
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('parkinson_role', newRole);
    
    // Automatically switch active patient if changing to patient role
    if (newRole === 'patient') {
      setActivePatientIdState('mock-p1');
      localStorage.setItem('parkinson_patient_id', 'mock-p1');
    }
  };

  const setActivePatientId = (id: string) => {
    setActivePatientIdState(id);
    localStorage.setItem('parkinson_patient_id', id);
  };

  return (
    <AppContext.Provider value={{ role, setRole, activePatientId, setActivePatientId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
