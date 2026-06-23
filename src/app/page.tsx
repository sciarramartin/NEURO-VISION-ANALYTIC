'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase/client';
import { Session } from '@/lib/types/database';
import { 
  Users, Activity, Calendar, Play, FileText, Search, 
  Trash2, UserPlus, TrendingUp, AlertCircle, Info, ChevronRight 
} from 'lucide-react';

interface PatientSummary {
  id: string;
  name: string;
  birth_date: string | null;
  sessions_count: number;
}

export default function Dashboard() {
  const { role, activePatientId, setActivePatientId } = useApp();

  // Clinician view states
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [newPatientName, setNewPatientName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Patient view states
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [patientSessions, setPatientSessions] = useState<Session[]>([]);

  // Usability: Toast/Undo Ref & state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const tempDeletedSessionRef = useRef<Session | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Clinician Data
  useEffect(() => {
    if (role !== 'admin') return;

    async function loadClinicianData() {
      try {
        const pResponse = await fetch('/api/patients');
        const pData = await pResponse.json();

        const sResponse = await fetch('/api/sessions?limit=5');
        const sData = await sResponse.json();

        if (pResponse.ok && pData) {
          setPatients(pData);
        } else {
          setPatients([
            { id: 'mock-p1', name: 'Paciente A (Simulado)', birth_date: '1960-04-12', sessions_count: 3 },
            { id: 'mock-p2', name: 'Paciente B (Simulado)', birth_date: '1955-08-22', sessions_count: 1 }
          ]);
        }

        if (sResponse.ok && sData) {
          setRecentSessions(sData);
        } else {
          setRecentSessions(getMockSessions());
        }
      } catch (err) {
        console.warn('Error loading dashboard data, using mock data:', err);
        setPatients([
          { id: 'mock-p1', name: 'Paciente A (Simulado)', birth_date: '1960-04-12', sessions_count: 3 },
          { id: 'mock-p2', name: 'Paciente B (Simulado)', birth_date: '1955-08-22', sessions_count: 1 }
        ]);
        setRecentSessions(getMockSessions());
      }
    }

    loadClinicianData();
  }, [role]);

  // Load Patient Data
  useEffect(() => {
    if (role !== 'patient') return;

    async function loadPatientData() {
      try {
        const pResponse = await fetch('/api/patients');
        const pData = await pResponse.json();
        const activeP = pData.find((p: any) => p.id === activePatientId);

        if (pResponse.ok && activeP) {
          setPatientProfile({
            id: activeP.id,
            name: activeP.name,
            birth_date: activeP.birth_date,
            doctor: 'Dr. Sciarra'
          });
        } else if (activePatientId.startsWith('mock-')) {
          setPatientProfile({
            id: activePatientId,
            name: activePatientId === 'mock-p1' ? 'Paciente A (Simulado)' : 'Paciente B (Simulado)',
            birth_date: activePatientId === 'mock-p1' ? '1960-04-12' : '1955-08-22',
            doctor: 'Dr. Sciarra'
          });
        } else {
          setPatientProfile(null);
        }

        const response = await fetch(`/api/sessions?patientId=${activePatientId}`);
        const data = await response.json();

        if (response.ok) {
          setPatientSessions(data || []);
        } else if (activePatientId.startsWith('mock-')) {
          setPatientSessions(getMockSessions().filter(s => s.patient_id === activePatientId));
        } else {
          setPatientSessions([]);
        }
      } catch (err) {
        console.warn('Error loading patient portal data:', err);
        if (activePatientId.startsWith('mock-')) {
          setPatientProfile({
            id: activePatientId,
            name: activePatientId === 'mock-p1' ? 'Paciente A (Simulado)' : 'Paciente B (Simulado)',
            birth_date: activePatientId === 'mock-p1' ? '1960-04-12' : '1955-08-22',
            doctor: 'Dr. Sciarra'
          });
          setPatientSessions(getMockSessions().filter(s => s.patient_id === activePatientId));
        } else {
          setPatientProfile(null);
          setPatientSessions([]);
        }
      }
    }

    loadPatientData();
  }, [role, activePatientId]);

  // Mock sessions helper
  const getMockSessions = (): Session[] => [
    {
      id: 'sess-1',
      patient_id: 'mock-p1',
      modo: 'PRE',
      region: 'CEJA',
      lado: 'IZQUIERDA',
      tiempo_medicion: 8.5,
      angulo_min: 135.2,
      angulo_max: 154.1,
      angulo_promedio: 144.5,
      velocidad_max: 42.1,
      frecuencia_temblor: 5.2,
      amplitud_temblor: 1.8,
      asimetria_index: null,
      datos_angulos: '',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'sess-2',
      patient_id: 'mock-p1',
      modo: 'POST',
      region: 'CEJA',
      lado: 'IZQUIERDA',
      tiempo_medicion: 9.1,
      angulo_min: 132.1,
      angulo_max: 159.4,
      angulo_promedio: 145.8,
      velocidad_max: 56.4,
      frecuencia_temblor: 0,
      amplitud_temblor: 0,
      asimetria_index: null,
      datos_angulos: '',
      created_at: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: 'sess-3',
      patient_id: 'mock-p2',
      modo: 'PRE',
      region: 'BOCA',
      lado: 'DERECHA',
      tiempo_medicion: 10.0,
      angulo_min: 110.4,
      angulo_max: 125.8,
      angulo_promedio: 118.2,
      velocidad_max: 30.5,
      frecuencia_temblor: 4.8,
      amplitud_temblor: 2.1,
      asimetria_index: null,
      datos_angulos: '',
      created_at: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  // Nielsen Heuristic: Delete & Undo action
  const handleDeleteSession = (session: Session) => {
    // 1. Cancel previous pending deletion if exists
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      executeDeletionInDB();
    }

    // 2. Save target session to ref
    tempDeletedSessionRef.current = session;
    
    // 3. Remove locally from state instantly (Optimistic UI)
    setRecentSessions(prev => prev.filter(s => s.id !== session.id));
    setPatientSessions(prev => prev.filter(s => s.id !== session.id));

    // 4. Trigger Toast notification with Undo Action
    setToastMessage(`Sesión (${session.region} ${session.modo}) eliminada.`);
    setShowToast(true);

    // 5. Set timer for DB deletion (5 seconds)
    undoTimeoutRef.current = setTimeout(() => {
      executeDeletionInDB();
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    // Restore locally
    if (tempDeletedSessionRef.current) {
      const restored = tempDeletedSessionRef.current;
      setRecentSessions(prev => [restored, ...prev]);
      setPatientSessions(prev => [restored, ...prev]);
      tempDeletedSessionRef.current = null;
    }

    // Close toast
    setShowToast(false);
    setToastMessage(null);
  };

  const executeDeletionInDB = async () => {
    if (!tempDeletedSessionRef.current) return;
    const sessionToDelete = tempDeletedSessionRef.current;
    tempDeletedSessionRef.current = null;
    setShowToast(false);

    try {
      const response = await fetch(`/api/sessions?id=${sessionToDelete.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Delete failed');
    } catch (err) {
      console.error('Error executing delete:', err);
    }
  };

  // Create Patient Form handler
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) return;

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPatientName.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error('Create failed');
      
      if (data) {
        setPatients(prev => [data, ...prev]);
      }
      setNewPatientName('');
      setShowAddForm(false);
    } catch (err) {
      // Fallback local create
      const mockP = {
        id: `mock-${Date.now()}`,
        name: newPatientName.trim(),
        birth_date: 'N/A',
        sessions_count: 0
      };
      setPatients(prev => [mockP, ...prev]);
      setNewPatientName('');
      setShowAddForm(false);
    }
  };

  // Filter patient list based on search query
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="main-content">
      {/* Toast Alert Panel (Nielsen's Undo) */}
      {showToast && (
        <div className="toast-container">
          <div className="toast">
            <span className="toast-message flex items-center gap-2">
              <Info size={16} className="text-emerald-400" /> {toastMessage}
            </span>
            <button onClick={handleUndoDelete} className="toast-action-btn">
              DESHACER
            </button>
          </div>
        </div>
      )}

      {/* CLINIClAN / ADMIN VIEW */}
      {role === 'admin' && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Portal Clínico</h1>
              <p className="text-sm text-zinc-400">Panel de evaluación facial de la enfermedad de Parkinson.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="btn btn-secondary text-xs"
              >
                <UserPlus size={16} /> Registrar Paciente
              </button>
              <Link href="/capture" className="btn btn-primary text-xs">
                <Play size={14} fill="currentColor" /> Nueva Medición
              </Link>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card flex items-center gap-4">
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-lg text-emerald-400">
                <Users size={24} />
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">PACIENTES ACTIVOS</span>
                <span className="text-xl font-bold font-mono text-zinc-200">{patients.length}</span>
              </div>
            </div>

            <div className="card flex items-center gap-4">
              <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-lg text-indigo-400">
                <Activity size={24} />
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">SESIONES EVALUADAS</span>
                <span className="text-xl font-bold font-mono text-zinc-200">
                  {patients.reduce((sum, p) => sum + p.sessions_count, 0)}
                </span>
              </div>
            </div>

            <div className="card flex items-center gap-4">
              <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-lg text-amber-400">
                <Calendar size={24} />
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">ÚLTIMA CONEXIÓN</span>
                <span className="text-sm font-semibold text-zinc-200">Hoy, {new Date().toLocaleDateString('es-ES')}</span>
              </div>
            </div>
          </div>

          {/* Create Patient Inline Card */}
          {showAddForm && (
            <div className="card border-emerald-500/30">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <UserPlus size={16} /> Crear Perfil de Paciente
              </h3>
              <form onSubmit={handleAddPatient} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="form-group mb-0 md:col-span-2">
                  <label className="form-label">Nombre Completo del Paciente</label>
                  <input 
                    type="text" 
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="Ej. Carmen Rodriguez" 
                    className="input-text"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    className="btn btn-primary flex-1"
                  >
                    Crear Registro
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Patients search & list (2 Columns) */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-md font-bold">Listado de Pacientes</h3>
                <div className="relative w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar paciente..."
                    className="input-text py-1.5 pl-8 pr-3 text-xs w-full"
                  />
                  <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-500" />
                </div>
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Fecha Nac.</th>
                      <th>Grabaciones</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map(p => (
                        <tr key={p.id}>
                          <td className="font-semibold text-zinc-200">{p.name}</td>
                          <td className="font-mono text-zinc-400 text-xs">{p.birth_date}</td>
                          <td className="font-mono text-zinc-400 text-xs">{p.sessions_count}</td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link 
                                href={`/trends?patientId=${p.id}`}
                                className="btn btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1"
                              >
                                <TrendingUp size={12} /> Análisis
                              </Link>
                              <Link 
                                href={`/capture?patientId=${p.id}`}
                                className="btn btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1"
                              >
                                <Play size={10} fill="currentColor" /> Captura
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center text-zinc-500 py-6">
                          No se encontraron pacientes que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Sessions list (1 Column) */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              <h3 className="text-md font-bold px-1">Registros Recientes</h3>
              
              <div className="flex flex-col gap-4">
                {recentSessions.length > 0 ? (
                  recentSessions.map(session => {
                    const patient = patients.find(p => p.id === session.patient_id);
                    return (
                      <div key={session.id} className="card p-4 flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                            {session.modo} - {session.region} {session.lado}
                          </span>
                          <span className="text-sm font-semibold text-zinc-200">
                            {patient ? patient.name : 'Paciente'}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(session.created_at).toLocaleString('es-ES')}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteSession(session)}
                          className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="card p-6 text-center text-zinc-500">
                    No hay mediciones registradas recientemente.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* PATIENT AUTTHENTICATED VIEW */}
      {role === 'patient' && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Portal del Paciente</h1>
              <p className="text-sm text-zinc-400">Consulte el historial de sus resultados clínicos.</p>
            </div>
            {patientProfile && (
              <Link
                href={`/trends?patientId=${patientProfile.id}`}
                className="btn btn-primary text-xs"
              >
                <TrendingUp size={16} /> Ver Mis Gráficos de Tendencias
              </Link>
            )}
          </div>

          {/* Profile Overview Card */}
          {patientProfile && (
            <div className="card flex flex-col md:flex-row justify-between gap-6 bg-zinc-900/60">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-indigo-950/40 border border-indigo-900/50 flex items-center justify-center text-indigo-400 font-semibold text-lg">
                  {patientProfile.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-md font-bold">{patientProfile.name}</h3>
                  <span className="text-xs text-zinc-400">Fecha Nac: {patientProfile.birth_date}</span>
                </div>
              </div>

              <div className="flex flex-col md:items-end justify-center">
                <span className="text-xs text-zinc-500">MÉDICO A CARGO</span>
                <span className="text-sm font-semibold text-zinc-300">{patientProfile.doctor}</span>
              </div>
            </div>
          )}

          {/* Patient Sessions Table */}
          <div className="flex flex-col gap-4">
            <h3 className="text-md font-bold px-1">Mis Evaluaciones Recientes</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Estado (L-Dopa)</th>
                    <th>Región Facial</th>
                    <th>Lado</th>
                    <th>Rango Movimiento</th>
                    <th>Temblor Dominante</th>
                  </tr>
                </thead>
                <tbody>
                  {patientSessions.length > 0 ? (
                    patientSessions.map(session => (
                      <tr key={session.id}>
                        <td className="font-mono text-zinc-400 text-xs">
                          {new Date(session.created_at).toLocaleDateString('es-ES')} a las {new Date(session.created_at).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            session.modo === 'PRE' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/40' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
                          }`}>
                            {session.modo} (Antes)
                          </span>
                        </td>
                        <td className="font-semibold text-zinc-300">{session.region}</td>
                        <td className="text-zinc-400 text-xs">{session.lado}</td>
                        <td className="font-mono text-zinc-300">
                          {session.angulo_min}° - {session.angulo_max}°
                        </td>
                        <td className="font-mono text-zinc-300">
                          {session.frecuencia_temblor && session.frecuencia_temblor > 0 
                            ? `${session.frecuencia_temblor} Hz (±${session.amplitud_temblor}°)` 
                            : 'No detectado'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-zinc-500 py-8">
                        Aún no se han registrado sesiones para su perfil.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
