import { useEffect, useMemo, useState } from 'react';
import { type CatalogItem, type ModifierGroup, catalogApi } from '../api';

export type GroupsState = 'loading' | 'ready' | 'failed';

/** Loads modifier groups once, and only when some menu item links to one. */
export function useModifierGroups(items: CatalogItem[]): { groupsById: ReadonlyMap<string, ModifierGroup>; groupsState: GroupsState } {
  const needsGroups = useMemo(() => items.some((i) => (i.modifierGroups?.length ?? 0) > 0), [items]);
  const [groupsById, setGroupsById] = useState<ReadonlyMap<string, ModifierGroup>>(new Map());
  const [groupsState, setGroupsState] = useState<GroupsState>('loading');
  useEffect(() => {
    if (!needsGroups) {
      setGroupsState('ready');
      return;
    }
    let live = true;
    catalogApi
      .listModifierGroups()
      .then((list) => {
        if (!live) return;
        setGroupsById(new Map(list.map((g) => [g.id, g])));
        setGroupsState('ready');
      })
      .catch(() => {
        if (live) setGroupsState('failed');
      });
    return () => {
      live = false;
    };
  }, [needsGroups]);
  return { groupsById, groupsState };
}
