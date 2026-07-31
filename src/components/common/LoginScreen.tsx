import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../utils/auth'

export function LoginScreen() {
  const { verifyToken } = useAuthStore()
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!token.trim()) {
      setError('请输入 Token')
      return
    }
    setLoading(true)
    setError('')
    const success = await verifyToken(token.trim())
    setLoading(false)
    if (!success) {
      setError('Token 无效，请重新输入')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 380,
          padding: '32px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--accent)',
            margin: '0 auto 20px',
          }}
        >
          <Lock size={24} color="#fff" />
        </div>
        
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          Chat Code Agent
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          请输入认证 Token 以访问系统
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border-color)'}`,
            padding: '0 8px',
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          <Lock size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入 Token"
            style={{
              flex: 1,
              fontSize: 14,
              padding: '10px 8px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              minWidth: 0,
            }}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            title="显示/隐藏"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              padding: 4,
              flexShrink: 0,
            }}
          >
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12, textAlign: 'left' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            background: loading ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: loading ? 'var(--text-tertiary)' : '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'var(--transition)',
          }}
        >
          {loading ? '验证中...' : '登 录'}
        </button>

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 16 }}>
          Token 在服务启动时显示在控制台日志中
        </div>
      </div>
    </div>
  )
}
