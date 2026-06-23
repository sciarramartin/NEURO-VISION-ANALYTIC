'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Session } from '@/lib/types/database';
import dynamic from 'next/dynamic';

const LongitudinalCharts = dynamic(() => import('@/components/LongitudinalCharts'), {
  ssr: false,
  loading: () => (
    <div className="card h-96 flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 rounded-xl text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500 mb-4" />
      <p className="text-zinc-400 text-sm">Cargando gráficos de tendencias...</p>
    </div>
  )
});
import { 
  TrendingUp, Download, ArrowLeft, Activity, 
  Sparkles, Calendar, Info, BarChart2, Scale, AlertCircle 
} from 'lucide-react';
import { exportarPDF, exportarExcel } from '@/lib/exports';

interface PatientDetail {
  id: string;
  name: string;
  birth_date: string | null;
}

function TrendsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = searchParams.get('patientId');

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('CEJA');
  const [selectedLado, setSelectedLado] = useState<string>('IZQUIERDA');

  // Load patient details & sessions
  useEffect(() => {
    if (!patientId) return;
    const pId = patientId;

    async function loadPatientData() {
      try {
        // Fetch patients list and find active patient profile
        const pResponse = await fetch('/api/patients');
        const pData = await pResponse.json();
        const activeP = pData.find((p: any) => p.id === pId);

        if (pResponse.ok && activeP) {
          setPatient(activeP);
        } else {
          setPatient({ id: pId, name: 'Paciente A (Simulado)', birth_date: '1960-04-12' });
        }

        // Fetch sessions from local SQLite API
        const sResponse = await fetch(`/api/sessions?patientId=${pId}`);
        const sData = await sResponse.json();

        if (sResponse.ok) {
          setSessions(sData || []);
          if (sData && sData.length > 0) {
            setSelectedRegion(sData[0].region);
            setSelectedLado(sData[0].lado);
          }
        } else if (pId.startsWith('mock-')) {
          setSessions(getMockSessions(pId));
        } else {
          setSessions([]);
        }
      } catch (err) {
        console.warn('Error loading trend data:', err);
        if (pId.startsWith('mock-')) {
          setPatient({ id: pId, name: 'Paciente A (Simulado)', birth_date: '1960-04-12' });
          setSessions(getMockSessions(pId));
        } else {
          setPatient(null);
          setSessions([]);
        }
      }
    }

    loadPatientData();
  }, [patientId]);

  // Mock sessions helper (synchronized with dates)
  const getMockSessions = (pId: string): Session[] => [
    {
      id: 'sess-1',
      patient_id: pId,
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
      datos_angulos: '0,140;1,142;2,141;3,138;4,145;5,143;6,150;7,148;8,154',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString() // 3 days ago
    },
    {
      id: 'sess-2',
      patient_id: pId,
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
      datos_angulos: '0,142;1,145;2,148;3,150;4,152;5,155;6,158;7,159;8,157',
      created_at: new Date(Date.now() - 3 * 86400000 + 1800000).toISOString()
    },
    {
      id: 'sess-3',
      patient_id: pId,
      modo: 'PRE',
      region: 'CEJA',
      lado: 'IZQUIERDA',
      tiempo_medicion: 8.2,
      angulo_min: 138.4,
      angulo_max: 151.2,
      angulo_promedio: 142.8,
      velocidad_max: 38.2,
      frecuencia_temblor: 5.5,
      amplitud_temblor: 2.2,
      asimetria_index: null,
      datos_angulos: '0,140;1,141;2,139;3,143;4,142;5,148;6,150;7,151',
      created_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
    },
    {
      id: 'sess-4',
      patient_id: pId,
      modo: 'POST',
      region: 'CEJA',
      lado: 'IZQUIERDA',
      tiempo_medicion: 8.9,
      angulo_min: 134.1,
      angulo_max: 161.5,
      angulo_promedio: 147.2,
      velocidad_max: 60.1,
      frecuencia_temblor: 0,
      amplitud_temblor: 0,
      asimetria_index: null,
      datos_angulos: '0,140;1,144;2,148;3,152;4,156;5,160;6,161;7,159',
      created_at: new Date(Date.now() - 86400000 + 1800000).toISOString()
    }
  ];

  if (!patientId) {
    return (
      <div className="main-content flex flex-col items-center justify-center h-96">
        <AlertCircle size={48} className="text-zinc-500 mb-4" />
        <h2 className="text-lg font-bold">Sin paciente seleccionado</h2>
        <p className="text-sm text-zinc-400 mb-4">Por favor, vuelva al dashboard para seleccionar un paciente.</p>
        <Link href="/" className="btn btn-primary">Ir al Dashboard</Link>
      </div>
    );
  }

  // Filter sessions for the active chart parameters
  const activeSessions = sessions.filter(
    s => s.region === selectedRegion && s.lado === selectedLado
  );

  // Format Recharts data (combine PRE and POST of the same date/time)
  const chartData = activeSessions.reduce((acc: any[], session) => {
    const dateStr = new Date(session.created_at).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
    
    // Find if date already exists in accumulator
    let day = acc.find(d => d.date === dateStr);
    if (!day) {
      day = { date: dateStr };
      acc.push(day);
    }
    
    const rom = session.angulo_max - session.angulo_min;
    
    if (session.modo === 'PRE') {
      day.PRE_ROM = parseFloat(rom.toFixed(1));
      day.PRE_Vel = session.velocidad_max;
      day.PRE_Tremor = session.frecuencia_temblor || 0;
    } else {
      day.POST_ROM = parseFloat(rom.toFixed(1));
      day.POST_Vel = session.velocidad_max;
      day.POST_Tremor = session.frecuencia_temblor || 0;
    }
    
    return acc;
  }, []);

  // Compute PRE vs POST Comparison (take the latest session pair)
  const preSession = [...activeSessions].reverse().find(s => s.modo === 'PRE');
  const postSession = [...activeSessions].reverse().find(s => s.modo === 'POST');

  const preRom = preSession ? preSession.angulo_max - preSession.angulo_min : 0;
  const postRom = postSession ? postSession.angulo_max - postSession.angulo_min : 0;

  const romDiffAbs = postRom - preRom;
  const romDiffPct = preRom > 0 ? (romDiffAbs / preRom) * 100 : 0;

  const velDiffAbs = postSession && preSession ? postSession.velocidad_max - preSession.velocidad_max : 0;
  const velDiffPct = preSession && preSession.velocidad_max > 0 ? (velDiffAbs / preSession.velocidad_max) * 100 : 0;

  const tremorDiffAbs = postSession && preSession ? (postSession.amplitud_temblor || 0) - (preSession.amplitud_temblor || 0) : 0;

  // Handles export calls
  const handleExportPDF = () => {
    if (!patient) return;
    exportarPDF(patient, activeSessions);
  };

  const handleExportExcel = () => {
    if (!patient) return;
    exportarExcel(patient, activeSessions);
  };

  return (
    <div className="main-content">
      {/* Navigation & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Link href="/" className="btn btn-secondary py-2 px-3 text-xs">
          <ArrowLeft size={16} /> Volver al Dashboard
        </Link>
        
        {patient && (
          <div className="flex flex-col items-end">
            <h1 className="text-xl font-bold">{patient.name}</h1>
            <span className="text-xs text-zinc-400 font-mono">ID Paciente: {patient.id.slice(0, 8)}...</span>
          </div>
        )}

        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={handleExportExcel} className="btn btn-secondary py-2 px-3 text-xs flex-1 md:flex-none">
            <Download size={14} /> Exportar Excel
          </button>
          <button onClick={handleExportPDF} className="btn btn-primary py-2 px-3 text-xs flex-1 md:flex-none">
            <Download size={14} /> Descargar PDF
          </button>
        </div>
      </div>

      {/* Selectors Panel */}
      <div className="card grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/40">
        <div className="form-group mb-0">
          <label className="form-label">Región de Medición</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="select-input"
          >
            <optgroup label="Rostro (Facial)">
              <option value="CEJA">Ceja (Movilidad frontal)</option>
              <option value="PARPADO">Párpado (Apertura palpebral)</option>
              <option value="BOCA">Boca (Simetría sonrisa)</option>
              <option value="NARIZ">Nariz (Movilidad nasal)</option>
            </optgroup>
            <optgroup label="Cuerpo (Corporal)">
              <option value="CODO">Codo (Flexión/Extensión)</option>
              <option value="MUÑECA">Muñeca (Flexión/Temblor)</option>
              <option value="HOMBRO">Hombro (Simetría postural)</option>
            </optgroup>
          </select>
        </div>

        <div className="form-group mb-0">
          <label className="form-label">Lado Lateral</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedLado('IZQUIERDA')}
              className={`btn ${selectedLado === 'IZQUIERDA' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Izquierda
            </button>
            <button
              onClick={() => setSelectedLado('DERECHA')}
              className={`btn ${selectedLado === 'DERECHA' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Derecha
            </button>
          </div>
        </div>
      </div>

      {/* Trend Charts Section */}
      {chartData.length > 0 ? (
        <LongitudinalCharts chartData={chartData} />
      ) : (
        <div className="card p-12 text-center text-zinc-500">
          No hay datos de medición suficientes para la región e lado seleccionados.
        </div>
      )}

      {/* Clinical Comparison Panel */}
      {preSession && postSession && (
        <div className="card border-zinc-800 bg-zinc-950 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Scale size={20} className="text-emerald-500" />
            <h2 className="text-md font-bold">Comparación Clínica (PRE vs. POST L-Dopa)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Range comparison */}
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col gap-2">
              <span className="text-xs text-zinc-500 font-semibold uppercase">RANGO DE MOVILIDAD</span>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm font-semibold text-amber-500">PRE: {preRom.toFixed(1)}°</span>
                <span className="text-sm font-semibold text-emerald-500">POST: {postRom.toFixed(1)}°</span>
              </div>
              <div className="border-t border-zinc-850 pt-2 mt-1 flex justify-between items-center">
                <span className="text-[11px] text-zinc-500">Diferencia</span>
                <span className={`text-sm font-bold font-mono ${romDiffAbs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {romDiffAbs >= 0 ? '+' : ''}{romDiffAbs.toFixed(1)}° ({romDiffPct >= 0 ? '+' : ''}{romDiffPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Velocity comparison */}
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col gap-2">
              <span className="text-xs text-zinc-500 font-semibold uppercase">VELOCIDAD MÁXIMA</span>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm font-semibold text-amber-500">PRE: {preSession.velocidad_max.toFixed(1)}°/s</span>
                <span className="text-sm font-semibold text-emerald-500">POST: {postSession.velocidad_max.toFixed(1)}°/s</span>
              </div>
              <div className="border-t border-zinc-850 pt-2 mt-1 flex justify-between items-center">
                <span className="text-[11px] text-zinc-500">Diferencia</span>
                <span className={`text-sm font-bold font-mono ${velDiffAbs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {velDiffAbs >= 0 ? '+' : ''}{velDiffAbs.toFixed(1)}°/s ({velDiffPct >= 0 ? '+' : ''}{velDiffPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Tremor comparison */}
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col gap-2">
              <span className="text-xs text-zinc-500 font-semibold uppercase">AMPLITUD DE TEMBLOR</span>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm font-semibold text-amber-500">
                  PRE: {preSession.frecuencia_temblor && preSession.frecuencia_temblor > 0 
                    ? `${preSession.amplitud_temblor}° (${preSession.frecuencia_temblor}Hz)` 
                    : 'No detectado'}
                </span>
                <span className="text-sm font-semibold text-emerald-500">
                  POST: {postSession.frecuencia_temblor && postSession.frecuencia_temblor > 0 
                    ? `${postSession.amplitud_temblor}° (${postSession.frecuencia_temblor}Hz)` 
                    : 'No detectado'}
                </span>
              </div>
              <div className="border-t border-zinc-850 pt-2 mt-1 flex justify-between items-center">
                <span className="text-[11px] text-zinc-500">Reducción Temblor</span>
                <span className={`text-sm font-bold font-mono ${tremorDiffAbs <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tremorDiffAbs.toFixed(2)}°
                </span>
              </div>
            </div>

          </div>

          <div className="p-3 bg-zinc-900/40 border border-zinc-900 rounded-lg flex items-start gap-2.5">
            <Sparkles size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              **Nota de Análisis Clínico:** Un aumento en el rango de movilidad y de la velocidad máxima durante el estado **POST** respecto al **PRE** indica una respuesta positiva a la terapia de levodopa, aliviando la hipomimia y la bradicinesia facial.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

export default function TrendsPage() {
  return (
    <Suspense fallback={
      <div className="main-content flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500" />
      </div>
    }>
      <TrendsContent />
    </Suspense>
  );
}
