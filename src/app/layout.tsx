import type { Metadata } from 'next';
import './globals.compiled.css';
import { AppProvider } from '@/context/AppContext';
import NavigationSidebar from '@/components/NavigationSidebar';

export const metadata: Metadata = {
  title: 'Neuro Vision Analytic - Análisis Facial',
  description: 'Plataforma clínica para evaluar la movilidad facial y el tremor en pacientes con Parkinson.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-zinc-950 text-zinc-100 antialiased">
        <AppProvider>
          <div className="app-container">
            <NavigationSidebar />
            <main className="min-h-screen overflow-y-auto bg-zinc-950">
              {children}
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
