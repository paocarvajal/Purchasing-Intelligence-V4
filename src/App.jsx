import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Settings, 
  BarChart3, 
  Box, 
  Database,
  LogOut, 
  LogIn,
  ShieldCheck,
  SlidersHorizontal,
  Zap
} from 'lucide-react';
import Processing from './views/Processing';
import Providers from './views/Providers';
import Labels from './views/Labels';
import MasterData from './views/MasterData';
import SupplierRules from './views/SupplierRules';
import { auth, loginWithGoogle, logout } from './core/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [activeTab, setActiveTab] = useState('processing');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    await loginWithGoogle();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Zap className="w-12 h-12 text-pink-500 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-8 animate-fade-in">
        <div className="space-y-4">
          <div className="w-24 h-24 bg-pink-600/20 rounded-3xl flex items-center justify-center mx-auto border border-pink-500/30 shadow-2xl shadow-pink-600/20">
            <ShieldCheck className="w-12 h-12 text-pink-500" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
            HerraMax <span className="text-pink-500">V4</span>
          </h1>
          <p className="text-slate-400 font-medium max-w-xs mx-auto">
            Acceso exclusivo al sistema de Inteligencia de Compras V4.
          </p>
        </div>

        <button 
          onClick={handleLogin}
          className="group flex items-center gap-4 px-10 py-5 bg-white text-black rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-2xl"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          ACCEDER CON GMAIL
        </button>
        
        <p className="text-[10px] text-slate-600 font-bold tracking-widest uppercase">
          Proyectos Antigravity &copy; 2026
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-200 selection:bg-pink-500/30">
      {/* Sidebar / Navigation */}
      <nav className="fixed left-0 top-0 h-full w-20 md:w-24 flex flex-col items-center py-10 glass border-r border-white/5 z-50">
        <div className="mb-12">
          <div className="w-12 h-12 bg-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-600/30">
            <Box className="text-white w-7 h-7" />
          </div>
        </div>
        
        <div className="flex-1 flex flex-col gap-8">
          <NavButton 
            active={activeTab === 'processing'} 
            onClick={() => setActiveTab('processing')}
            icon={<FileText />}
            label="Invoices"
          />
          <NavButton 
            active={activeTab === 'master'} 
            onClick={() => setActiveTab('master')}
            icon={<Database />}
            label="Odoo Data"
          />
          <NavButton 
            active={activeTab === 'rules'} 
            onClick={() => setActiveTab('rules')}
            icon={<SlidersHorizontal />}
            label="Rules"
          />
          <NavButton 
            active={activeTab === 'providers'} 
            onClick={() => setActiveTab('providers')}
            icon={<Settings />}
            label="Vendors"
          />
          <NavButton 
            active={activeTab === 'labels'} 
            onClick={() => setActiveTab('labels')}
            icon={<BarChart3 />}
            label="Labels"
          />
        </div>

        <button 
          onClick={logout}
          className="mt-auto p-4 text-slate-500 hover:text-red-400 transition-colors"
          title="Cerrar Sesión"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </nav>

      {/* Main Content */}
      <main className="pl-20 md:pl-24 min-h-screen">
        <header className="p-8 flex justify-between items-center bg-background/50 backdrop-blur-md sticky top-0 z-40 border-b border-white/5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
              Purchasing Intelligence <span className="text-pink-500">V4</span>
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Sesión activa: {user.email}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-xs font-black text-white">{user.displayName}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Administrador</p>
            </div>
            <img 
              src={user.photoURL} 
              alt="Profile" 
              className="w-10 h-10 rounded-xl border border-white/10 shadow-lg"
            />
          </div>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto animate-fade-in">
          {activeTab === 'processing' && <Processing />}
          {activeTab === 'master' && <MasterData />}
          {activeTab === 'rules' && <SupplierRules />}
          {activeTab === 'providers' && <Providers />}
          {activeTab === 'labels' && <Labels />}
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, icon, onClick, label }) {
  return (
    <button 
      onClick={onClick}
      className={`group relative p-4 rounded-2xl transition-all duration-300 ${
        active 
          ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/40 scale-110' 
          : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
      }`}
    >
      {React.cloneElement(icon, { className: 'w-6 h-6' })}
      <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {label}
      </span>
    </button>
  );
}
