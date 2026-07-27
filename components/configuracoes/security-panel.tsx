import { useState } from "react";
import {
  CheckIcon,
  DatabaseIcon,
  KeyIcon,
  LockIcon,
  ShieldIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import type { PasswordChangeInput, SecuritySettings } from "@/types/configuracoes";
import type { DatabaseEncryptionStatus } from "@/types/desktop-database";

export function SecurityPanel({
  value,
  vaultReady,
  databaseSecurity,
  busy,
  onChange,
  onChangePassword,
  onEnablePin,
  onDisablePin,
  onLockNow,
  onRotateDatabaseKey,
  onFeedback,
}: {
  value: SecuritySettings;
  vaultReady: boolean;
  databaseSecurity: DatabaseEncryptionStatus | null;
  busy: boolean;
  onChange: (value: SecuritySettings) => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onEnablePin: (password: string, pin: string) => Promise<void>;
  onDisablePin: (password: string) => Promise<void>;
  onLockNow: () => Promise<void>;
  onRotateDatabaseKey: () => Promise<void>;
  onFeedback: (message: string) => void;
}) {
  const [password, setPassword] = useState<PasswordChangeInput>({ currentPassword: "", newPassword: "", confirmation: "" });
  const [pinForm, setPinForm] = useState({ password: "", pin: "", confirmation: "" });
  const [passwordError, setPasswordError] = useState("");
  const [pinError, setPinError] = useState("");

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = password.currentPassword.length >= 1
      && password.newPassword.length >= 8
      && /[A-Za-zÀ-ÿ]/.test(password.newPassword)
      && /\d/.test(password.newPassword)
      && password.newPassword === password.confirmation;
    if (!valid) {
      setPasswordError("Use ao menos 8 caracteres com letra e número, e repita a mesma senha.");
      return;
    }
    try {
      await onChangePassword(password.currentPassword, password.newPassword);
      setPassword({ currentPassword: "", newPassword: "", confirmation: "" });
      setPasswordError("");
      onFeedback("Senha local alterada e protegida com Argon2id.");
    } catch (caught) {
      setPasswordError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function configurePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(pinForm.pin) || pinForm.pin !== pinForm.confirmation || !pinForm.password) {
      setPinError("Informe a senha atual e repita um PIN de 4 a 8 números.");
      return;
    }
    try {
      await onEnablePin(pinForm.password, pinForm.pin);
      setPinForm({ password: "", pin: "", confirmation: "" });
      setPinError("");
      onFeedback("PIN local ativado. Ele será solicitado ao desbloquear o FinnacialUX.");
    } catch (caught) {
      setPinError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function removePin() {
    if (!pinForm.password) {
      setPinError("Informe sua senha atual para remover o PIN.");
      return;
    }
    try {
      await onDisablePin(pinForm.password);
      setPinForm({ password: "", pin: "", confirmation: "" });
      setPinError("");
      onFeedback("PIN local removido.");
    } catch (caught) {
      setPinError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <div className="security-settings-layout phase-three-security-layout">
      <section className="settings-panel security-overview-panel">
        <header className="settings-panel-header">
          <div>
            <span className="section-eyebrow">Proteção local</span>
            <h2>Segurança do FinnacialUX Desktop</h2>
            <p>Controle o bloqueio da janela, a confirmação de ações sensíveis e o cofre local usado para proteger chaves.</p>
          </div>
          <span className="settings-panel-icon"><ShieldIcon /></span>
        </header>

        <div className="security-health-grid">
          <article className={vaultReady ? "healthy" : "attention"}>
            <span>{vaultReady ? <CheckIcon /> : <WarningIcon />}</span>
            <div><strong>Cofre Stronghold</strong><small>{vaultReady ? "Inicializado e com chave local disponível" : "O cofre ainda não pôde ser inicializado"}</small></div>
          </article>
          <article className={value.pinEnabled ? "healthy" : "neutral"}>
            <span><KeyIcon /></span>
            <div><strong>PIN local</strong><small>{value.pinEnabled ? "Ativo para desbloqueio rápido" : "Opcional e ainda não configurado"}</small></div>
          </article>
          <article className={value.encryptedBackupsDefault ? "healthy" : "attention"}>
            <span><DatabaseIcon /></span>
            <div><strong>Backups criptografados</strong><small>{value.encryptedBackupsDefault ? "Proteção por dispositivo como padrão" : "Proteção padrão desativada"}</small></div>
          </article>
          <article className={databaseSecurity?.encrypted ? "healthy" : "attention"}>
            <span>{databaseSecurity?.encrypted ? <CheckIcon /> : <WarningIcon />}</span>
            <div><strong>Banco SQLCipher</strong><small>{databaseSecurity?.encrypted ? `Criptografia integral ativa · schema ${databaseSecurity.schemaVersion}` : "Status de criptografia indisponível"}</small></div>
          </article>
        </div>

        <div className="settings-panel-body security-controls-body">
          <div className="security-toggle-list">
            <SecurityToggle
              icon={<LockIcon />}
              title="Bloquear ao minimizar"
              helper="Protege a dashboard quando a janela é minimizada no Windows."
              checked={value.lockOnMinimize}
              onChange={(checked) => onChange({ ...value, lockOnMinimize: checked })}
            />
            <SecurityToggle
              icon={<ShieldIcon />}
              title="Confirmar senha antes de exportar"
              helper="Evita que relatórios, diagnósticos e backups sejam exportados sem autorização."
              checked={value.requirePasswordForExports}
              onChange={(checked) => onChange({ ...value, requirePasswordForExports: checked })}
            />
            <SecurityToggle
              icon={<ShieldIcon />}
              title="Confirmar senha antes de restaurar"
              helper="Exige a senha da conta antes de substituir o banco local."
              checked={value.requirePasswordForRestore}
              onChange={(checked) => onChange({ ...value, requirePasswordForRestore: checked })}
            />
            <SecurityToggle
              icon={<DatabaseIcon />}
              title="Criptografar backups por padrão"
              helper="Usa uma chave exclusiva deste computador armazenada no Stronghold."
              checked={value.encryptedBackupsDefault}
              onChange={(checked) => onChange({ ...value, encryptedBackupsDefault: checked })}
            />
          </div>

          <div className="security-timeout-actions">
            <label className="form-field settings-field security-timeout-field">
              <span>Bloqueio automático por inatividade</span>
              <select value={value.autoLockMinutes} onChange={(event) => onChange({ ...value, autoLockMinutes: Number(event.target.value) as SecuritySettings["autoLockMinutes"] })}>
                <option value={0}>Desativado</option>
                <option value={5}>5 minutos</option>
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={120}>2 horas</option>
              </select>
            </label>
            <button className="secondary-action-button" type="button" disabled={busy} onClick={() => void onLockNow()}><LockIcon /> Bloquear agora</button>
          </div>
        </div>
      </section>

      <section className="settings-panel database-encryption-panel">
        <header className="settings-panel-header compact">
          <div>
            <span className="section-eyebrow">Criptografia integral</span>
            <h2>Banco local protegido por SQLCipher</h2>
            <p>O arquivo principal é cifrado por uma chave de 256 bits mantida no Stronghold. A rotação substitui a chave sem recriar seus dados.</p>
          </div>
          <span className="settings-panel-icon"><DatabaseIcon /></span>
        </header>
        {databaseSecurity ? (
          <div className="database-encryption-content">
            <div className={`database-encryption-status ${databaseSecurity.encrypted ? "healthy" : "attention"}`}>
              <span>{databaseSecurity.encrypted ? <CheckIcon /> : <WarningIcon />}</span>
              <div>
                <strong>{databaseSecurity.encrypted ? "Criptografia integral ativa" : "Criptografia não confirmada"}</strong>
                <small>{databaseSecurity.cipherVersion || "SQLCipher não identificado"}</small>
              </div>
            </div>
            <dl className="database-encryption-details">
              <div><dt>Identificador da chave</dt><dd>{databaseSecurity.keyFingerprint || "—"}</dd></div>
              <div><dt>Tamanho protegido</dt><dd>{formatFileSize(databaseSecurity.databaseSizeBytes)}</dd></div>
              <div><dt>Ativada em</dt><dd>{databaseSecurity.encryptedAt ? formatSettingsDateTime(databaseSecurity.encryptedAt) : "Nesta instalação"}</dd></div>
              <div><dt>Última rotação</dt><dd>{databaseSecurity.lastKeyRotationAt ? formatSettingsDateTime(databaseSecurity.lastKeyRotationAt) : "Nunca"}</dd></div>
            </dl>
            {databaseSecurity.migratedFromPlaintext ? (
              <p className="database-encryption-migration-note"><ShieldIcon /> O banco anterior foi convertido automaticamente e uma cópia de recuperação protegida foi criada antes da migração.</p>
            ) : null}
            <div className="database-encryption-actions">
              <button className="secondary-action-button" type="button" disabled={busy || !databaseSecurity.encrypted} onClick={() => void onRotateDatabaseKey()}>
                <KeyIcon /> Rotacionar chave do banco
              </button>
              <small>Esta ação exige sua senha e cria uma cópia técnica de segurança antes da troca.</small>
            </div>
          </div>
        ) : (
          <div className="database-encryption-loading"><WarningIcon /><span>Não foi possível consultar o estado do banco criptografado.</span></div>
        )}
      </section>

      <section className="settings-panel pin-panel">
        <header className="settings-panel-header compact">
          <div><span className="section-eyebrow">Desbloqueio</span><h2>{value.pinEnabled ? "Alterar ou remover PIN" : "Criar PIN local"}</h2><p>O PIN é armazenado como hash Argon2id e nunca é salvo em texto puro.</p></div>
          <span className="settings-panel-icon"><KeyIcon /></span>
        </header>
        <form className="pin-settings-form" onSubmit={configurePin}>
          <label className="form-field settings-field full"><span>Senha atual</span><input type="password" autoComplete="current-password" value={pinForm.password} onChange={(event) => setPinForm({ ...pinForm, password: event.target.value })} /></label>
          <label className="form-field settings-field"><span>{value.pinEnabled ? "Novo PIN" : "PIN"}</span><input inputMode="numeric" type="password" maxLength={8} value={pinForm.pin} onChange={(event) => setPinForm({ ...pinForm, pin: event.target.value.replace(/\D/g, "") })} /></label>
          <label className="form-field settings-field"><span>Confirmar PIN</span><input inputMode="numeric" type="password" maxLength={8} value={pinForm.confirmation} onChange={(event) => setPinForm({ ...pinForm, confirmation: event.target.value.replace(/\D/g, "") })} /></label>
          {pinError ? <p className="password-rule error">{pinError}</p> : <p className="password-rule">Use de 4 a 8 números. Após tentativas repetidas, o PIN será temporariamente bloqueado.</p>}
          <div className="pin-form-actions">
            <button className="secondary-action-button" type="submit" disabled={busy}><KeyIcon /> {value.pinEnabled ? "Atualizar PIN" : "Ativar PIN"}</button>
            {value.pinEnabled ? <button className="text-action-button danger" type="button" disabled={busy} onClick={() => void removePin()}>Remover PIN</button> : null}
          </div>
        </form>
      </section>

      <section className="settings-panel password-panel">
        <header className="settings-panel-header compact">
          <div><span className="section-eyebrow">Credencial principal</span><h2>Alterar senha local</h2><p>Contas antigas são migradas automaticamente de PBKDF2 para Argon2id no próximo login válido.</p></div>
          <span className="settings-panel-icon"><LockIcon /></span>
        </header>
        <form className="password-settings-form" onSubmit={changePassword}>
          <label className="form-field settings-field full"><span>Senha atual</span><input type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} /></label>
          <label className="form-field settings-field"><span>Nova senha</span><input type="password" autoComplete="new-password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /></label>
          <label className="form-field settings-field"><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" value={password.confirmation} onChange={(event) => setPassword({ ...password, confirmation: event.target.value })} /></label>
          <p className={`password-rule ${passwordError ? "error" : ""}`}>{passwordError || "Use ao menos 8 caracteres com letra e número."}</p>
          <button className="secondary-action-button" type="submit" disabled={busy}><KeyIcon /> Alterar senha</button>
        </form>
      </section>
    </div>
  );
}

function SecurityToggle({ icon, title, helper, checked, onChange }: { icon: React.ReactNode; title: string; helper: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <article className="security-toggle-row">
      <span className="security-toggle-icon">{icon}</span>
      <span><strong>{title}</strong><small>{helper}</small></span>
      <label className="standalone-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>
    </article>
  );
}
