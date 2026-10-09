import type { LatencyMeter } from '../audio/latency-meter'
import type { LatencyReportMessage } from '../ai/messages'
import type { Services } from './services'

const PUBLISH_EVERY_MS = 5000

/**
 * While Explore Mode is on and "Measure delays" is switched on, passes the
 * latest measurements to the background worker every few seconds, so the
 * settings page can read them out. Does nothing if nothing has changed.
 */
export function startLatencyPublisher(s: Services, meter: Pick<LatencyMeter, 'report'>): () => void {
  let last = ''
  const timer = setInterval(() => {
    if (!s.settings().latencyReadout) return
    const report = meter.report()
    const json = JSON.stringify(report)
    if (json === last) return
    last = json
    const message: LatencyReportMessage = { type: 'latency-report', report }
    chrome.runtime.sendMessage(message).catch(s.reportError)
  }, PUBLISH_EVERY_MS)
  return () => clearInterval(timer)
}
