const STORAGE_KEY = 'dualnback.localProfiles.v1';
const BACKUP_FORMAT = 'dualnback-local-backup';
const BACKUP_VERSION = 1;

const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const makeProfile = (name = 'Perfil 1') => ({
  id: makeId(),
  name: String(name || 'Perfil').trim().slice(0, 40) || 'Perfil',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  userData: {},
  settings: {},
  sessions: [],
  dailyStats: [],
});

const isProfile = (value) => Boolean(
  value && typeof value === 'object' &&
  typeof value.id === 'string' && typeof value.name === 'string'
);

const normalizeStore = (raw) => {
  const profiles = Array.isArray(raw?.profiles) ? raw.profiles.filter(isProfile) : [];
  const safeProfiles = profiles.length ? profiles : [makeProfile()];
  const selectedId = safeProfiles.some((profile) => profile.id === raw?.selectedId)
    ? raw.selectedId
    : safeProfiles[0].id;
  return { version: 1, selectedId, profiles: safeProfiles };
};

export const loadProfileStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = normalizeStore({});
      saveProfileStore(initial);
      return initial;
    }
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    console.warn('[LocalProfiles] Could not read profile storage; starting safely.', error);
    const initial = normalizeStore({});
    saveProfileStore(initial);
    return initial;
  }
};

export const saveProfileStore = (store) => {
  const normalized = normalizeStore(store);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const createLocalProfile = (store, name) => {
  const profile = makeProfile(name || `Perfil ${store.profiles.length + 1}`);
  const next = { ...store, selectedId: profile.id, profiles: [...store.profiles, profile] };
  return { store: saveProfileStore(next), profile };
};

export const renameLocalProfile = (store, id, name) => {
  const cleanName = String(name || '').trim().slice(0, 40);
  if (!cleanName) throw new Error('Digite um nome para o perfil.');
  if (!store.profiles.some((profile) => profile.id === id)) throw new Error('Perfil não encontrado.');
  return saveProfileStore({
    ...store,
    profiles: store.profiles.map((profile) => profile.id === id
      ? { ...profile, name: cleanName, updatedAt: new Date().toISOString() }
      : profile),
  });
};

export const deleteLocalProfile = (store, id) => {
  if (store.profiles.length <= 1) throw new Error('Mantenha pelo menos um perfil.');
  if (!store.profiles.some((profile) => profile.id === id)) throw new Error('Perfil não encontrado.');
  const profiles = store.profiles.filter((profile) => profile.id !== id);
  const selectedId = store.selectedId === id ? profiles[0].id : store.selectedId;
  return saveProfileStore({ ...store, profiles, selectedId });
};

export const selectLocalProfile = (store, id) => {
  if (!store.profiles.some((profile) => profile.id === id)) throw new Error('Perfil não encontrado.');
  return saveProfileStore({ ...store, selectedId: id });
};

export const updateLocalProfile = (store, id, patch) => {
  if (!store.profiles.some((profile) => profile.id === id)) throw new Error('Perfil não encontrado.');
  return saveProfileStore({
    ...store,
    profiles: store.profiles.map((profile) => profile.id === id
      ? { ...profile, ...patch, id: profile.id, updatedAt: new Date().toISOString() }
      : profile),
  });
};

export const exportLocalBackup = (store) => JSON.stringify({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  data: normalizeStore(store),
}, null, 2);

export const importLocalBackup = (jsonText, currentStore, { replace = true } = {}) => {
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch { throw new Error('O arquivo não contém um JSON válido.'); }
  if (parsed?.format !== BACKUP_FORMAT || parsed?.version !== BACKUP_VERSION || !Array.isArray(parsed?.data?.profiles)) {
    throw new Error('Este arquivo não é um backup compatível do Dual N-Back.');
  }
  const imported = normalizeStore(parsed.data);
  const merged = replace ? imported : normalizeStore({
    profiles: [...currentStore.profiles, ...imported.profiles.map((p) => ({ ...p, id: makeId() }))],
    selectedId: currentStore.selectedId,
  });
  return saveProfileStore(merged);
};

export { STORAGE_KEY as LOCAL_PROFILE_STORAGE_KEY };
