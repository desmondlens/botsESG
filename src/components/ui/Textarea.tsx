import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={clsx(
          'w-full text-sm border rounded-lg transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500',
          'placeholder:text-gray-400 text-gray-900 resize-none',
          'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
          'px-3.5 py-2.5',
          error
            ? 'border-red-300 bg-red-50 focus:ring-red-400 focus:border-red-400'
            : 'border-gray-300 bg-white',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-gray-400">{hint}</p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

export { Textarea }
export type { TextareaProps }