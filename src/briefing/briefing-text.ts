import type { LayoutModel, MediaInfo, PanelSummary, RegionInfo } from './layout-model'
import type { PanelKind } from './panels'
import { placementPhrase } from './placement'

const MAX_ITEMS = 7
const MAX_PANEL_ITEMS = 3
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

export const PANEL_NAMES: Readonly<Record<PanelKind, string>> = {
  header: 'Header',
  left: 'Left panel',
  main: 'Main content',
  right: 'Right panel',
  footer: 'Footer',
}

/** What a panel holds, most telling first. Headings are left out: the panel is named after its main one. */
function panelItems({ contents }: PanelSummary): string[] {
  return [
    ...(contents.logo ? ['logo'] : []),
    ...(contents.search ? ['search box'] : []),
    ...(
      [
        [contents.paragraphs, 'paragraph'],
        [contents.images, 'picture'],
        [contents.links, 'link'],
        [contents.buttons, 'button'],
        [contents.inputs, 'field'],
      ] as const
    )
      .filter(([count]) => count > 0)
      .map(([count, noun]) => plural(count, noun)),
  ]
}

/** "Left panel, Categories: 3 links." The panel's own label wins over its heading. */
export function panelSentence(panel: PanelSummary, detailed: boolean): string {
  const title = panel.label || panel.contents.firstHeading
  const name = title ? `${PANEL_NAMES[panel.kind]}, ${title}` : PANEL_NAMES[panel.kind]
  const all = panelItems(panel)
  const shown = detailed ? all : all.slice(0, MAX_PANEL_ITEMS)
  return shown.length === 0 ? `${name}.` : `${name}: ${shown.join(', ')}.`
}

/** A page with more than its main content is briefed panel by panel. */
const hasPanels = (model: LayoutModel): boolean => model.panels.length >= 2

function panelSentences(model: LayoutModel, detailed: boolean): string[] {
  const frames = model.counts.frames
  return [
    ...model.panels.map((panel) => panelSentence(panel, detailed)),
    ...(frames > 0 ? [`${plural(frames, 'embedded frame')}.`] : []),
  ]
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
  if (all.length === 0 && !hasPanels(model)) {
    return { text: `${title}. Nothing to read on this page.`, askToRead: false }
  }

  const detailed = options.detailed ?? false
  const shown = detailed ? all : all.slice(0, MAX_ITEMS)
  const askToRead = model.counts.paragraphs + model.counts.headings > 0
  const sentences = [
    `${title}.`,
    `${KIND_LABELS[model.kind]}.`,
    ...(hasPanels(model) ? panelSentences(model, detailed) : [`${joinItems(shown)}.`]),
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
