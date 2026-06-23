'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { LayoutDashboard, Camera, TrendingUp, User, Shield, Activity } from 'lucide-react';

export default function NavigationSidebar() {
  const pathname = usePathname();
  const { role, setRole } = useApp();

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/capture', label: 'Registrar Sesión', icon: Camera, adminOnly: true },
    { href: '/trends', label: 'Historial y Tendencias', icon: TrendingUp },
  ];

  return (
    <div className="sidebar">
      <div>
        {/* Logo Section */}
        <div className="flex items-center gap-2 px-2 py-1">
          <Activity size={24} className="text-emerald-500" />
          <span className="font-bold text-md tracking-tight text-zinc-100">Parkinson Analytic</span>
          <span className="recording-dot bg-emerald-500" style={{ width: 6, height: 6 }} />
        </div>

        {/* Menu Links */}
        <nav className="sidebar-menu">
          {links.map((link) => {
            // Hide admin-only links when in patient mode
            if (link.adminOnly && role !== 'admin') return null;

            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Role Switcher (Simulating Authentication / RLS) */}
      <div className="border-t border-zinc-800 pt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 px-2 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
          {role === 'admin' ? <Shield size={12} className="text-emerald-400" /> : <User size={12} className="text-indigo-400" />}
          <span>Rol de Acceso</span>
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="select-input py-1.5 px-2 text-xs w-full font-medium"
        >
          <option value="admin">Médico (Admin)</option>
          <option value="patient">Paciente (Autenticado)</option>
        </select>
      </div>
    </div>
  );
}
