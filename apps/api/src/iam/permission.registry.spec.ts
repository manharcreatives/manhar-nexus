import { PermissionRegistry, WILDCARD, permissionKey } from './permission.registry';

describe('PermissionRegistry', () => {
  it('ships core + platform permissions', () => {
    const r = new PermissionRegistry();
    expect(r.has('core.user.create')).toBe(true);
    expect(r.has('platform.business.create')).toBe(true);
    expect(r.has('platform.business.delete')).toBe(true);
    expect(r.has('core.nonexistent.action')).toBe(false);
  });

  it('registers the public-registration platform permissions as restricted (ADR-033)', () => {
    const r = new PermissionRegistry();
    for (const key of ['platform.registration.view', 'platform.registration.manage']) {
      expect(r.has(key)).toBe(true);
      expect(r.isRestricted(key)).toBe(true);
    }
    // Reachable only through the platform-admin wildcard: no system role lists them explicitly.
    expect(r.list('platform').filter((d) => d.resource === 'registration')).toHaveLength(2);
  });

  it('treats the wildcard as always present', () => {
    const r = new PermissionRegistry();
    expect(r.has(WILDCARD)).toBe(true);
  });

  it('flags platform + IAM-critical permissions as restricted', () => {
    const r = new PermissionRegistry();
    expect(r.isRestricted('platform.business.create')).toBe(true);
    expect(r.isRestricted('platform.business.delete')).toBe(true);
    expect(r.isRestricted('core.role.create')).toBe(true);
    expect(r.isRestricted('core.user.view')).toBe(false);
  });

  it('rejects duplicate registration', () => {
    const r = new PermissionRegistry();
    expect(() =>
      r.register([
        { module: 'core', resource: 'user', action: 'create', description: 'dup' },
      ]),
    ).toThrow(/Duplicate permission/);
  });

  it('lets modules add new permissions (Phase 5 seam)', () => {
    const r = new PermissionRegistry();
    r.register([{ module: 'catalog', resource: 'item', action: 'create', description: 'x' }]);
    expect(r.has('catalog.item.create')).toBe(true);
  });

  it('builds keys as module.resource.action', () => {
    expect(permissionKey({ module: 'core', resource: 'user', action: 'view' })).toBe('core.user.view');
  });
});
