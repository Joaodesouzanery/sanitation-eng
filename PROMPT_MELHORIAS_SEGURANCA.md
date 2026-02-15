# Prompt de Melhorias de Segurança para Lovable

> **Contexto:** O sistema ConstruData/HydroNetwork possui uma auditoria de segurança com nota 9/10. Este prompt contém melhorias adicionais para elevar a segurança ao nível enterprise.

---

## PROMPT PARA LOVABLE

```
Preciso implementar melhorias adicionais de segurança no ConstruData. A auditoria atual mostrou nota 9/10. Implemente as seguintes melhorias:

## 1. Autenticação Multi-Fator (MFA) para Admins

Criar sistema de 2FA obrigatório para usuários com role 'admin' ou 'super_admin':

- Tabela `user_mfa_settings` com campos:
  - user_id (FK para auth.users)
  - mfa_enabled (boolean)
  - mfa_secret (encrypted)
  - backup_codes (text[], hashed)
  - last_verified_at (timestamp)
  - created_at, updated_at

- Edge Function `verify-mfa-code` que:
  - Valida código TOTP
  - Registra tentativas falhas
  - Bloqueia após 5 tentativas

- Policy: Admins sem MFA configurado devem ser forçados a configurar no próximo login

## 2. Audit Trail Completo no Banco

Criar sistema de auditoria para rastrear todas as ações sensíveis:

- Tabela `audit_logs` com campos:
  - id (uuid)
  - user_id (uuid, nullable para ações do sistema)
  - action (enum: CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT)
  - table_name (text)
  - record_id (uuid, nullable)
  - old_values (jsonb, nullable)
  - new_values (jsonb, nullable)
  - ip_address (inet)
  - user_agent (text)
  - session_id (text)
  - created_at (timestamp with time zone)

- Trigger function `fn_audit_trigger()` que:
  - Captura INSERT, UPDATE, DELETE em tabelas críticas
  - Registra automaticamente na audit_logs
  - Usa SECURITY DEFINER para evitar RLS

- Aplicar trigger nas tabelas:
  - user_profiles
  - user_roles
  - employees
  - budgets
  - contracts
  - financial_transactions
  - funcionarios
  - salarios

- RLS na audit_logs:
  - Somente super_admin pode SELECT
  - Ninguém pode UPDATE ou DELETE (append-only)

## 3. Detecção de Anomalias e Alertas

Criar sistema de detecção de comportamento suspeito:

- Tabela `security_alerts` com campos:
  - id, alert_type, severity (low/medium/high/critical)
  - user_id, description, metadata (jsonb)
  - acknowledged_by, acknowledged_at
  - created_at

- Tabela `user_login_history` com campos:
  - user_id, ip_address, user_agent
  - login_at, logout_at
  - login_method (password, oauth, mfa)
  - success (boolean)
  - failure_reason (text, nullable)

- Edge Function `detect-anomalies` (cron job a cada 5 min) que detecta:
  - Login de IP diferente do usual
  - Múltiplas falhas de login (>5 em 10 min)
  - Acesso fora do horário comercial
  - Download em massa de dados
  - Alteração de permissões

- Notificação via webhook ou email para admins em alertas critical

## 4. Encriptação de Dados Sensíveis

Usar pgcrypto para campos sensíveis:

- Habilitar extensão pgcrypto
- Criar função `encrypt_sensitive(text)` que:
  - Usa chave de criptografia do vault
  - Retorna bytea criptografado

- Criar função `decrypt_sensitive(bytea)` que:
  - Descriptografa usando a chave
  - Usa SECURITY DEFINER

- Aplicar em campos:
  - salarios.valor_bruto -> salarios.valor_bruto_encrypted
  - employees.cpf -> employees.cpf_encrypted
  - employees.rg -> employees.rg_encrypted
  - contacts.phone -> contacts.phone_encrypted (se sensível)

- Criar views com decriptação para uso na aplicação

## 5. Session Management Melhorado

Implementar controle robusto de sessões:

- Tabela `user_sessions` com campos:
  - id (uuid)
  - user_id (FK)
  - session_token (text, hashed)
  - ip_address (inet)
  - user_agent (text)
  - device_fingerprint (text)
  - expires_at (timestamp)
  - revoked_at (timestamp, nullable)
  - revoked_reason (text, nullable)
  - created_at

- RLS policies:
  - Usuário só vê suas próprias sessões
  - Pode revogar (soft delete) suas sessões
  - Admin pode ver e revogar sessões de outros

- Edge Function `revoke-all-sessions`:
  - Invalida todas as sessões do usuário
  - Útil para "logout de todos os dispositivos"

- Edge Function `cleanup-expired-sessions` (cron diário):
  - Remove sessões expiradas há mais de 30 dias

## 6. Rate Limiting por Usuário (não só IP)

Melhorar o rate limiting existente:

- Tabela `user_rate_limits` com campos:
  - user_id
  - endpoint (text)
  - request_count (int)
  - window_start (timestamp)
  - blocked_until (timestamp, nullable)

- Limites diferenciados por role:
  - guest: 30 req/min
  - viewer: 60 req/min
  - engineer: 120 req/min
  - admin: 300 req/min

- Edge Function middleware que:
  - Verifica limite por usuário autenticado
  - Fallback para IP se não autenticado
  - Retorna header X-RateLimit-Remaining

## 7. Validação de Entrada Adicional

Criar functions de validação reutilizáveis:

- `fn_validate_cpf(text)` - Valida CPF brasileiro
- `fn_validate_cnpj(text)` - Valida CNPJ
- `fn_validate_email(text)` - Regex robusto para email
- `fn_validate_phone_br(text)` - Formato telefone brasileiro
- `fn_sanitize_html(text)` - Remove tags HTML perigosas

Aplicar via CHECK constraints ou triggers:
- employees.cpf deve passar em fn_validate_cpf
- accounts.email deve passar em fn_validate_email

## 8. Backup Security

Criar política de backup seguro:

- Tabela `backup_logs` para rastrear backups
- Function `fn_mask_sensitive_for_export()`:
  - Mascara CPF: ***.***.***-XX
  - Mascara salários: R$ ****,**
  - Mascara telefones: (**) *****-XXXX

- Usar essa function em todas as exportações

## 9. Política de Senha Mais Forte

Integrar com as configurações do backend Python:

- Criar function `fn_validate_password_strength(text)`:
  - Mínimo 12 caracteres
  - Pelo menos 1 maiúscula
  - Pelo menos 1 minúscula
  - Pelo menos 1 número
  - Pelo menos 1 caractere especial
  - Não pode ser senha comum (lista de senhas fracas)

- Tabela `password_history` (para evitar reutilização):
  - user_id, password_hash, created_at
  - Manter últimas 5 senhas

- Bloquear reutilização das últimas 5 senhas

## 10. Cleanup de Dados Sensíveis em Logs

Garantir que logs não exponham dados sensíveis:

- Revisar todas as Edge Functions para:
  - Não logar payloads com senhas
  - Não logar tokens completos
  - Mascarar IPs parcialmente em logs públicos

- Criar function `fn_sanitize_log_payload(jsonb)` que remove:
  - password, senha
  - token, access_token, refresh_token
  - cpf, cnpj, rg
  - credit_card, cartao

---

## Priorização Sugerida

| Prioridade | Item | Justificativa |
|------------|------|---------------|
| CRÍTICA | 2. Audit Trail | Compliance e forensics |
| CRÍTICA | 4. Encriptação | Proteção de PII |
| ALTA | 1. MFA para Admins | Prevenção de account takeover |
| ALTA | 3. Detecção Anomalias | Resposta a incidentes |
| ALTA | 5. Session Management | Controle de acesso |
| MÉDIA | 6. Rate Limit por User | DoS prevention |
| MÉDIA | 7. Validação de Entrada | Data integrity |
| MÉDIA | 9. Política de Senha | Account security |
| BAIXA | 8. Backup Security | Compliance |
| BAIXA | 10. Cleanup Logs | Privacy |

---

## Checklist de Implementação

- [ ] MFA para admins implementado
- [ ] Audit trail em todas as tabelas críticas
- [ ] Sistema de alertas funcionando
- [ ] Campos sensíveis criptografados
- [ ] Session management robusto
- [ ] Rate limiting por usuário
- [ ] Validações de CPF/CNPJ/email funcionando
- [ ] Backup com mascaramento
- [ ] Política de senha forte
- [ ] Logs sanitizados

Após implementar, a nota de segurança deve subir para 10/10.
```

---

## Observações Técnicas

### Sobre o INSERT Anônimo em maintenance_requests

O design atual permite INSERT anônimo para formulários públicos via QR Code. Isso é aceitável desde que:

1. **Rate limiting** esteja funcionando (5 req/IP/hora - OK)
2. **Validação de entrada** seja rigorosa no Edge Function
3. **CAPTCHA** seja considerado para prevenir spam automatizado
4. **Honeypot fields** sejam adicionados como proteção extra

Sugestão de melhoria para este endpoint:

```sql
-- Adicionar campo honeypot na tabela
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS
  hp_field text; -- Honeypot: se preenchido, rejeitar

-- Na Edge Function, rejeitar se hp_field estiver preenchido
-- Bots preenchem todos os campos automaticamente
```

### Sobre WITH CHECK (true) em maintenance_request_rate_limits

Isso é seguro porque:
- A tabela é usada apenas para tracking de rate limiting
- O INSERT é controlado pela Edge Function
- Não há dados sensíveis

Porém, considere adicionar:
```sql
-- Limitar campos que podem ser inseridos
CREATE POLICY "rate_limit_insert" ON maintenance_request_rate_limits
FOR INSERT TO authenticated
WITH CHECK (
  ip_address IS NOT NULL AND
  created_at >= NOW() - INTERVAL '1 hour'
);
```

---

## Comparação com Backend Python

O projeto já possui um módulo de segurança Python robusto em `/src/security/`:

| Feature | Python Backend | Supabase |
|---------|----------------|----------|
| Rate Limiting | 60 req/min, 1000/hora | 5 req/IP/hora (maint.) |
| Password Hash | bcrypt 12 rounds | Supabase Auth default |
| JWT | 30min access, 7d refresh | Supabase Auth default |
| Security Headers | HSTS, CSP, X-Frame | N/A (frontend) |
| Input Validation | XSS, SQLi, Path Traversal | Parcial |
| Audit Logging | Arquivo /var/log | Não implementado |
| Session Management | 1h timeout | Supabase Auth |

**Recomendação:** Sincronizar as políticas entre Python e Supabase para consistência.
