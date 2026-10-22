// What each setup step asks the assistant, wherever "Do it with the
// assistant" appears (Home's suggestions, the Setup page). One list, so the
// two never ask differently.
export const SETUP_PROMPTS: Record<string, string> = {
  success: 'Help me say what success looks like for our program.',
  profile: 'Help me complete our company profile.',
  logo: "I'd like to add our logo.",
  advisor: 'Can you set up our Commute Advisor?',
  employees: 'Help me get more of our team into Shift. I can attach our staff list.',
  challenge: 'Help me set up our first challenge.',
}
