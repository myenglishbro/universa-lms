export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50 disabled:text-slate-500'

// Campo de formulario. Con `options` renderiza un <select> (strings o { value, label });
// con as="textarea" un <textarea>; en otro caso un <input>.
export default function Field({ label, options, as, error, hint, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {options ? (
        <select className={inputClass} {...props}>
          {options.map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
      ) : as === 'textarea' ? (
        <textarea className={inputClass} {...props} />
      ) : (
        <input className={inputClass} {...props} />
      )}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}
