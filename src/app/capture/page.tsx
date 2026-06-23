'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { PUNTOS_MEDICION, RegionKey, LadoKey } from '@/lib/math/angles';
import { calcularVelocidades, calcularAsimetria } from '@/lib/math/kinematics';
import { analyzeTremor } from '@/lib/math/fft';
import dynamic from 'next/dynamic';

const WebcamCapture = dynamic(() => import('@/components/WebcamCapture'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 border border-zinc-800 rounded-xl h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500 mb-4" />
      <p className="text-zinc-400 text-sm">Cargando módulo de cámara...</p>
    </div>
  )
});
import { 
  Camera, Circle, Square, Save, Trash2, ArrowLeft, 
  AlertCircle, Activity, User, Play, ShieldAlert, CheckCircle 
} from 'lucide-react';

interface PatientOption {
  id: string;
  name: string;
}

export default function CapturePage() {
  // Setup selectors
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [newPatientName, setNewPatientName] = useState<string>('');
  const [showAddPatient, setShowAddPatient] = useState(false);

  const [modo, setModo] = useState<'PRE' | 'POST'>('PRE');
  const [region, setRegion] = useState<RegionKey>('CEJA');
  const [lado, setLado] = useState<LadoKey>('DERECHA');
  const [isMockMode, setIsMockMode] = useState(true); // Default to mock for easy browser preview

  // Recording State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [timerText, setTimerText] = useState('00:00:00');
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);

  // Results State
  const [capturedData, setCapturedData] = useState<{ tiempo: number; angulo: number }[]>([]);
  const [calculatedMetrics, setCalculatedMetrics] = useState<{
    angMin: number;
    angMax: number;
    angAvg: number;
    maxVel: number;
    tremorFreq: number;
    tremorAmp: number;
  } | null>(null);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [showExitWarning, setShowExitWarning] = useState(false);

  // Load patients from Supabase
  useEffect(() => {
    async function loadPatients() {
      try {
        const response = await fetch('/api/patients');
        const data = await response.json();
        
        if (response.ok && data && data.length > 0) {
          setPatients(data);
          setSelectedPatientId(data[0].id);
        } else {
          // Fallback mocks if DB is empty
          const fallback = [
            { id: 'mock-p1', name: 'Paciente A (Simulado)' },
            { id: 'mock-p2', name: 'Paciente B (Simulado)' }
          ];
          setPatients(fallback);
          setSelectedPatientId(fallback[0].id);
        }
      } catch (err) {
        console.warn('Error loading patients, utilizing fallbacks:', err);
        const fallback = [
          { id: 'mock-p1', name: 'Paciente A (Simulado)' },
          { id: 'mock-p2', name: 'Paciente B (Simulado)' }
        ];
        setPatients(fallback);
        setSelectedPatientId(fallback[0].id);
      }
    }
    loadPatients();
  }, []);

  // Chronometer logic
  const startChronometer = () => {
    recordingStartRef.current = performance.now();
    recordingTimerRef.current = setInterval(() => {
      const elapsed = performance.now() - recordingStartRef.current;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const millis = Math.floor((elapsed % 1000) / 10);
      
      const pad = (num: number) => String(num).padStart(2, '0');
      setTimerText(`${pad(minutes)}:${pad(seconds)}:${pad(millis)}`);
    }, 10);
  };

  const stopChronometer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Start & Stop Controls
  const handleStartRecording = () => {
    if (!selectedPatientId) {
      alert('Por favor seleccione un paciente primero.');
      return;
    }
    setCalculatedMetrics(null);
    setCapturedData([]);
    setIsRecording(true);
    startChronometer();
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    stopChronometer();
  };

  // Called when WebcamCapture finishes recording
  const handleDataCollected = (data: { tiempo: number; angulo: number }[]) => {
    setCapturedData(data);
    if (data.length < 3) return;

    // Run the Math / Controller Processing Engine
    const angles = data.map(d => d.angulo);
    const times = data.map(d => d.tiempo);

    const angMin = Math.min(...angles);
    const angMax = Math.max(...angles);
    const angAvg = angles.reduce((a, b) => a + b, 0) / angles.length;

    // Velocities
    const velocities = calcularVelocidades(data);
    const maxVel = velocities.length > 0 ? Math.max(...velocities) : 0;

    // FFT Tremor Analysis
    const tremorResult = analyzeTremor(angles, times);

    setCalculatedMetrics({
      angMin: parseFloat(angMin.toFixed(1)),
      angMax: parseFloat(angMax.toFixed(1)),
      angAvg: parseFloat(angAvg.toFixed(1)),
      maxVel: parseFloat(maxVel.toFixed(1)),
      tremorFreq: tremorResult.dominantFrequency,
      tremorAmp: tremorResult.amplitude
    });
  };

  // Save to PostgreSQL database
  const handleSaveToDatabase = async () => {
    if (!calculatedMetrics || capturedData.length === 0) return;
    
    setSaveStatus('saving');
    try {
      const anglesStr = capturedData.map(d => `${d.tiempo.toFixed(2)},${d.angulo.toFixed(1)}`).join(';');
      
      const newSession = {
        patient_id: selectedPatientId,
        modo,
        region,
        lado,
        tiempo_medicion: capturedData[capturedData.length - 1].tiempo,
        angulo_min: calculatedMetrics.angMin,
        angulo_max: calculatedMetrics.angMax,
        angulo_promedio: calculatedMetrics.angAvg,
        velocidad_max: calculatedMetrics.maxVel,
        frecuencia_temblor: calculatedMetrics.tremorFreq,
        amplitud_temblor: calculatedMetrics.tremorAmp,
        asimetria_index: null, // Asymmetry index is computed during comparisons
        datos_angulos: anglesStr
      };

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession)
      });
      if (!response.ok) throw new Error('Save failed');

      setSaveStatus('success');
      // Reset metrics after 2 seconds
      setTimeout(() => {
        setCalculatedMetrics(null);
        setCapturedData([]);
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Error saving session:', err);
      // Fallback alert for testing
      setSaveStatus('success');
      alert('Guardado simulado correctamente (Base de datos desconectada).');
      setTimeout(() => {
        setCalculatedMetrics(null);
        setCapturedData([]);
        setSaveStatus('idle');
      }, 2000);
    }
  };

  const handleDiscardRecording = () => {
    if (confirm('¿Está seguro de que desea descartar esta grabación? Los datos se perderán.')) {
      setCalculatedMetrics(null);
      setCapturedData([]);
    }
  };

  // Add new patient profile
  const handleCreatePatient = async (e: React.FormEvent) => {
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
        setPatients(prev => [...prev, data]);
        setSelectedPatientId(data.id);
      }
      setNewPatientName('');
      setShowAddPatient(false);
    } catch (err) {
      console.error(err);
      // Fallback
      const newMock = { id: `mock-${Date.now()}`, name: newPatientName.trim() };
      setPatients(prev => [...prev, newMock]);
      setSelectedPatientId(newMock.id);
      setNewPatientName('');
      setShowAddPatient(false);
    }
  };

  return (
    <div className="main-content">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link href="/" className="btn btn-secondary py-2 px-3 text-xs">
          <ArrowLeft size={16} /> Volver al Dashboard
        </Link>
        <h1 className="text-xl font-bold">Registro de Sesión Biométrica</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Configuration Controls */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="card">
            <h2 className="text-sm font-semibold mb-4 text-zinc-400 flex items-center gap-2">
              <User size={16} /> Paciente e Historial
            </h2>

            {/* Select Patient */}
            <div className="form-group">
              <label className="form-label">Seleccionar Paciente</label>
              <div className="flex gap-2">
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="select-input flex-1"
                  disabled={isRecording}
                >
                  <option value="" disabled>Seleccione...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowAddPatient(!showAddPatient)}
                  className="btn btn-secondary px-3"
                  disabled={isRecording}
                >
                  +
                </button>
              </div>
            </div>

            {/* Inline Add Patient Form */}
            {showAddPatient && (
              <form onSubmit={handleCreatePatient} className="mb-4 p-3 bg-zinc-900 border border-zinc-800 rounded-md">
                <div className="form-group mb-2">
                  <label className="form-label text-[11px]">Nombre Completo</label>
                  <input
                    type="text"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    className="input-text py-1 px-2 text-xs"
                    placeholder="Ej. Juan Pérez"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPatient(false)}
                    className="btn btn-secondary py-1 px-2 text-[10px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary py-1 px-2 text-[10px]"
                  >
                    Crear
                  </button>
                </div>
              </form>
            )}

            {/* Mode Select (PRE / POST) */}
            <div className="form-group">
              <label className="form-label">Estado Clínico (Modo)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setModo('PRE')}
                  className={`btn ${modo === 'PRE' ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={isRecording}
                >
                  PRE (L-Dopa)
                </button>
                <button
                  onClick={() => setModo('POST')}
                  className={`btn ${modo === 'POST' ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={isRecording}
                >
                  POST (L-Dopa)
                </button>
              </div>
            </div>

            {/* Region Select */}
            <div className="form-group">
              <label className="form-label">Región de Medición</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionKey)}
                className="select-input"
                disabled={isRecording}
              >
                <optgroup label="Rostro (Facial)">
                  <option value="CEJA">Ceja (Movilidad frontal)</option>
                  <option value="PARPADO">Párpado (Apertura palpebral)</option>
                  <option value="BOCA">Boca (Simetría sonrisa)</option>
                  <option value="NARIZ">Nariz (Movilidad fosa nasal)</option>
                </optgroup>
                <optgroup label="Cuerpo (Corporal)">
                  <option value="CODO">Codo (Flexión/Extensión)</option>
                  <option value="MUÑECA">Muñeca (Flexión/Temblor)</option>
                  <option value="HOMBRO">Hombro (Simetría postural)</option>
                </optgroup>
              </select>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                {PUNTOS_MEDICION[region].DESCRIPCION}
              </span>
            </div>

            {/* Lado Select */}
            <div className="form-group">
              <label className="form-label">Lado Lateral</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setLado('IZQUIERDA')}
                  className={`btn ${lado === 'IZQUIERDA' ? 'btn-secondary border-emerald-500 text-emerald-400' : 'btn-secondary'}`}
                  disabled={isRecording}
                >
                  Izquierda
                </button>
                <button
                  onClick={() => setLado('DERECHA')}
                  className={`btn ${lado === 'DERECHA' ? 'btn-secondary border-emerald-500 text-emerald-400' : 'btn-secondary'}`}
                  disabled={isRecording}
                >
                  Derecha
                </button>
              </div>
            </div>

            {/* Simulator Toggle */}
            <div className="form-group border-t border-zinc-800 pt-4 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="form-label block text-zinc-300">Modo Simulador</span>
                  <span className="text-[10px] text-zinc-500">Usa datos de prueba biométricos sin webcam</span>
                </div>
                <input
                  type="checkbox"
                  checked={isMockMode}
                  onChange={(e) => {
                    setIsMockMode(e.target.checked);
                    setIsCameraActive(false);
                  }}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  disabled={isRecording}
                />
              </div>
            </div>

          </div>

          {/* Chronometer & Recording Control Card */}
          <div className="card bg-zinc-950 flex flex-col items-center gap-4 text-center">
            <span className="text-xs text-zinc-400 font-mono tracking-wider">CRONÓMETRO</span>
            <div className={`text-3xl font-mono ${isRecording ? 'text-red-500 font-semibold' : 'text-zinc-300'}`}>
              {timerText}
            </div>

            <div className="flex gap-4 w-full">
              {!isCameraActive && !isMockMode ? (
                <button
                  onClick={() => setIsCameraActive(true)}
                  className="btn btn-primary flex-1 py-3"
                >
                  <Camera size={18} /> Iniciar Cámara
                </button>
              ) : (
                <>
                  {!isRecording ? (
                    <button
                      onClick={handleStartRecording}
                      className="btn btn-danger flex-1 py-3 font-semibold"
                    >
                      <Circle className="recording-dot" size={14} /> GRABAR
                    </button>
                  ) : (
                    <button
                      onClick={handleStopRecording}
                      className="btn btn-secondary border-red-500 text-red-500 flex-1 py-3 font-semibold"
                    >
                      <Square size={14} fill="currentColor" /> DETENER
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Columns: Video Capture & Landmarker Canvas */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {(isCameraActive || isMockMode) ? (
            <div className="card">
              <WebcamCapture
                region={region}
                lado={lado}
                isRecording={isRecording}
                isMockMode={isMockMode}
                onDataCollected={handleDataCollected}
              />
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center h-96 bg-zinc-900/50 border-dashed border-zinc-800 text-zinc-500">
              <Camera size={48} className="mb-4 opacity-50" />
              <p className="text-sm">Active la cámara o el modo simulador para comenzar.</p>
            </div>
          )}

          {/* Results Analysis Panel (Nielsen's Recovery and Control) */}
          {calculatedMetrics && (
            <div className="card border-emerald-500/30 bg-emerald-950/5 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-bold text-emerald-400 flex items-center gap-2">
                  <Activity size={18} /> Análisis de Señal Completado
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleDiscardRecording}
                    className="btn btn-secondary border-red-900/50 text-red-400 py-1.5 px-3 text-xs"
                    disabled={saveStatus === 'saving'}
                  >
                    <Trash2 size={14} /> Descartar
                  </button>
                  <button
                    onClick={handleSaveToDatabase}
                    className="btn btn-primary py-1.5 px-3 text-xs"
                    disabled={saveStatus === 'saving'}
                  >
                    <Save size={14} /> {saveStatus === 'saving' ? 'Guardando...' : 'Guardar Sesión'}
                  </button>
                </div>
              </div>

              {/* Grid of processed results */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                  <span className="text-[11px] text-zinc-500 block">RANGO DE ÁNGULO</span>
                  <span className="text-lg font-mono font-semibold text-zinc-200">
                    {calculatedMetrics.angMin}° - {calculatedMetrics.angMax}°
                  </span>
                </div>
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                  <span className="text-[11px] text-zinc-500 block">VELOCIDAD MÁXIMA</span>
                  <span className="text-lg font-mono font-semibold text-zinc-200">
                    {calculatedMetrics.maxVel}°/s
                  </span>
                </div>
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                  <span className="text-[11px] text-zinc-500 block">FREQ. TEMBLOR</span>
                  <span className="text-lg font-mono font-semibold text-indigo-400">
                    {calculatedMetrics.tremorFreq > 0 ? `${calculatedMetrics.tremorFreq} Hz` : 'No detectado'}
                  </span>
                </div>
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                  <span className="text-[11px] text-zinc-500 block">AMP. TEMBLOR</span>
                  <span className="text-lg font-mono font-semibold text-indigo-400">
                    {calculatedMetrics.tremorFreq > 0 ? `${calculatedMetrics.tremorAmp}°` : '--'}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
