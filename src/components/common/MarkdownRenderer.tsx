import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
  language: string
  value: string
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'relative', margin: '12px 0', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          background: 'rgba(255,255,255,0.06)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{ margin: 0, borderRadius: '0 0 var(--radius) var(--radius)', fontSize: 13 }}
        showLineNumbers={value.split('\n').length > 3}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const code = String(children).replace(/\n$/, '')
          if (match) {
            return <CodeBlock language={match[1]} value={code} />
          }
          return (
            <code
              className={className}
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: '0.9em',
              }}
              {...props}
            >
              {children}
            </code>
          )
        },
        p({ children }) {
          return <p style={{ margin: '4px 0' }}>{children}</p>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
