import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

export function isPlaywrightAvailable(): boolean {
  try {
    const executablePath = chromium.executablePath()
    return (
      typeof executablePath === 'string' && executablePath.length > 0 && existsSync(executablePath)
    )
  } catch {
    return false
  }
}
