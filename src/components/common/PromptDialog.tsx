import { useState, useRef, useEffect } from 'react'

interface PromptDialogProps {
  title: string
  placeholder?: string
  initialValue?: string
  requireInput?: boolean
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({ title, placeholder = '', initialValue = '', requireInput = true, confirmLabel, onConfirm, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (requireInput) {
      inputRef.current?.focus()
    }
  }, [requireInput])

  const canConfirm = !requireInput || value.trim().length > 0

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && canConfirm) {
        e.preventDefault()
        onConfirm(value.trim())
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [canConfirm, value, onConfirm, onCancel])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 360,
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          {title}
        </div>
        {requireInput && (
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            marginBottom: 16,
          }}
        />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => canConfirm && onConfirm(value.trim())}
            disabled={!canConfirm}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              background: canConfirm ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: canConfirm ? '#fff' : 'var(--text-tertiary)',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              border: 'none',
            }}
          >
            {confirmLabel || '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
