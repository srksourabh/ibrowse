import type { AiRequest, AiResponse } from '../ai/messages'
import { collectPagePayload, imageTargetFor } from '../ai/page-excerpt'
import type { HoverController } from '../hover/hover-controller'
import type { Services } from './services'

export interface SessionAi {
  /** Describes the image under the pointer. */
  describeThis(): void
  /** Summarises the page. */
  summarize(): void
  /** A one-line purpose for the briefing. Null when AI is off or has nothing to say; never rejects. */
  purpose(): Promise<string | null>
}

const OFF = 'AI features are off. Turn them on in settings.'
const WORKING = 'One moment.'

/**
 * The page side of the AI features. Requests go to the background worker,
 * where the key is; this only gathers what may be sent and speaks the answer.
 */
export function createAi(s: Services, hover: Pick<HoverController, 'current'>): SessionAi {
  const ask = (request: AiRequest): Promise<AiResponse> => chrome.runtime.sendMessage(request)

  // AI answers are long-form, so a cloud voice may read them; they are speech like any other.
  const say = (text: string): void => void s.speech.speak({ text, rate: s.rate(), kind: 'reading' })
  const sayShort = (text: string): void => void s.speech.speak({ text, rate: s.rate() })

  async function run(request: AiRequest): Promise<void> {
    sayShort(WORKING)
    try {
      const answer = await ask(request)
      if (answer.ok) say(answer.text)
      else if (answer.kind !== 'cancelled') sayShort(answer.reason)
    } catch (error) {
      s.reportError(error)
      sayShort('Could not reach iBrowse’s helper. Try again.')
    }
  }

  return {
    describeThis() {
      if (!s.settings().aiAssist) return sayShort(OFF)
      const target = hover.current ? imageTargetFor(hover.current) : null
      if (!target) return sayShort('There is no image under the pointer to describe.')
      void run({
        type: 'ai-request',
        task: 'image',
        image: { url: target.url, alt: target.alt, pageTitle: document.title, context: target.context },
      })
    },
    summarize() {
      if (!s.settings().aiAssist) return sayShort(OFF)
      void run({ type: 'ai-request', task: 'summary', page: collectPagePayload(document) })
    },
    async purpose() {
      if (!s.settings().aiAssist) return null
      try {
        const answer = await ask({ type: 'ai-request', task: 'purpose', page: collectPagePayload(document) })
        return answer.ok ? answer.text : null
      } catch (error) {
        s.reportError(error)
        return null
      }
    },
  }
}
