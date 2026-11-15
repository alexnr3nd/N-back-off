import React, { useRef, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { loadProfileStore, exportLocalBackup, importLocalBackup } from '../services/localProfileStore';

const LocalProfilesPage = () => {
  const {
    profiles = [], activeProfileId, selectProfile, addProfile, removeProfile, renameProfile,
  } = useUser();
  const [newName, setNewName] = useState('');
  const [renameValues, setRenameValues] = useState({});
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  const create = async (event) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const result = await addProfile({ username: newName.trim() });
    if (result) {
      setNewName('');
      setMessage('Perfil criado e selecionado.');
    }
  };

  const exportBackup = () => {
    const json = exportLocalBackup(loadProfileStore());
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dual-n-back-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage('Backup JSON exportado.');
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importLocalBackup(text, loadProfileStore(), { replace: true });
      setMessage('Backup restaurado. Recarregando o aplicativo…');
      window.location.reload();
    } catch (error) {
      setMessage(error.message || 'Não foi possível restaurar o backup.');
    } finally {
      event.target.value = '';
    }
  };

  const remove = async (profile) => {
    if (profiles.length <= 1) {
      setMessage('É necessário manter pelo menos um perfil.');
      return;
    }
    if (!window.confirm(`Excluir o perfil "${profile.username || profile.name}" e todos os dados dele?`)) return;
    const ok = await removeProfile(profile.id);
    setMessage(ok ? 'Perfil excluído.' : 'Não foi possível excluir o perfil.');
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-theme-accent mb-2">Dados locais</p>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Perfis</h1>
          <p className="text-sm text-theme-text-secondary">Cada perfil mantém seu próprio progresso, histórico de sessões e configurações neste aparelho. Nenhuma conta é necessária.</p>
        </div>

        <section className="bg-theme-bg-secondary border border-theme-line rounded-xl p-4 md:p-6 mb-6">
          <h2 className="font-semibold mb-4">Seus perfis</h2>
          <div className="space-y-3">
            {profiles.map((profile) => {
              const selected = profile.id === activeProfileId;
              const name = profile.username || profile.name || 'Perfil';
              return (
                <div key={profile.id} className="border border-theme-line rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-theme-text-muted">{(profile.sessions || []).length} sessões salvas</div>
                  </div>
                  {selected ? (
                    <span className="text-xs font-mono text-theme-accent">EM USO</span>
                  ) : (
                    <button onClick={() => selectProfile(profile.id)} className="px-3 py-2 rounded-lg bg-theme-accent text-theme-bg text-sm font-semibold">Usar perfil</button>
                  )}
                  <input
                    aria-label={`Novo nome de ${name}`}
                    className="w-full sm:w-36 px-3 py-2 rounded-lg bg-theme-bg border border-theme-line text-sm"
                    value={renameValues[profile.id] ?? name}
                    onChange={(e) => setRenameValues((prev) => ({ ...prev, [profile.id]: e.target.value }))}
                  />
                  <button
                    onClick={async () => {
                      const ok = await renameProfile(profile.id, renameValues[profile.id] ?? name);
                      setMessage(ok ? 'Nome do perfil atualizado.' : 'Não foi possível renomear o perfil.');
                    }}
                    className="px-3 py-2 rounded-lg border border-theme-line text-sm"
                  >Renomear</button>
                  <button onClick={() => remove(profile)} className="px-3 py-2 rounded-lg border border-red-500/40 text-red-500 text-sm">Excluir</button>
                </div>
              );
            })}
          </div>
          <form onSubmit={create} className="mt-5 flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 px-3 py-3 rounded-lg bg-theme-bg border border-theme-line text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do novo perfil"
              maxLength={40}
            />
            <button type="submit" disabled={!newName.trim() || profiles.length >= 6} className="px-4 py-3 rounded-lg bg-theme-accent text-theme-bg font-semibold text-sm disabled:opacity-40">Criar perfil</button>
          </form>
          <p className="text-xs text-theme-text-muted mt-2">Até 6 perfis neste aparelho.</p>
        </section>

        <section className="bg-theme-bg-secondary border border-theme-line rounded-xl p-4 md:p-6">
          <h2 className="font-semibold mb-2">Backup e restauração</h2>
          <p className="text-sm text-theme-text-secondary mb-4">O backup inclui todos os perfis, progresso, sessões e configurações. Guarde o arquivo JSON em um local seguro.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={exportBackup} className="px-4 py-3 rounded-lg bg-theme-accent text-theme-bg font-semibold text-sm">Exportar backup JSON</button>
            <button onClick={() => fileRef.current?.click()} className="px-4 py-3 rounded-lg border border-theme-line text-sm">Importar backup JSON</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importBackup} />
          </div>
        </section>
        {message && <p role="status" className="mt-4 text-sm text-theme-text-secondary">{message}</p>}
      </div>
    </div>
  );
};

export default LocalProfilesPage;
