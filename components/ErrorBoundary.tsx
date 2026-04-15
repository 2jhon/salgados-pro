
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

/**
 * ErrorBoundary component to catch JavaScript errors anywhere in their child component tree,
 * log those errors, and display a fallback UI instead of the component tree that crashed.
 */
// Changed from React.Component to Component to attempt better type resolution from imported Component
export class ErrorBoundary extends Component<Props, State> {
  // Initializing state as a class property for better type inference and fixing property existence errors.
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { 
      hasError: true, 
      error,
      errorInfo: null
    };
  }

  // Fix for: Property 'setState' does not exist on type 'ErrorBoundary'.
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Catch errors in any components below and log them for debugging
    console.error("[CRITICAL_UI_ERROR]", error, errorInfo);
    
    // Set additional error information to be displayed in the UI
    // Fixed: Explicitly casting this to any to access setState when compiler fails to resolve base class properties
    (this as any).setState({ errorInfo });
  }

  // Fix for: Property 'state' does not exist on type 'ErrorBoundary'.
  render(): ReactNode {
    if (this.state.hasError) {
      const error = this.state.error;
      let errorMessage = "Erro desconhecido";

      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else {
          // It's a non-standard error object
          const anyError = error as any;
          if (anyError.message && typeof anyError.message === 'string') {
             errorMessage = anyError.message;
          } else {
             try {
                // Attempt to stringify the object with cycle detection
                const seen = new WeakSet();
                const json = JSON.stringify(error, (key, value) => {
                  if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) {
                      return '[Circular]';
                    }
                    seen.add(value);
                  }
                  return value;
                }, 2);
                
                // If valid JSON and not empty/array, use it.
                if (json && json !== '{}' && json !== '[]') {
                    errorMessage = json;
                } else {
                    const keys = Object.keys(anyError);
                    if (keys.length > 0) {
                        errorMessage = `Erro (Objeto): ${keys.join(', ')}`;
                    } else {
                        // Fallback for empty objects that might be wrappers or DOMExceptions
                        errorMessage = String(error);
                    }
                }
             } catch (e) {
                errorMessage = String(error);
             }
          }
        }
      }
      
      // Strict filter for [object Object]
      if (!errorMessage || errorMessage === '[object Object]' || errorMessage.includes('[object Object]')) {
          const replacement = '(Erro Interno: Objeto opaco detectado)';
          if (errorMessage && errorMessage.replace) {
             errorMessage = errorMessage.replace(/\[object Object\]/g, replacement);
          } else {
             errorMessage = replacement;
          }
      }

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-slate-900 rounded-[2rem] p-8 border border-rose-900/50 shadow-2xl">
            <div className="w-16 h-16 bg-rose-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            <h1 className="text-xl font-black uppercase text-center mb-2 text-rose-500 tracking-widest">Falha de Renderização</h1>
            <p className="text-sm text-slate-400 text-center mb-6 font-medium">
              Ocorreu um error ao processar a interface. Seus dados no banco continuam seguros.
            </p>
            
            <div className="bg-black/50 p-4 rounded-xl overflow-auto max-h-48 mb-6 border border-white/5">
              <pre className="font-mono text-[10px] text-rose-300 break-words whitespace-pre-wrap">
                {errorMessage}
              </pre>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { localStorage.clear(); window.location.reload(); }} 
                className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Resetar App
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="flex-1 py-4 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-all"
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Fixed: Property 'props' does not exist on type 'ErrorBoundary'.
    // Explicitly casting 'this' to any to bypass property check errors on component inheritance.
    return (this as any).props.children;
  }
}
