import { startExploreSession } from '../src/session/explore-session'

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    startExploreSession()
  },
})
