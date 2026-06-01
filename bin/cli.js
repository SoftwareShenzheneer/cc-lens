#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { spawn, exec } = require('child_process')
const net  = require('net')
const os   = require('os')
const path = require('path')
const fs   = require('fs')

const PKG_DIR    = path.join(__dirname, '..')
const SERVER_JS  = path.join(PKG_DIR, '.next', 'standalone', 'server.js')

// ANSI helpers — Claude's warm orange palette
const O   = '\x1b[38;5;208m'  // orange
const O2  = '\x1b[38;5;214m'  // amber
const DIM = '\x1b[2m'
const B   = '\x1b[1m'
const R   = '\x1b[0m'

// OSC 8 terminal hyperlink
function link(text, url) {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`
}

function printBanner() {
  const art = [
    `${O}${B} ██████╗ ██████╗     ██╗     ███████╗███╗   ██╗███████╗${R}`,
    `${O}${B}██╔════╝██╔════╝     ██║     ██╔════╝████╗  ██║██╔════╝${R}`,
    `${O2}${B}██║     ██║          ██║     █████╗  ██╔██╗ ██║███████╗${R}`,
    `${O2}${B}██║     ██║          ██║     ██╔══╝  ██║╚██╗██║╚════██║${R}`,
    `${O}${B}╚██████╗╚██████╗     ███████╗███████╗██║ ╚████║███████║${R}`,
    `${O}${B} ╚═════╝ ╚═════╝     ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝${R}`,
  ]

  const author = link(`${O2}Arindam${R}`, 'https://github.com/Arindam200')

  console.log()
  art.forEach((line) => console.log('  ' + line))
  console.log()
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude')
  console.log(`  ${B}${O}Claude Code Lens${R}   ${DIM}—  your ~/.claude/ at a glance${R}`)
  console.log(`  ${DIM}Made with ♥ by ${R}${author}`)
  console.log()
  console.log(`  ${DIM}Config dir:${R}  ${O2}${configDir}${R}`)
  if (process.env.CLAUDE_CONFIG_DIR) {
    console.log(`  ${DIM}             (from CLAUDE_CONFIG_DIR)${R}`)
  }
  console.log()
}

function findFreePort(port = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(findFreePort(port + 1)))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(port)))
  })
}

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32'  ? `start "" "${url}"` :
                                    `xdg-open "${url}"`
  exec(cmd)
}

async function main() {
  printBanner()

  if (!fs.existsSync(SERVER_JS)) {
    console.error(`  ${O}✗${R}  Standalone build not found at ${SERVER_JS}`)
    console.error(`     If you're running from a cloned repo, run ${B}npm run build:dist${R} first.`)
    process.exit(1)
  }

  // Bind to loopback only — this server exposes private Claude history.
  // Users who really need LAN access can set HOSTNAME=0.0.0.0 explicitly.
  const hostname = process.env.HOSTNAME ?? '127.0.0.1'
  const port     = await findFreePort(Number(process.env.PORT) || 3000)
  const url      = `http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`

  // Security warning for LAN access
  if (hostname === '0.0.0.0') {
    console.log(`  ${O}⚠${R}  ${B}Security Warning:${R} Exposing to LAN without authentication`)
    console.log(`     Anyone on your network can access your Claude Code history`)
    console.log(`     This includes prompts, code, file paths, and session data`)
    console.log()
  }

  console.log(`  ${DIM}Starting server on${R} ${O2}${B}${url}${R}\n`)

  const child = spawn(process.execPath, [SERVER_JS], {
    cwd: path.dirname(SERVER_JS),
    stdio: [process.platform === 'win32' ? 'ignore' : 'inherit', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), HOSTNAME: hostname, NODE_ENV: 'production' },
  })

  let opened = false
  function checkReady(text) {
    if (!opened && /Local:|ready|started server|listening on/i.test(text)) {
      opened = true
      console.log(`\n  ${O}✓${R}  Opening ${B}${url}${R} in your browser…\n`)
      openBrowser(url)
    }
  }

  child.stdout.on('data', (d) => { process.stdout.write(d); checkReady(d.toString()) })
  child.stderr.on('data', (d) => { process.stderr.write(d); checkReady(d.toString()) })

  child.on('exit', (code) => process.exit(code ?? 0))

  process.on('SIGINT',  () => { child.kill(); process.exit(0) })
  process.on('SIGTERM', () => { child.kill(); process.exit(0) })
}

main().catch((err) => { console.error(err); process.exit(1) })
