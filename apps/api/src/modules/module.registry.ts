import { Injectable, OnModuleInit } from '@nestjs/common';
import { PermissionRegistry } from '../iam/permission.registry';
import { BUILT_IN_MODULES, type ModuleManifest } from './module-manifest';

/**
 * Compile-time module catalog. Holds all registered ModuleManifests, validates
 * the dependency DAG (no cycles, no unknown deps), and registers each module's
 * permissions into the PermissionRegistry on startup.
 */
@Injectable()
export class ModuleRegistry implements OnModuleInit {
  private readonly manifests = new Map<string, ModuleManifest>();

  constructor(private readonly permissions: PermissionRegistry) {
    for (const m of BUILT_IN_MODULES) {
      this.manifests.set(m.key, m);
    }
  }

  onModuleInit(): void {
    this.validateDag();
    for (const manifest of this.manifests.values()) {
      if (manifest.permissions.length > 0) {
        this.permissions.register(manifest.permissions);
      }
    }
  }

  get(key: string): ModuleManifest | undefined {
    return this.manifests.get(key);
  }

  has(key: string): boolean {
    return this.manifests.has(key);
  }

  list(): ModuleManifest[] {
    return [...this.manifests.values()];
  }

  keys(): string[] {
    return [...this.manifests.keys()];
  }

  /**
   * Returns the dependency chain for a module in activation order (deps first).
   * Throws if a dependency is unknown.
   */
  resolveDependencies(key: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    this.visitDeps(key, visited, result, []);
    return result.filter((k) => k !== key);
  }

  /** Detect dependency cycles and unknown deps at startup (fail fast). */
  private validateDag(): void {
    for (const key of this.manifests.keys()) {
      const visited = new Set<string>();
      this.visitDeps(key, visited, [], [key]);
    }
  }

  private visitDeps(
    key: string,
    visited: Set<string>,
    result: string[],
    stack: string[],
  ): void {
    if (visited.has(key)) return;
    visited.add(key);
    const manifest = this.manifests.get(key);
    if (!manifest) throw new Error(`Unknown module dependency: '${key}'`);
    for (const dep of manifest.dependencies) {
      if (stack.includes(dep)) {
        throw new Error(`Circular module dependency detected: ${[...stack, dep].join(' → ')}`);
      }
      this.visitDeps(dep, visited, result, [...stack, dep]);
    }
    result.push(key);
  }
}
