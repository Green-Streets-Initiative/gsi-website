// The ride assistant's suggested first messages (shared by the panel; no server code).

export const STARTERS = ['Plan a new ride with me', 'Design a route for my ride', "What's coming up this week?", 'Post an update for my next ride']

/** Starters that fit the page: a ride's own, or the general ones. */
export function startersFor(path: string): string[] {
  if (/^\/organizers\/rides\/[0-9a-f-]{36}/.test(path)) {
    return ['What needs doing next on this ride?', 'Design a route for this ride', 'Post an update for the next date', 'Help me promote this ride']
  }
  return STARTERS
}
