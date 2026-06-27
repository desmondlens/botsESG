import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  id,
  ...props
}, ref) => {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'w-full text-sm border rounded-lg transition-colors duration-150 appearance-none',
            'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500',
            'text-gray-900 bg-white',
            'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
            'pl-3.5 pr-9 py-2.5',
            error
              ? 'border-red-300 bg-red-50 focus:ring-red-400 focus:border-red-400'
              : 'border-gray-300',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Chevron icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-gray-400">{hint}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export { Select }
export type { SelectProps, SelectOption }