import { Component } from 'react'

// Aísla una parte decorativa o secundaria: si falla al dibujarse, el resto de la pantalla sigue funcionando.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error(`[${this.props.nombre ?? 'ErrorBoundary'}]`, error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500 ring-1 ring-slate-200">
        {this.props.mensaje ?? 'This section could not be shown.'} <span className="text-slate-400">({String(this.state.error.message ?? this.state.error).slice(0, 120)})</span>
      </p>
    )
  }
}
