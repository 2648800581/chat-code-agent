import { useEffect, useState } from 'react'
import { Header } from './components/common/Header'
import { ChatSidebar } from './components/chat/ChatSidebar'
import { ChatWindow } from './components/chat/ChatWindow'
import { SkillsPanel } from './components/chat/SkillsPanel'
import { ToolsPanel } from './components/chat/ToolsPanel'
import { RagPanel } from './components/chat/RagPanel'
import { CronPanel } from './components/chat/CronPanel'
import { SettingsPanel } from './components/common/SettingsPanel'
import { LoginScreen } from './components/common/LoginScreen'
import { CodeSidebar } from './components/code/CodeSidebar'
import { CodeEditor } from './components/code/CodeEditor'
import { CodeAIChat } from './components/code/CodeAIChat'
import { useAppStore, useApiStore, useSkillsStore } from './store'
import { useAuthStore } from './utils/auth'
import { PanelRightOpen } from 'lucide-react'

export default function App() {
  const { theme, mode, leftSidebarOpen, rightPanelOpen, toggleRightPanel, showSkillsPanel, showCronPanel, showToolsPanel, showRagPanel, setShowSkillsPanel, setShowCronPanel, setShowToolsPanel, setShowRagPanel } = useAppStore()
  const loadConfig = useApiStore((s) => s.loadConfig)
  const loadSkills = useSkillsStore((s) => s.loadSkills)
  const { isAuthenticated, token, clearToken } = useAuthStore()
  const [showSettings, setShowSettings] = useState(false)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Verify token on mount
  useEffect(() => {
    const verifyStoredToken = async () => {
      if (!isAuthenticated || !token) {
        setVerifying(false)
        return
      }
      
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (!res.ok) {
          clearToken()
        }
      } catch {
        // Backend not ready or token invalid
        clearToken()
      }
      setVerifying(false)
    }
    verifyStoredToken()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load API config and skills from backend on mount (only if authenticated)
  useEffect(() => {
    if (isAuthenticated && !verifying) {
      loadConfig()
      loadSkills()
    }
  }, [isAuthenticated, verifying, loadConfig, loadSkills])

  // Show loading while verifying
  if (verifying) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-tertiary)',
        fontSize: 14,
      }}>
        验证中...
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      <Header onOpenSettings={() => setShowSettings(true)} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {mode === 'chat' ? (
          <>
            <ChatSidebar />
            <ChatWindow />
          </>
        ) : (
          <>
            {leftSidebarOpen && <CodeSidebar />}

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <CodeEditor />
              {rightPanelOpen && <CodeAIChat />}
            </div>

            {!rightPanelOpen && (
              <button
                onClick={toggleRightPanel}
                title="打开右侧栏"
                style={{
                  position: 'fixed',
                  right: 8,
                  top: 56,
                  zIndex: 50,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                }}
              >
                <PanelRightOpen size={18} />
              </button>
            )}
          </>
        )}
      </div>

      {showSkillsPanel && <SkillsPanel onClose={() => setShowSkillsPanel(false)} />}
      {showToolsPanel && <ToolsPanel onClose={() => setShowToolsPanel(false)} />}
      {showRagPanel && <RagPanel onClose={() => setShowRagPanel(false)} />}
      {showCronPanel && <CronPanel onClose={() => setShowCronPanel(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}
