import { ManharBot } from './ManharBot';

/** What the bot is doing; drives the SVG robot's expression. */
export type BotMood =
  | 'idle'
  | 'ask'
  | 'hello'
  | 'explain'
  | 'fly'
  | 'done'
  | 'watch'
  | 'think'
  | 'cheer'
  | 'worry'
  | 'nudge'
  | 'sleep';

const MOOD: Record<BotMood, { talking?: boolean; wave?: boolean; flying?: boolean }> = {
  idle: {},
  ask: { talking: true, wave: true },
  hello: { talking: true, wave: true },
  explain: { talking: true },
  fly: { flying: true },
  done: { talking: true },
  watch: {},
  think: {},
  cheer: { talking: true, wave: true },
  worry: { talking: true },
  nudge: { talking: true },
  sleep: {},
};

/** Manhar Bot's face, drawn as a lightweight SVG so the production CSP does not need unsafe-eval. */
export function TourBotFace({ mood, size = 84 }: { mood: BotMood; size?: number }) {
  return (
    <div
      aria-hidden
      className="nx-bot-face"
      style={{ width: size, height: size, flexShrink: 0, margin: '6px 2px 0 6px' }}
    >
      <ManharBot {...MOOD[mood]} small={size < 72} />
    </div>
  );
}
