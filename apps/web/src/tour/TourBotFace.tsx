import { useEffect, useRef, useState } from 'react';
import { createAvatar, type AvatarController } from '@bible-strong/avatar-web';
import type { AvatarDefinition } from '@bible-strong/avatar-core';
import { ManharBot } from './ManharBot';
import definition from './manharbot.avatar.json';

/** What the bot is doing; each mood is one animation in manharbot.avatar.json. */
export type BotMood = 'idle' | 'ask' | 'hello' | 'explain' | 'fly' | 'done';

/** Reduced motion: a still face per mood instead of a running animation. */
const STILL: Record<BotMood, string> = {
  idle: 'neutral',
  ask: 'happy',
  hello: 'happy',
  explain: 'look-left',
  fly: 'look-left',
  done: 'happy',
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Manhar Bot's face, drawn by the Bible Strong Avatar Lab renderer (@bible-strong/avatar-web, AGPL-3.0, used
 * with the author's permission; see THIRD_PARTY_NOTICES.md). The character itself (manharbot.avatar.json) is ours.
 * If the renderer cannot start (very old browser, blocked SVG), the plain SVG robot is shown instead.
 */
export function TourBotFace({ mood, size = 84 }: { mood: BotMood; size?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<AvatarController | null>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    try {
      const reduced = prefersReducedMotion();
      const avatar = createAvatar(el, {
        definition: definition as unknown as AvatarDefinition,
        size,
        ...(reduced
          ? { defaultExpression: STILL[moodRef.current] }
          : { defaultAnimation: moodRef.current }),
      } as Parameters<typeof createAvatar>[1]);
      controller.current = avatar;
      return () => {
        avatar.destroy();
        controller.current = null;
      };
    } catch {
      setFailed(true);
      return;
    }
  }, [size]);

  useEffect(() => {
    const avatar = controller.current;
    if (!avatar) return;
    if (prefersReducedMotion()) avatar.setExpression(STILL[mood] as never);
    else avatar.play(mood as never);
  }, [mood]);

  if (failed) return <ManharBot flying={mood === 'fly'} wave={mood === 'hello' || mood === 'ask'} />;
  return <div ref={host} aria-hidden className="nx-bot-face" style={{ width: size, height: size, flexShrink: 0, margin: '6px 2px 0 6px' }} />;
}
