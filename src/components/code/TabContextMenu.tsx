interface TabContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onCloseCurrent: () => void
  onCloseOthers: () => void
  onCloseRight: () => void
  onCloseAll: () => void
  onSplitRight?: () => void
  hasRightTabs: boolean
  hasOtherTabs: boolean
  showSplit?: boolean
}

export function TabContextMenu({ x, y, onClose, onCloseCurrent, onCloseOthers, onCloseRight, onCloseAll, onSplitRight, hasRightTabs, hasOtherTabs, showSplit }: TabContextMenuProps) {
  const items = [
    { label: '关闭当前文件', onClick: onCloseCurrent, show: true },
    { label: '关闭其他所有文件', onClick: onCloseOthers, show: hasOtherTabs },
    { label: '关闭右侧文件', onClick: onCloseRight, show: hasRightTabs },
    { label: '全部关闭', onClick: onCloseAll, show: true },
  ]

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          zIndex: 1000,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)',
          padding: '4px 0',
          minWidth: 160,
        }}
      >
        {items.filter(i => i.show).map((item, idx) => (
          <div
            key={idx}
            onClick={() => { item.onClick(); onClose() }}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {item.label}
          </div>
        ))}
        {showSplit && onSplitRight && (
          <>
            <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
            <div
              onClick={() => { onSplitRight(); onClose() }}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              向右拆分
            </div>
          </>
        )}
      </div>
    </>
  )
}
