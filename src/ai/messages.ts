import type { LatencyReport } from '../audio/latency-meter'
import type { AiResult, ImageInput, PageInput, QuestionInput } from './ai-assistant'

/** Content script to background: ask the AI. The key and the request live in the worker. */
export type AiRequest =
  | { readonly type: 'ai-request'; readonly task: 'purpose' | 'summary'; readonly page: PageInput }
  | { readonly type: 'ai-request'; readonly task: 'image'; readonly image: ImageInput }
  | { readonly type: 'ai-request'; readonly task: 'question'; readonly question: QuestionInput }

export type AiResponse = AiResult

/** Content script to background: the latest delay measurements, for the settings page to read out. */
export type LatencyReportMessage = { readonly type: 'latency-report'; readonly report: LatencyReport }
