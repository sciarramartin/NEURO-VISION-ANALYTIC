# Spec: Plataforma Web Parkinson Analytic (Rostro y Cuerpo)

## Objective
Develop a web-based clinical portal to analyze both **facial mobility** and **body kinetics (limbs, posture, tremor)** in Parkinson's disease patients. By executing MediaPipe Face Landmarker and Pose Landmarker client-side in the browser, the application extracts real-time movement ranges, joint angles, speeds, and tremor frequencies. Sessions are recorded (PRE vs POST clinical states) and saved to a serverless PostgreSQL database (Supabase), making the platform fully compatible with Vercel serverless deployments.

---

## Technical Constraints & Verification Disclaimer
*   **Testing limitations:** As an AI coder, I run in a sandboxed development terminal. I do not have a graphical display (desktop/screen) or an active browser automation engine (like Puppeteer/Chrome DevTools MCP) to visually capture or click through your browser.
*   **Aesthetic & functionality verification:** I verify layout logic through CSS rules, HTML structures, and compilation logs (`npm run build`). To ensure it works out of the box, I build a robust **"Mock Mode" (Clinical Simulator)** that feeds simulated facial and body coordinates, allowing you to test the graphs, comparisons, and exports without a camera.

---

## Design System & Usability Heuristics (Tropic-Inspired)

We implement **Jakob Nielsen's Usability Heuristics** with a premium dark theme:
*   **Typography:** **Plus Jakarta Sans** for body and headers (clean tech look) and **IBM Plex Mono** for coordinates, joint angles, speeds, and tremor frequencies (scientific look).
*   **Color Palette (Coal & Graphite):** Deep dark background (`#09090b`), card background (`#121214`), thin borders (`#222226` with hover highlights), emerald-green highlights (`#34d399` for POST/Success), and amber-orange (`#fbbf24` for PRE/Warning).
*   **User Control:** Obvious "Cancelar" buttons and a toast alert with an **"Deshacer" (Undo)** action for deletions.

---

## Architectural Pattern: Model-View-Controller (MVC)

### Folder Structure
```text
src/
├── app/                  # VIEW & ROUTING: Next.js pages and layouts
│   ├── capture/          # View: Webcam capture, face & body mesh renderers
│   ├── trends/           # View: Patient charts, joint angles, and spectral curves
│   ├── layout.tsx        # View: Base structure and sidebar navigation
│   └── page.tsx          # View: Admin patient listing / Patient landing page
├── components/           # VIEW: Charts, Webcam overlays, toast alerts
├── hooks/                # CONTROLLER: React hooks for capture loop and auth
├── lib/
│   ├── math/             # CONTROLLER: Math engines (Angles, Kinematics, FFT)
│   ├── supabase/         # MODEL: Supabase connection client
│   └── types/            # MODEL: TypeScript entity definitions
```

---

## Tech Stack
- **Framework**: Next.js (App Router, TypeScript)
- **Styling**: Vanilla CSS / CSS Modules
- **Models**: `@mediapipe/tasks-vision` (Face Landmarker WASM & Pose Landmarker WASM running in parallel)
- **Database**: Supabase (PostgreSQL)

---

## Clinical Metrics & Calculations

The app tracks:
1. **Rostro (Face) Metrics:**
   - **Ceja, Párpado, Boca, Nariz:** Real-time angles, velocity (bradykinesia), and Left-Right Asymmetry.
2. **Cuerpo (Body) Metrics:**
   - **Codo (Elbow Joint ROM):** Angle between Shoulder-Elbow-Wrist (11-13-15 for Left, 12-14-16 for Right).
   - **Temblor de Mano (Wrist Tremor):** displacement trajectory of the wrist (15/16). Passes coordinates to Cooley-Tukey FFT to extract tremor frequency (Hz) and amplitude.
   - **Simetría Postural (Shoulder Tilt):** Tilt angle of the shoulders (11-12) relative to the horizontal axis.

---

## Database Schema (PostgreSQL)

```sql
CREATE TYPE user_role AS ENUM ('admin', 'patient');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'patient'::user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    birth_date DATE,
    clinician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    modo VARCHAR(10) NOT NULL, -- 'PRE' or 'POST'
    region VARCHAR(20) NOT NULL, -- 'CEJA', 'PARPADO', 'BOCA', 'NARIZ', 'CODO', 'MUÑECA', 'HOMBRO'
    lado VARCHAR(10) NOT NULL, -- 'IZQUIERDA' or 'DERECHA'
    tiempo_medicion REAL NOT NULL,
    angulo_min REAL NOT NULL,
    angulo_max REAL NOT NULL,
    angulo_promedio REAL NOT NULL,
    velocidad_max REAL NOT NULL,
    frecuencia_temblor REAL, -- Hz from FFT
    amplitud_temblor REAL, -- peak power from FFT
    asimetria_index REAL,
    datos_angulos TEXT NOT NULL, -- semi-colon separated coordinates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

## Success Criteria
- [ ] Next.js app builds cleanly without compilation warnings.
- [ ] Webcam captures frame, executing Face and Pose Landmarkers client-side in parallel.
- [ ] Canvas displays overlay dots and connectors for face and pose joints.
- [ ] Computes and records angles, speeds, asymmetry, and tremor FFT peak frequency.
- [ ] Exports PDF and Excel files with clinical summary sheets.
