/**
 * 📂 ARQUIVO: 5_UTILS/central_ferramentas_16_1_14.gs
 * 🧰 MÓDULO: CENTRAL DE FERRAMENTAS SEGURA — CANIVETE SUÍÇO
 * 🔢 VERSÃO: 16.1.15.1
 *
 * PATCH 16.1.15.1:
 * - Mantém a Central enxuta, sem duplicar o menu principal.
 * - Mantém lista controlada/whitelist.
 * - Acrescenta confirmação visual customizada para ações AMARELAS.
 * - Não usa window.confirm(), window.alert() nem alert nativo feio.
 * - Não mexe em DB_TRANSACOES, DB_TRANSACOES_HIST, Gemini, importação, DRE ou Dashboard.
 */

const GFP_CENTRAL_FERRAMENTAS_PATCH_16_1_14 = "16.1.15.1";


/**
 * Abre a Central visual.
 */
function GFP_CENTRAL_FERRAMENTAS_OPEN_16_1_14() {
  const tools = GFP_CENTRAL_FERRAMENTAS_REGISTRY_16_1_14_()
    .sort(function(a, b) {
      return String(a.title || "").localeCompare(String(b.title || ""), "pt-BR");
    });

  const toolsJson = JSON.stringify(tools)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  const htmlParts = [];

  htmlParts.push('<!DOCTYPE html>');
  htmlParts.push('<html>');
  htmlParts.push('<head>');
  htmlParts.push('<base target="_top">');
  htmlParts.push('<style>');
  htmlParts.push(`
    :root {
      --navy: #0b2d4d;
      --navy2: #123d63;
      --bg: #f8fafc;
      --line: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --green-bg: #dcfce7;
      --green: #166534;
      --yellow-bg: #fef9c3;
      --yellow: #92400e;
      --blue-bg: #e0f2fe;
      --blue: #075985;
      --red-bg: #fee2e2;
      --red: #991b1b;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    .top {
      background: var(--navy);
      color: #fff;
      padding: 18px 22px;
    }

    .top h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
    }

    .top p {
      margin: 6px 0 0;
      font-size: 12px;
      opacity: .9;
    }

    .wrap {
      padding: 18px 22px 22px;
    }

    .bar {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
      align-items: center;
      margin-bottom: 14px;
    }

    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 11px 12px;
      font-size: 13px;
      outline: none;
      background: #fff;
    }

    select {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      background: #fff;
    }

    .backupOpt {
      display: flex;
      gap: 7px;
      align-items: center;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 9px 11px;
      font-size: 12px;
      color: #334155;
      white-space: nowrap;
    }

    .legend {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }

    .pill.green { background: var(--green-bg); color: var(--green); }
    .pill.yellow { background: var(--yellow-bg); color: var(--yellow); }
    .pill.blue { background: var(--blue-bg); color: var(--blue); }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .card {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
    }

    .cardHead {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 13px 14px 9px;
      border-bottom: 1px solid #eef2f7;
    }

    .title {
      font-weight: 800;
      font-size: 14px;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .fn {
      font-family: Consolas, monospace;
      font-size: 10px;
      color: #64748b;
      word-break: break-all;
    }

    .risk {
      white-space: nowrap;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 8px;
      border-radius: 999px;
    }

    .risk.GREEN { background: var(--green-bg); color: var(--green); }
    .risk.YELLOW { background: var(--yellow-bg); color: var(--yellow); }

    .cardBody {
      padding: 10px 14px 13px;
    }

    .desc {
      font-size: 12px;
      color: #334155;
      line-height: 1.45;
      min-height: 42px;
    }

    .meta {
      margin-top: 10px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tag {
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      padding: 4px 7px;
      border-radius: 999px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }

    button {
      border: 0;
      border-radius: 9px;
      padding: 9px 13px;
      font-weight: 800;
      cursor: pointer;
      font-size: 12px;
    }

    .btnRun {
      background: var(--navy);
      color: #fff;
    }

    .btnRun:hover {
      background: var(--navy2);
    }

    .btnSecondary {
      background: #e0f2fe;
      color: #0b2d4d;
    }

    .btnYellow {
      background: #f59e0b;
      color: #111827;
    }

    .btnDanger {
      background: #fee2e2;
      color: #991b1b;
    }

    .footer {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 12px;
      background: #fff;
      border: 1px solid #e2e8f0;
      font-size: 12px;
      color: #475569;
      line-height: 1.45;
    }

    #result {
      display: none;
      margin-bottom: 14px;
      padding: 12px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.4;
    }

    #result.ok {
      display: block;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    #result.warn {
      display: block;
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    pre {
      white-space: pre-wrap;
      font-size: 11px;
      margin: 8px 0 0;
      max-height: 190px;
      overflow: auto;
      background: rgba(255,255,255,.65);
      padding: 8px;
      border-radius: 8px;
    }

    .modalOverlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, .46);
      z-index: 9999;
      align-items: center;
      justify-content: center;
      padding: 22px;
    }

    .modalOverlay.show {
      display: flex;
    }

    .confirmBox {
      width: min(680px, 96vw);
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(15, 23, 42, .34);
      border: 1px solid rgba(226, 232, 240, .9);
    }

    .confirmTop {
      background: var(--navy);
      color: #fff;
      padding: 16px 18px;
    }

    .confirmTop h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
    }

    .confirmTop p {
      margin: 6px 0 0;
      font-size: 12px;
      opacity: .9;
    }

    .confirmBody {
      padding: 16px 18px;
    }

    .confirmTitle {
      font-size: 15px;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .confirmDesc {
      font-size: 13px;
      color: #334155;
      line-height: 1.45;
      margin-bottom: 12px;
    }

    .confirmWarn {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.45;
      margin-bottom: 12px;
    }

    .confirmFn {
      font-family: Consolas, monospace;
      font-size: 11px;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 9px 10px;
      word-break: break-all;
    }

    .confirmActions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 0 18px 18px;
    }

    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
      .bar { grid-template-columns: 1fr; }
    }
  `);
  htmlParts.push('</style>');
  htmlParts.push('</head>');

  htmlParts.push('<body>');
  htmlParts.push('<div class="top">');
  htmlParts.push('<h1>🧰 GFP — Central de Ferramentas</h1>');
  htmlParts.push('<p>Ferramentas acessórias úteis. Sem duplicar o menu principal e sem comandos sensíveis.</p>');
  htmlParts.push('</div>');

  htmlParts.push('<div class="wrap">');
  htmlParts.push('<div class="bar">');
  htmlParts.push('<input id="search" type="text" placeholder="Buscar por nome, função, área ou descrição..." oninput="renderTools()">');
  htmlParts.push('<select id="riskFilter" onchange="renderTools()">');
  htmlParts.push('<option value="">Todos os níveis</option>');
  htmlParts.push('<option value="GREEN">Verde — diagnóstico</option>');
  htmlParts.push('<option value="YELLOW">Amarelo — altera algo</option>');
  htmlParts.push('</select>');
  htmlParts.push('<label class="backupOpt"><input id="backupBefore" type="checkbox" checked> Backup antes de ações amarelas</label>');
  htmlParts.push('</div>');

  htmlParts.push('<div class="legend">');
  htmlParts.push('<span class="pill green">Verde: diagnóstico / não altera dados</span>');
  htmlParts.push('<span class="pill yellow">Amarelo: altera algo / exige atenção</span>');
  htmlParts.push('<span class="pill blue">Sem duplicar botões do menu principal</span>');
  htmlParts.push('</div>');

  htmlParts.push('<div id="result"></div>');
  htmlParts.push('<div id="tools" class="grid"></div>');

  htmlParts.push('<div class="footer">');
  htmlParts.push('Esta Central é uma lista controlada de ferramentas acessórias. Importar Extratos, Dashboard, Painel, Arquivar Linhas OK, Backup, Histórico, Estornos e Conferir Totais continuam no menu principal.');
  htmlParts.push('</div>');
  htmlParts.push('</div>');

  htmlParts.push('<div id="confirmOverlay" class="modalOverlay">');
  htmlParts.push('<div class="confirmBox">');
  htmlParts.push('<div class="confirmTop">');
  htmlParts.push('<h2>Confirmar execução</h2>');
  htmlParts.push('<p>Ação amarela: altera algo na planilha e deve ser executada com atenção.</p>');
  htmlParts.push('</div>');
  htmlParts.push('<div class="confirmBody">');
  htmlParts.push('<div id="confirmTitle" class="confirmTitle"></div>');
  htmlParts.push('<div id="confirmDesc" class="confirmDesc"></div>');
  htmlParts.push('<div id="confirmWarn" class="confirmWarn"></div>');
  htmlParts.push('<div id="confirmFn" class="confirmFn"></div>');
  htmlParts.push('</div>');
  htmlParts.push('<div class="confirmActions">');
  htmlParts.push('<button class="btnSecondary" onclick="closeConfirm()">Cancelar</button>');
  htmlParts.push('<button id="confirmRunBtn" class="btnYellow" onclick="confirmRun()">Executar ação</button>');
  htmlParts.push('</div>');
  htmlParts.push('</div>');
  htmlParts.push('</div>');

  htmlParts.push('<script>');
  htmlParts.push('const TOOLS = ' + toolsJson + ';');
  htmlParts.push(`
    let pendingToolId = null;

    function riskLabel(risk) {
      if (risk === 'GREEN') return 'VERDE';
      if (risk === 'YELLOW') return 'AMARELO';
      return risk || '';
    }

    function escapeHtml(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function normalize(v) {
      return String(v || '').toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '');
    }

    function renderTools() {
      const box = document.getElementById('tools');
      const q = normalize(document.getElementById('search').value);
      const risk = document.getElementById('riskFilter').value;

      const filtered = TOOLS.filter(function(t) {
        if (risk && t.risk !== risk) return false;

        const hay = normalize([
          t.title,
          t.fn,
          t.group,
          t.description,
          (t.tags || []).join(' ')
        ].join(' '));

        return !q || hay.indexOf(q) >= 0;
      });

      const cards = filtered.map(function(t) {
        const tags = (t.tags || []).map(function(x) {
          return '<span class="tag">' + escapeHtml(x) + '</span>';
        }).join('');

        return [
          '<div class="card">',
            '<div class="cardHead">',
              '<div>',
                '<div class="title">' + escapeHtml(t.title) + '</div>',
                '<div class="fn">' + escapeHtml(t.fn || '') + '</div>',
              '</div>',
              '<span class="risk ' + escapeHtml(t.risk) + '">' + escapeHtml(riskLabel(t.risk)) + '</span>',
            '</div>',
            '<div class="cardBody">',
              '<div class="desc">' + escapeHtml(t.description || '') + '</div>',
              '<div class="meta">',
                '<span class="tag">' + escapeHtml(t.group || 'Geral') + '</span>',
                tags,
              '</div>',
              '<div class="actions">',
                '<button class="btnRun" onclick="runTool(\\'' + escapeHtml(t.id) + '\\')">Executar</button>',
              '</div>',
            '</div>',
          '</div>'
        ].join('');
      }).join('');

      box.innerHTML = cards || '<div class="footer">Nenhuma ferramenta encontrada com esse filtro.</div>';
    }

    function showResult(ok, msg) {
      const el = document.getElementById('result');
      el.className = ok ? 'ok' : 'warn';
      el.innerHTML = msg;
    }

    function humanizeToolResult(tool, res) {
      const ok = !res || res.ok !== false;
      const result = res && res.result && typeof res.result === 'object' ? res.result : res;
      const lines = [];

      lines.push('<strong>' + (ok ? 'Concluído:' : 'Concluído com alerta:') + '</strong> ' + escapeHtml(tool.title));

      if (res && res.backup) {
        lines.push('✅ Backup de segurança executado antes da ação.');
      }

      if (!result || typeof result !== 'object') {
        lines.push('A função foi executada. Não houve retorno estruturado para resumir.');
        return lines.join('<br>');
      }

      const id = tool.id || '';

      if (typeof result.totalInvalid !== 'undefined') {
        lines.push(result.totalInvalid === 0
          ? '✅ Categorias OK: nenhuma categoria inválida encontrada.'
          : '⚠️ Categorias inválidas encontradas: ' + escapeHtml(result.totalInvalid));
      }

      if (typeof result.scanned !== 'undefined' && typeof result.alerts !== 'undefined') {
        const alertsCount = Array.isArray(result.alerts) ? result.alerts.length : Number(result.alerts || 0);
        lines.push(alertsCount === 0
          ? '✅ Metadados/A:S OK: ' + escapeHtml(result.scanned) + ' linha(s) analisada(s), nenhum desalinhamento encontrado.'
          : '⚠️ Metadados/A:S: ' + escapeHtml(alertsCount) + ' possível(is) desalinhamento(s) em ' + escapeHtml(result.scanned) + ' linha(s).');
      }

      if (typeof result.totalCellsChanged !== 'undefined' || typeof result.totalRowsTouched !== 'undefined') {
        const dry = result.dryRun ? 'Simulação concluída.' : 'Migração aplicada.';
        lines.push('✅ ' + dry + ' Células afetadas: ' + escapeHtml(result.totalCellsChanged || 0) + '; linhas tocadas: ' + escapeHtml(result.totalRowsTouched || 0) + '.');
      }

      if (id === 'ordenar_as_defensivo' || result.sort || result.sortFallback) {
        lines.push('✅ Ordenação defensiva A:S executada. A linha inteira A:S foi tratada como unidade.');
        if (result.auditAfter && typeof result.auditAfter.totalInvalid !== 'undefined') {
          lines.push(result.auditAfter.totalInvalid === 0
            ? '✅ Pós-ordenação: nenhuma categoria inválida.'
            : '⚠️ Pós-ordenação: ' + escapeHtml(result.auditAfter.totalInvalid) + ' categoria(s) inválida(s).');
        }
        if (result.auditAS && Array.isArray(result.auditAS.alerts)) {
          lines.push(result.auditAS.alerts.length === 0
            ? '✅ Pós-ordenação: nenhum desalinhamento A:S.'
            : '⚠️ Pós-ordenação: ' + escapeHtml(result.auditAS.alerts.length) + ' desalinhamento(s) A:S.');
        }
      }

      if (typeof result.repaired !== 'undefined') {
        lines.push('✅ Reparo concluído: ' + escapeHtml(result.repaired) + ' linha(s) corrigida(s).');
      }

      if (typeof result.processed !== 'undefined') {
        lines.push('✅ Processadas: ' + escapeHtml(result.processed) + ' linha(s).');
      }

      if (typeof result.trained !== 'undefined') {
        lines.push('🧠 Aprendizados/treinos registrados: ' + escapeHtml(result.trained) + '.');
      }

      if (typeof result.feedback !== 'undefined') {
        lines.push('🧠 Feedbacks de modelo registrados: ' + escapeHtml(result.feedback) + '.');
      }

      if (result.summary && typeof result.summary === 'object') {
        const s = result.summary;
        const bits = [];
        if (typeof s.ok !== 'undefined') bits.push('OK: ' + s.ok);
        if (typeof s.warn !== 'undefined') bits.push('avisos: ' + s.warn);
        if (typeof s.fatal !== 'undefined') bits.push('críticos: ' + s.fatal);
        if (bits.length) lines.push('📋 Resumo: ' + escapeHtml(bits.join(' | ')) + '.');
      }

      const errors = [];
      if (Array.isArray(result.errors)) errors.push.apply(errors, result.errors);
      if (Array.isArray(res && res.errors)) errors.push.apply(errors, res.errors);

      if (errors.length) {
        lines.push('⚠️ Alertas/erros registrados: ' + escapeHtml(errors.length) + '.');
      }

      if (lines.length === 1) {
        lines.push('Ação finalizada. O retorno técnico não trouxe um resumo padronizado para esta função.');
      }

      const raw = escapeHtml(JSON.stringify(res, null, 2).slice(0, 3000));
      lines.push('<details style="margin-top:8px"><summary>Ver detalhes técnicos</summary><pre>' + raw + '</pre></details>');

      return lines.join('<br>');
    }

    function runTool(id) {
      const tool = TOOLS.find(function(t) { return t.id === id; });

      if (!tool) {
        showResult(false, '<strong>Ferramenta não encontrada.</strong>');
        return;
      }

      if (tool.risk === 'YELLOW') {
        openConfirm(tool);
        return;
      }

      executeTool(id);
    }

    function openConfirm(tool) {
      pendingToolId = tool.id;

      const backupBefore = document.getElementById('backupBefore').checked;

      document.getElementById('confirmTitle').textContent = tool.title;
      document.getElementById('confirmDesc').textContent = tool.description || '';
      document.getElementById('confirmFn').textContent = tool.fn || '';

      document.getElementById('confirmWarn').innerHTML = backupBefore
        ? 'O backup antes de ações amarelas está marcado. A Central tentará criar um backup antes de executar esta ação.'
        : 'Atenção: o backup antes de ações amarelas está desmarcado. Execute somente se tiver certeza.';

      document.getElementById('confirmRunBtn').textContent = backupBefore
        ? 'Executar com backup'
        : 'Executar sem backup';

      document.getElementById('confirmOverlay').className = 'modalOverlay show';
    }

    function closeConfirm() {
      pendingToolId = null;
      document.getElementById('confirmOverlay').className = 'modalOverlay';
    }

    function confirmRun() {
      const id = pendingToolId;
      closeConfirm();
      executeTool(id);
    }

    function executeTool(id) {
      const tool = TOOLS.find(function(t) { return t.id === id; });

      if (!tool) {
        showResult(false, '<strong>Ferramenta não encontrada.</strong>');
        return;
      }

      const backupBefore = document.getElementById('backupBefore').checked;

      showResult(true, '<strong>Executando:</strong> ' + escapeHtml(tool.title) + '...');

      google.script.run
        .withSuccessHandler(function(res) {
          const ok = !res || res.ok !== false;
          showResult(ok, humanizeToolResult(tool, res));
        })
        .withFailureHandler(function(err) {
          showResult(
            false,
            '<strong>Erro ao executar:</strong> ' +
            escapeHtml(tool.title) +
            '<br>' +
            escapeHtml(err && err.message ? err.message : err)
          );
        })
        .GFP_CENTRAL_FERRAMENTAS_EXECUTE_16_1_14(id, { backupBefore: backupBefore });
    }

    renderTools();
  `);
  htmlParts.push('</script>');
  htmlParts.push('</body></html>');

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(htmlParts.join("\n")).setWidth(1280).setHeight(760),
    "GFP — Central de Ferramentas"
  );
}


/**
 * Lista controlada revisada.
 * Não inclui funções já disponíveis no menu principal.
 * Não inclui cards bloqueados.
 */
function GFP_CENTRAL_FERRAMENTAS_REGISTRY_16_1_14_() {
  return [
    {
      id: "painel_auditorias",
      title: "Painel de Auditorias",
      fn: "GFP_PAINEL_AUDITORIAS_OPEN_16_1_17",
      risk: "GREEN",
      group: "Auditoria",
      description: "Abre painel visual leve com resumo da saúde do sistema. Não altera dados.",
      tags: ["auditoria", "painel", "diagnóstico"]
    },
    {
      id: "arquivos_importados",
      title: "Analisar / arquivar arquivos já importados",
      fn: "GFP_ARQUIVOS_IMPORTADOS_MODAL_16_1_16",
      risk: "GREEN",
      group: "Arquivos / Drive",
      description: "Abre painel para analisar PDFs/CSVs/TXTs da pasta de importação e mover para IMPORTADOS somente os confirmados por ID_ARQUIVO/fileId.",
      tags: ["drive", "arquivos", "importação", "organização"]
    },
    {
      id: "auditar_as",
      title: "Auditar A:S / Metadados",
      fn: "GFP_AUDITAR_ALINHAMENTO_METADADOS_DB_MODAL_16_1_12_1",
      risk: "GREEN",
      group: "Auditoria",
      description: "Verifica possíveis desalinhamentos entre dados principais e metadados. Não altera dados.",
      tags: ["A:S", "metadados", "diagnóstico"]
    },
    {
      id: "auditar_categorias",
      title: "Auditar categorias inválidas",
      fn: "GFP_AUDITAR_CATEGORIAS_INVALIDAS_16_1_13",
      risk: "GREEN",
      group: "Auditoria",
      description: "Confere se as categorias em DB_TRANSACOES e DB_TRANSACOES_HIST existem na CFG_Categorias.",
      tags: ["categorias", "diagnóstico"]
    },
    {
      id: "diagnosticar_pasta_backup",
      title: "Diagnosticar pasta de backup",
      fn: "GFP_BACKUP_DIAGNOSTICAR_PASTA_16_1_2",
      risk: "GREEN",
      group: "Backup",
      description: "Confere a estrutura/pasta usada pelos backups, sem criar backup novo.",
      tags: ["backup", "diagnóstico", "drive"]
    },
    {
      id: "debug_dashboard",
      title: "Debug rápido do Dashboard",
      fn: "GFP_DASHBOARD_V2_DEBUG_14_10",
      risk: "GREEN",
      group: "Dashboard",
      description: "Gera diagnóstico rápido do Dashboard no Logger/toast. Não altera a base financeira.",
      tags: ["dashboard", "diagnóstico"]
    },
    {
      id: "dry_clean_meta_nao_cartao",
      title: "Simular limpeza de metadados de fatura em linhas não-cartão",
      fn: "GFP_CLEAN_NON_CARD_CASH_METADATA_DRYRUN",
      risk: "GREEN",
      group: "Metadados",
      description: "Simula remoção de cashMonth/invoiceDueDate indevidos em linhas que não são cartão/fatura. Não altera dados.",
      tags: ["metadados", "fatura", "dry-run"]
    },
    {
      id: "dry_backfill_cashmonth",
      title: "Simular preenchimento de cashMonth de faturas antigas",
      fn: "GFP_BACKFILL_INVOICE_CASH_METADATA_DRYRUN",
      risk: "GREEN",
      group: "Metadados",
      description: "Simula preenchimento de metadados de caixa/vencimento em linhas antigas de cartão. Não altera dados.",
      tags: ["cashMonth", "fatura", "dry-run"]
    },
    {
      id: "simular_migracao_categorias",
      title: "Simular migração de categorias legadas",
      fn: "GFP_MIGRAR_CATEGORIAS_LEGADAS_16_1_13",
      args: [true],
      risk: "GREEN",
      group: "Categorias",
      description: "Simula troca de categorias antigas por novas. Não altera dados.",
      tags: ["categorias", "simulação"]
    },
 {
      id: "inteligencia_status",
      title: "Status da inteligência",
      fn: "GFP_INTELIGENCIA_STATUS_16_1_18_4",
      risk: "GREEN",
      group: "Inteligência",
      backup: false,
      description: "Mostra se Modelo antes do Gemini, Gemini e cota de Re-Gemini estão configurados.",
      tags: ["modelo", "gemini", "status"]
    },
    {
      id: "ativar_modelo_antes_gemini",
      title: "Ativar modelo antes do Gemini",
      fn: "GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4",
      risk: "YELLOW",
      group: "Inteligência",
      backup: false,
      description: "Liga o modelo interno como primeira tentativa antes do Gemini nas próximas importações/repescagens.",
      tags: ["modelo", "gemini"]
    },
    {
      id: "reavaliar_modelo_interno",
      title: "Reavaliar DB com modelo interno",
      fn: "GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4",
      risk: "YELLOW",
      group: "Inteligência",
      backup: true,
      description: "Reavalia linhas não OK da DB_TRANSACOES usando o modelo interno. Não chama Gemini.",
      tags: ["modelo", "repescagem", "classificação"]
    },
    {
      id: "regemini_controlado",
      title: "Re-Gemini controlado",
      fn: "GFP_REGEMINI_CONTROLADO_16_1_18_4",
      risk: "YELLOW",
      group: "Inteligência",
      backup: true,
      description: "Reavalia poucas linhas pendentes com Gemini, respeitando cota diária e sem substituir Modelo Forte/Médio.",
      tags: ["gemini", "cota", "repescagem"]
    },
    {
      id: "repescagem_modelo_gemini",
      title: "Repescagem: modelo + Gemini",
      fn: "GFP_REPESCAGEM_MODELO_E_GEMINI_16_1_18_4",
      risk: "YELLOW",
      group: "Inteligência",
      backup: true,
      description: "Primeiro roda modelo interno na DB; depois usa Gemini controlado em poucas pendências restantes.",
      tags: ["modelo", "gemini", "repescagem"]
    },

    {
      id: "reorganizar_mesa_sort",
      title: "Reorganizar mesa / corrigir ordem",
      fn: "GFP_REORGANIZAR_MESA_DB_TRANSACOES_16_1_18_3",
      risk: "YELLOW",
      group: "Organização",
      backup: true,
      description: "Recalcula O:S, corrige notas visíveis incoerentes e ordena DB_TRANSACOES sem usar a coluna NOTAS como critério.",
      tags: ["ordenação", "A:S", "notas", "mesa"]
    },
    {
      id: "reparar_metadados_selecao",
      title: "Reparar metadados das linhas selecionadas",
      fn: "GFP_REPARAR_METADADOS_DESALINHADOS_PREVIEW_16_1_12_2",
      risk: "YELLOW",
      group: "Reparos",
      backup: true,
      description: "Abre reparo assistido para corrigir somente a coluna METADADOS das linhas selecionadas.",
      tags: ["metadados", "reparo", "seleção"]
    },
    {
      id: "aplicar_checkbox_pendencias",
      title: "Aplicar checkboxes em pendências categorizadas",
      fn: "GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1",
      risk: "YELLOW",
      group: "Visual / Revisão",
      backup: true,
      description: "Transforma pendências categorizadas em checkboxes aprováveis na coluna STATUS.",
      tags: ["checkbox", "status", "revisão"]
    },
    {
      id: "compactar_notas_auto",
      title: "Compactar notas automáticas longas",
      fn: "GFP_COMPACTAR_NOTAS_GLOBAIS_DB_TRANSACOES_14_5_1",
      risk: "YELLOW",
      group: "Visual / Notas",
      backup: true,
      description: "Move notas automáticas longas para nota de célula e deixa texto curto visível.",
      tags: ["notas", "visual", "limpeza"]
    },
    {
      id: "compactar_notas_gemini",
      title: "Compactar notas longas do Gemini",
      fn: "GFP_COMPACTAR_NOTAS_GEMINI_PARA_NOTAS_DE_CELULA_14_1_1",
      risk: "YELLOW",
      group: "Visual / Notas",
      backup: true,
      description: "Compacta notas longas do Gemini/Modelo para melhorar leitura da DB_TRANSACOES.",
      tags: ["notas", "gemini", "visual"]
    },
    {
      id: "humanizar_logs",
      title: "Humanizar SYS_LOGS existente",
      fn: "GFP_SYS_LOGS_HUMANIZAR_EXISTENTE_16_1_4",
      risk: "YELLOW",
      group: "Logs",
      backup: true,
      description: "Limpa e reorganiza SYS_LOGS em linguagem mais humana. Não mexe na base financeira.",
      tags: ["logs", "visual"]
    },
    {
      id: "restaurar_logs_antigos",
      title: "Restaurar padrão simples do SYS_LOGS",
      fn: "GFP_SYS_LOGS_RESTAURAR_PADRAO_ANTIGO_16_1_2",
      risk: "YELLOW",
      group: "Logs",
      backup: true,
      description: "Restaura SYS_LOGS para o padrão simples: quando, tipo, área, o que aconteceu e observação.",
      tags: ["logs", "formatação"]
    },
    {
      id: "aplicar_migracao_categorias",
      title: "Aplicar migração de categorias legadas",
      fn: "GFP_APLICAR_MIGRACAO_CATEGORIAS_LEGADAS_16_1_13",
      risk: "YELLOW",
      group: "Categorias",
      backup: true,
      description: "Substitui categorias antigas pelas novas em DB_TRANSACOES e DB_TRANSACOES_HIST. Use apenas quando necessário.",
      tags: ["categorias", "altera dados"]
    },
    {
      id: "apply_clean_meta_nao_cartao",
      title: "Aplicar limpeza de metadados de fatura em linhas não-cartão",
      fn: "GFP_CLEAN_NON_CARD_CASH_METADATA_APPLY",
      risk: "YELLOW",
      group: "Metadados",
      backup: true,
      description: "Remove metadados de fatura indevidos em linhas que não são cartão/fatura. Use após simular.",
      tags: ["metadados", "fatura", "altera dados"]
    },
        {
      id: "repescagem_inteligente",
      title: "Repescagem inteligente",
      fn: "GFP_MENU_REPESCAGEM_INTELIGENTE_16_1_18_4_2",
      risk: "YELLOW",
      group: "Inteligência",
      backup: true,
      description: "Roda modelo interno, depois Re-Gemini controlado em até 33 linhas, e reorganiza a mesa.",
      tags: ["modelo", "gemini", "repescagem"]
    },
    {
      id: "repescar_so_modelo",
      title: "Repescar só com modelo interno",
      fn: "GFP_MENU_REPESCAR_SO_MODELO_INTERNO_16_1_18_4_2",
      risk: "YELLOW",
      group: "Inteligência",
      backup: true,
      description: "Reavalia DB_TRANSACOES inteira com o modelo interno, sem chamar Gemini.",
      tags: ["modelo", "repescagem"]
    }
    
  ];
}


/**
 * Executor seguro: só executa ferramentas registradas.
 */
function GFP_CENTRAL_FERRAMENTAS_EXECUTE_16_1_14(id, options) {
  const opt = options || {};
  const registry = GFP_CENTRAL_FERRAMENTAS_REGISTRY_16_1_14_();
  const tool = registry.find(function(t) { return t.id === id; });

  if (!tool) {
    return {
      ok: false,
      error: "Ferramenta não encontrada na whitelist.",
      id: id
    };
  }

  const fn = GFP_CENTRAL_FERRAMENTAS_GET_FN_16_1_14_(tool.fn);

  if (!fn) {
    return {
      ok: false,
      error: "Função não encontrada no projeto.",
      title: tool.title,
      fn: tool.fn
    };
  }

  const out = {
    ok: true,
    patch: GFP_CENTRAL_FERRAMENTAS_PATCH_16_1_14,
    id: id,
    title: tool.title,
    fn: tool.fn,
    risk: tool.risk,
    backup: null,
    result: null,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  try {
    if (tool.risk === "YELLOW" && tool.backup && opt.backupBefore !== false) {
      const backupFn = GFP_CENTRAL_FERRAMENTAS_GET_FN_16_1_14_("GFP_BACKUP_SEGURANCA_EXCEL_16_1_2");

      if (!backupFn) {
        return {
          ok: false,
          error: "Backup obrigatório não disponível. A ação foi bloqueada por segurança.",
          title: tool.title
        };
      }

      out.backup = backupFn();
    }

    out.result = fn.apply(null, Array.isArray(tool.args) ? tool.args : []);

  } catch (e) {
    out.ok = false;
    out.error = e.message;
  }

  out.finishedAt = new Date().toISOString();

  GFP_CENTRAL_FERRAMENTAS_LOG_16_1_14_(out);

  return out;
}


function GFP_CENTRAL_FERRAMENTAS_GET_FN_16_1_14_(name) {
  try {
    const root = typeof globalThis !== "undefined" ? globalThis : this;
    return root && typeof root[name] === "function" ? root[name] : null;
  } catch (e) {
    return null;
  }
}


function GFP_CENTRAL_FERRAMENTAS_LOG_16_1_14_(out) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("SYS_LOGS");

    if (!sh) return;

    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, 5).setValues([[
      Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
      out.ok ? "OK" : "WARN",
      "Central de Ferramentas",
      "Central de Ferramentas: " + (out.title || out.id),
      out.ok ? "" : (out.error || "")
    ]]);
  } catch (e) {}
}
