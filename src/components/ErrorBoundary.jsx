import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080e1a] flex items-center justify-center p-10 text-center">
          <div className="max-w-md p-8 glass rounded-3xl border-red-500/30">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-xl font-black text-white mb-2 uppercase tracking-tight">V4 Error detectado</h1>
            <p className="text-slate-400 text-sm mb-6">
              La aplicación ha encontrado un problema crítico al cargar un componente.
            </p>
            <div className="bg-black/40 p-4 rounded-xl text-left mb-6 overflow-auto max-h-40">
              <code className="text-red-400 text-xs font-mono break-words">
                {this.state.error?.toString() || "Error desconocido"}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white text-black font-black rounded-xl hover:scale-105 transition-transform"
            >
              REINTENTAR CARGA
            </button>
            <p className="mt-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              Proyectos Antigravity &copy; 2026
            </p>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
