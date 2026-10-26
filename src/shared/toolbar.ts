export interface ToolbarState {
  readonly badge: string
  readonly title: string
}

/**
 * What the toolbar button shows for a tab. The title is what a screen reader
 * says on the button, so it gives the state and what a click will do.
 */
export function toolbarState(enabled: boolean): ToolbarState {
  return enabled
    ? { badge: 'ON', title: 'iBrowse: Explore Mode on. Click to turn it off.' }
    : { badge: '', title: 'iBrowse: Explore Mode off. Click to turn it on.' }
}
