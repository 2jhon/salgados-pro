import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-slate-900 rounded-[2rem] p-8 border border-rose-900/50 shadow-2xl">
            <div className="w-16 h-16 bg-rose-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            <h1 className="text-xl font-black uppercase text-center mb-2 text-rose-500 tracking-widest">Erro Crítico</h1>
            <p className="text-sm text-slate-400 text-center mb-6 font-medium">
              O sistema encontrou um erro inesperado e precisou ser interrompido.
            </p>
            
            <div className="bg-black/50 p-4 rounded-xl overflow-auto max-h-48 mb-6 border border-white/5">
              <p className="font-mono text-[10px] text-rose-300 break-words">
                {this.state.error?.toString()}
              </p>
              {this.state.errorInfo && (
                <pre className="font-mono text-[9px] text-slate-500 mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }} 
                className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Resetar Cache
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="flex-1 py-4 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-all"
              >
                Tentar Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}