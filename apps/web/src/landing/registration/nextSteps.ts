import { FAILURE_MESSAGES, REGISTER_NEXT_STEPS, type BeginMode } from '../content';

/**
 * The three “what happens next” lines on the confirmation ticket. They follow what the visitor chose, and the
 * payment step is the honest interim one: a person sends the Cashfree payment link; nothing is charged yet.
 */
export function nextSteps(begin: BeginMode): readonly [string, string, string] {
  const [read = '', confirm = '', , workspace = '', first = ''] = REGISTER_NEXT_STEPS;
  const one = `${read} ${confirm}`.trim();
  const three = `${workspace} ${first}`.trim();
  if (begin === 'demo') {
    return [
      one,
      'We’ll agree a time for your live demo by WhatsApp or email.',
      'If Nexus fits, we confirm your plan, send your payment link and set up your Business Workspace.',
    ];
  }
  if (begin === 'pilot') {
    return [
      one,
      'We’ll call you for a short chat first. A 14-day pilot is by approval.',
      'Then we set up your Business Workspace and you open your first table.',
    ];
  }
  // INTEGRATION POINT: createCheckout(referenceCode) -> Cashfree payment link URL
  // Today a person sends the link; when the endpoint exists this line can link straight to it.
  return [one, FAILURE_MESSAGES.interim, three];
}
