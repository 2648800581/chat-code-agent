import { WebSocketServer } from 'ws'
import { spawn } from 'node-pty'
import fs from 'fs'
import os from 'os'

const sessions = new Map()

export function attachTerminal(server) {
  const wss = new WebSocketServer({ server, path: '/ws/terminal' })

  wss.on('connection', (ws, req) => {
    let sessionId = null
    let ptyProcess = null

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw)

        if (msg.type === 'init') {
          const cwd = msg.cwd || os.homedir()
          sessionId = Date.now().toString()
          const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'

          ptyProcess = spawn(shell, [], {
            name: 'xterm-256color',
            cols: msg.cols || 80,
            rows: msg.rows || 24,
            cwd,
            env: process.env,
          })

          let lastCwd = cwd

          ptyProcess.onData((data) => {
            if (ws.readyState === ws.OPEN) {
              // Detect CWD change via /proc
              try {
                const currentCwd = fs.readlinkSync(`/proc/${ptyProcess.pid}/cwd`)
                if (currentCwd !== lastCwd) {
                  lastCwd = currentCwd
                  const folderName = currentCwd.split('/').pop() || currentCwd
                  ws.send(JSON.stringify({ type: 'cwd', cwd: currentCwd, title: folderName }))
                }
              } catch {}
              ws.send(JSON.stringify({ type: 'data', data, id: sessionId }))
            }
          })

          ptyProcess.onExit(({ exitCode }) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'exit', code: exitCode, id: sessionId }))
            }
            sessions.delete(sessionId)
          })

          sessions.set(sessionId, { ptyProcess, ws, cwd })
          ws.send(JSON.stringify({ type: 'ready', id: sessionId, cwd }))
        }

        if (msg.type === 'resize') {
          if (ptyProcess) {
            ptyProcess.resize(msg.cols, msg.rows)
          }
        }

        if (msg.type === 'input') {
          if (ptyProcess) {
            ptyProcess.write(msg.data)
          }
        }
      } catch {}
    })

    ws.on('close', () => {
      if (sessionId) {
        const s = sessions.get(sessionId)
        if (s?.ptyProcess) {
          s.ptyProcess.kill()
        }
        sessions.delete(sessionId)
      }
    })
  })
}
