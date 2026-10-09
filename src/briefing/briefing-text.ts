import type { LayoutModel, MediaInfo, RegionInfo } from './layout-model'
import { placementPhrase } from './placement'

const MAX_ITEMS = 7
const MAX_TITLE_LENGTH = 60

const KIND_LABELS: Readonly<Record<LayoutModel['kind'], string>> = {
  article: 'Article page',
  form: 'Form page',
  page: 'Web page',
}

const REGION_ORDER: readonly RegionInfo['kind'][] = ['hero', 'navigation', 'sidebar', 'search']
const REGION_LABELS: Readonly<Record<RegionInfo['kind'], string>> = {
  hero: 'Hero section',
  navigation: 'Navigation',
  sidebar: 'Sidebar',
  search: 'Search box',
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

function mediaPhrase(media: MediaInfo): string {
  const noun = media.kind === 'picture' ? 'Picture' : 'Video'
  if (media.count > 1) return plural(media.count, noun.toLowerCase())
  return media.placement ? `${noun} ${placementPhrase(media.placement)}` : noun
}

function items(model: LayoutModel): string[] {
  const regions = REGION_ORDER.flatMap((kind) =>
    model.regions
      .filter((region) => region.kind === kind)
      .map((region) => `${REGION_LABELS[kind]} ${placementPhrase(region.placement)}`),
  )
  const { counts } = model
  const countPhrases = (
    [
      [counts.paragraphs, 'paragraph'],
      [counts.headings, 'heading'],
      [counts.links, 'link'],
      [counts.buttons, 'button'],
      [counts.forms, 'form'],
      [counts.frames, 'embedded frame'],
    ] as const
  )
    .filter(([count]) => count > 0)
    .map(([count, noun]) => plural(count, noun))
  return [...model.media.map(mediaPhrase), ...regions, ...countPhrases]
}

/** Joins items into one phrase, lower-casing every item after the first. */
function joinItems(parts: readonly string[]): string {
  return parts
    .map((part, i) => (i === 0 ? part : part.charAt(0).toLowerCase() + part.slice(1)))
    .join(', ')
}

function shortTitle(title: string): string {
  if (!title) return 'Untitled page'
  return title.length <= MAX_TITLE_LENGTH ? title : title.slice(0, MAX_TITLE_LENGTH).trimEnd()
}

export interface Briefing {
  readonly text: string
  readonly askToRead: boolean
}

/**
 * The spoken summary given when Explore Mode starts (PRD §5.2). Short by
 * default; `detailed` lifts the item cap and lists the headings.
 */
export function briefingText(model: LayoutModel, options: { detailed?: boolean } = {}): Briefing {
  const title = shortTitle(model.title)
  const all = items(model)
  if (all.length === 0) {
    return { text: `${title}. Nothing to read on this page.`, askToRead: false }
  }

  const detailed = options.detailed ?? false
  const shown = detailed ? all : all.slice(0, MAX_ITEMS)
  const askToRead = model.counts.paragraphs + model.counts.headings > 0
  const sentences = [
    `${title}.`,
    `${KIND_LABELS[model.kind]}.`,
    `${joinItems(shown)}.`,
    ...(detailed && model.headings.length > 0 ? [`Headings: ${model.headings.join('; ')}.`] : []),
    ...(askToRead ? ['Want me to read it?'] : []),
  ]
  return { text: sentences.join(' '), askToRead }
}

/** What is on screen now, after scrolling. Empty when nothing is. */
export function viewportBriefing(model: LayoutModel): string {
  const shown = items(model).slice(0, MAX_ITEMS)
  return shown.length === 0 ? '' : `${joinItems(shown)}.`
}
