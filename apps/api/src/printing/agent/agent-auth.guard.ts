import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { AgentService } from './agent.service';
import type { PrintAgent } from '@prisma/client';

export interface AgentRequest extends Request {
  printAgent?: PrintAgent;
}

/**
 * Guard for Local Print Agent endpoints (not user JWT).
 * Validates the agent's bearer secret by sha256-hashing it and looking up
 * the matching active PrintAgent row. Sets req.printAgent on success.
 *
 * Apply at controller class level alongside @Public() (which skips JwtAuthGuard).
 */
@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(private readonly agents: AgentService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AgentRequest>();
    const secret = this.extractSecret(req);
    if (!secret) throw new UnauthorizedError('Missing agent bearer token');

    const hash = createHash('sha256').update(secret).digest('hex');
    const agent = await this.agents.validateSecret(hash);
    if (!agent) throw new UnauthorizedError('Invalid or inactive agent token');

    req.printAgent = agent;
    return true;
  }

  private extractSecret(req: AgentRequest): string | null {
    const header = req.header('authorization') ?? '';
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}

/** Injects the authenticated PrintAgent from the request. */
export const CurrentAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PrintAgent => {
    const req = ctx.switchToHttp().getRequest<AgentRequest>();
    if (!req.printAgent) throw new UnauthorizedError('No authenticated agent');
    return req.printAgent;
  },
);
