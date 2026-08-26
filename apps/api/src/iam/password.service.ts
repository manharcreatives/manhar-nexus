import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Algorithm, hash, verify } from '@node-rs/argon2';

/**
 * argon2id password hashing (ADR-004). Params come from env (OWASP 2024 floor)
 * so they can be raised over time. Includes a dummy-verify path so that an
 * unknown user costs the same as a wrong password (enumeration/timing defense).
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    // Precompute a decoy hash used to equalize timing for unknown users.
    this.dummyHash = await this.hash('nexus-decoy-password-not-a-secret');
  }

  private options() {
    return {
      algorithm: Algorithm.Argon2id,
      memoryCost: this.config.get<number>('ARGON2_MEMORY_KIB', 19456),
      timeCost: this.config.get<number>('ARGON2_TIME_COST', 2),
      parallelism: this.config.get<number>('ARGON2_PARALLELISM', 1),
    };
  }

  hash(plain: string): Promise<string> {
    return hash(plain, this.options());
  }

  /** Verify a plaintext against a stored hash. */
  async verify(storedHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(storedHash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Constant-cost verify that tolerates a missing user/hash: always runs a real
   * argon2 verify (against the decoy when no hash is provided) so response time
   * does not reveal whether the account exists.
   */
  async verifyOrDummy(storedHash: string | null | undefined, plain: string): Promise<boolean> {
    if (!storedHash) {
      await this.verify(this.dummyHash, plain);
      return false;
    }
    return this.verify(storedHash, plain);
  }
}
