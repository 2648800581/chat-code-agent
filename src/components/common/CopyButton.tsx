import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  content: string
  position?: { right?: number | string; bottom?: number | string; top?: number | string } | null
  size?: number
}

export function CopyButton({ content, position, size = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    color: copied ? 'var(--accent)' : 'var(--text-tertiary)',
    cursor: 'pointer',
    padding: 2,
    transition: 'opacity 0.15s, color 0.15s',
    zIndex: 5,
  }

  // Absolute mode for bubble overlay
  if (position !== undefined && position !== null) {
    return (
      <button
        type="button"
        className="copy-btn"
        onClick={handleCopy}
        title="复制"
        style={{
          ...baseStyle,
          position: 'absolute',
          right: position?.right ?? 0,
          bottom: position?.bottom ?? -20,
          top: position?.top,
        }}
      >
        {copied ? <Check size={size} /> : <Copy size={size} />}
      </button>
    )
  }

  // Inline mode for row layout
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      title="复制"
      style={baseStyle}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}
