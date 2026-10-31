import type { ServiceLineStatus, ServiceRequestStatus } from '../api';

/**
 * Per-line state chip. `new` = only in this screen (not saved yet); the rest describe a line the server knows.
 * Text + shape, never colour alone (see LineChip).
 */
export type LineChip = 'new' | 'saved' | 'sent' | 'preparing' | 'ready' | 'served' | 'removing';

export function chipForExisting(orderStatus: ServiceRequestStatus, lineStatus: ServiceLineStatus): LineChip {
  switch (lineStatus) {
    case 'PREPARING':
      return 'preparing';
    case 'READY':
      return 'ready';
    case 'SERVED':
      return 'served';
    default:
      return orderStatus === 'DRAFT' ? 'saved' : 'sent';
  }
}
