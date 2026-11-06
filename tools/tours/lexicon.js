const fixed = (id, phrase, note, aliases = []) => ({ id, phrase, note, aliases });
export const instructions = [
  fixed('open', 'Open app', 'Reload Home and reset all reactions. Can reset a tour mid-way.'),
  ...['left', 'right'].map(direction => fixed(`swipe-${direction}`, `Swipe ${direction}`, `Home: visibly drag the current card ${direction}. ${direction === 'left' ? 'Passes it to the back of the queue.' : 'Creates a match.'}`, direction === 'right' ? ['Swipe right on the next card'] : [])),
  ...['Undo', 'Pass', 'Superlike', 'Like', 'Share'].map(action => fixed(`click-${action.toLowerCase()}`, `Click ${action}`, `Home: activate ${action}. ${action === 'Undo' ? 'Requires a previous decision.' : action === 'Superlike' ? 'Requires a website; matches, checks its destination, and closes the new tab.' : action === 'Share' ? 'Requires a repository; checks its destination and closes the new tab.' : action === 'Like' ? 'Matches the current card.' : 'Moves the current card to the back.'}`)),
  ...['Home', 'Browser', 'Likes', 'Chats', 'Profile'].map(view => fixed(`view-${view.toLowerCase()}`, `Open ${view}`, `Navigate to ${view} through the bottom navigation.`, view === 'Chats' ? ['Open Chat'] : [])),
  { id: 'project', phrase: 'Open project', parameter: 'project', note: 'Open Browser and select this project. Names must identify exactly one configured item.' },
  fixed('first-conversation', 'Open first conversation', 'Chats: open the first matched conversation. Requires at least one match.'),
  { id: 'conversation', phrase: 'Open conversation', parameter: 'project', note: 'Chats: open this matched project’s conversation. Match it first.' },
  fixed('author', 'Click link to author', 'Inside a conversation: follow the link to Profile.'),
  { id: 'contact', phrase: 'Click contact', parameter: 'contact', note: 'Profile: click this contact link, check its configured destination, and close the new tab.' },
  fixed('email', 'Click email', 'Profile: check and click the email link without launching a mail application.'),
  ...['down', 'up'].map(direction => fixed(`scroll-${direction}`, `Scroll ${direction}`, `Scroll the visible page or Home card bio ${direction} by half its height. Fails when no further scrolling is possible.`)),
  fixed('back', 'Go back', 'Return to a previous page visited during this tour. Cannot leave the portfolio.'),
  { id: 'wait', phrase: 'Wait', parameter: 'seconds', note: 'Pause for more than 0 and at most 60 seconds. No additional reading pause.' },
];

export function formatInstruction(id, value) {
  const instruction = instructions.find(item => item.id === id);
  if (!instruction) throw new Error(`Unknown instruction: ${id}`);
  if (!instruction.parameter) return instruction.phrase;
  if (instruction.parameter === 'seconds') {
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(String(value)) || !(Number(value) > 0 && Number(value) <= 60)) throw new Error('Wait must be greater than 0 and at most 60 seconds');
    return `Wait ${Number(value)} seconds`;
  }
  if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) throw new Error('Choose a nonempty single-line name');
  return `${instruction.phrase} ${JSON.stringify(value)}`;
}

export function parseTour(text) {
  const steps = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    try {
      let step;
      for (const instruction of instructions) {
        if (!instruction.parameter && [instruction.phrase, ...instruction.aliases].some(phrase => phrase.toLowerCase() === line.toLowerCase())) step = { id: instruction.id };
        if (instruction.parameter === 'seconds') {
          const match = line.match(/^Wait (\S+) seconds$/i);
          if (match) step = { id: instruction.id, value: match[1] };
        } else if (instruction.parameter && line.toLowerCase().startsWith(`${instruction.phrase.toLowerCase()} `)) {
          step = { id: instruction.id, value: JSON.parse(line.slice(instruction.phrase.length).trim()) };
        }
        if (step) break;
      }
      if (!step) throw new Error(`Unknown instruction: ${line}`);
      const canonical = formatInstruction(step.id, step.value);
      steps.push({ ...step, line: index + 1, text: canonical });
    } catch (error) {
      throw new Error(`Line ${index + 1}: ${error.message}`);
    }
  }
  if (!steps.length) throw new Error('Tour is empty');
  return steps;
}

export const exampleTour = 'Open app\nWait 2 seconds\nSwipe left\nSwipe right\nOpen Chats\nOpen first conversation\nClick link to author\nWait 3 seconds\n';
