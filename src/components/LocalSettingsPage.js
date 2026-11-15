import React from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

const Toggle = ({ label, description, checked, onChange }) => (
  <label className="flex items-center justify-between gap-4 py-3 border-b border-theme-line last:border-0 cursor-pointer">
    <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-theme-text-muted mt-1">{description}</span></span>
    <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} className="h-5 w-5 accent-current" />
  </label>
);

const LocalSettingsPage = () => {
  const { settings, updateSetting } = useSettings();
  return (
    <div className="min-h-screen bg-theme-bg text-theme-text p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-mono uppercase tracking-widest text-theme-accent mb-2">Preferências locais</p>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Configurações</h1>
        <p className="text-sm text-theme-text-secondary mb-8">As alterações ficam salvas neste aparelho e separadas por perfil.</p>

        <section className="bg-theme-bg-secondary border border-theme-line rounded-xl p-4 md:p-6 mb-6">
          <h2 className="font-semibold mb-4">Aparência</h2>
          <label className="block text-sm mb-2">Tema</label>
          <select value={settings.theme || 'dark'} onChange={e => updateSetting('theme',e.target.value)} className="w-full p-3 rounded-lg bg-theme-bg border border-theme-line mb-4">
            <option value="dark">Escuro</option><option value="light">Claro</option><option value="system">Seguir o sistema</option>
          </select>
          <label className="block text-sm mb-2">Tamanho do texto</label>
          <select value={settings.textScale || 'default'} onChange={e => updateSetting('textScale',e.target.value)} className="w-full p-3 rounded-lg bg-theme-bg border border-theme-line">
            <option value="default">Padrão</option><option value="large">Grande</option><option value="larger">Muito grande</option>
          </select>
        </section>

        <section className="bg-theme-bg-secondary border border-theme-line rounded-xl p-4 md:p-6 mb-6">
          <h2 className="font-semibold mb-2">Treinamento</h2>
          <Toggle label="Ajuste automático no modo Clássico" description="Permite ajustar o nível conforme o desempenho." checked={settings.classicAutoLevel !== false} onChange={v=>updateSetting('classicAutoLevel',v)} />
          <Toggle label="Ajuste automático no modo Adaptativo" description="Mantém a progressão automática do treino adaptativo." checked={settings.adaptiveAutoLevel !== false} onChange={v=>updateSetting('adaptiveAutoLevel',v)} />
          <Toggle label="Feedback positivo" description="Mostra indicação visual quando a resposta está correta." checked={settings.instantFeedbackPositive !== false} onChange={v=>updateSetting('instantFeedbackPositive',v)} />
          <Toggle label="Feedback de erros" description="Mostra indicação visual para respostas incorretas." checked={settings.instantFeedbackErrors !== false} onChange={v=>updateSetting('instantFeedbackErrors',v)} />
          <Toggle label="Feedback de omissões" description="Indica quando um alvo não foi respondido." checked={settings.instantFeedbackMisses !== false} onChange={v=>updateSetting('instantFeedbackMisses',v)} />
          <Toggle label="Ocultar cursor automaticamente" description="Oculta o cursor durante o treino quando disponível." checked={!!settings.autoHideCursor} onChange={v=>updateSetting('autoHideCursor',v)} />
          <label className="block text-sm mt-5 mb-2">Velocidade de ajuste de dificuldade</label>
          <select value={settings.difficultyAdjustmentRange || 'standard'} onChange={e=>updateSetting('difficultyAdjustmentRange',e.target.value)} className="w-full p-3 rounded-lg bg-theme-bg border border-theme-line">
            <option value="standard">Padrão</option><option value="accelerated">Acelerada</option><option value="aggressive">Agressiva</option>
          </select>
        </section>

        <section className="bg-theme-bg-secondary border border-theme-line rounded-xl p-4 md:p-6">
          <h2 className="font-semibold mb-2">Dados e perfis</h2>
          <p className="text-sm text-theme-text-secondary mb-4">Crie perfis separados e faça backup de todo o progresso em JSON.</p>
          <Link to="/profiles" className="inline-flex px-4 py-3 rounded-lg bg-theme-accent text-theme-bg font-semibold text-sm">Gerenciar perfis e backups</Link>
        </section>
      </div>
    </div>
  );
};
export default LocalSettingsPage;
