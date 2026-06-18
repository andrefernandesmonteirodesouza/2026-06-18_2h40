/**
 * 📂 ARQUIVO: 5_UTILS/acoes_sensiveis_e_arquivos_importados_16_1_16.gs
 * 🛡️ MÓDULO: AÇÕES SENSÍVEIS + ARQUIVAMENTO ASSISTIDO DE ARQUIVOS IMPORTADOS
 * 🔢 VERSÃO: 16.1.16
 *
 * Funções:
 * - backup antes de ações sensíveis;
 * - painel para analisar PDFs/CSVs/TXTs já importados;
 * - mover arquivos confirmados por fileId para subpasta IMPORTADOS.
 */

const GFP_ACOES_SENSIVEIS_PATCH_16_1_16 = "16.1.16";
const GFP_IMPORTADOS_ARCHIVE_FOLDER_NAME_16_1_16 = "IMPORTADOS";


/**
 * Backup padrão antes de ação sensível.
 *
 * Pode ser desligado temporariamente por Script Property:
 *   GFP_BACKUP_ANTES_ACAO_SENSIVEL = FALSE
 */
function GFP_BACKUP_ANTES_ACAO_SENSIVEL_16_1_16_(label) {
  const props = PropertiesService.getScriptProperties();
  const enabled = String(props.getProperty("GFP_BACKUP_ANTES_ACAO_SENSIVEL") || "TRUE").toUpperCase() !== "FALSE";

  if (!enabled) {
    return {
      ok: true,
      skipped: true,
      reason: "backup sensível desligado por Script Property",
      label: label || ""
    };
  }

  const fn = GFP_16_1_16_GET_FN_("GFP_BACKUP_SEGURANCA_EXCEL_16_1_2");

  if (!fn) {
    throw new Error("Backup obrigatório não disponível: GFP_BACKUP_SEGURANCA_EXCEL_16_1_2 não encontrada.");
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Criando backup antes de: " + (label || "ação sensível") + "...",
    "GFP 16.1.16",
    8
  );

  const res = fn();

  GFP_16_1_16_LOG_(
    "OK",
    "Backup de segurança executado antes de ação sensível.",
    "Ação: " + (label || "") + " | Arquivo: " + (res && res.fileName || "")
  );

  return res;
}


/**
 * Abre painel visual para analisar e mover arquivos já importados.
 */
function GFP_ARQUIVOS_IMPORTADOS_MODAL_16_1_16() {
  const analysis = GFP_ARQUIVOS_IMPORTADOS_ANALISAR_16_1_16();

  const filesJson = JSON.stringify(analysis.files || [])
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  const html = GFP_ARQUIVOS_IMPORTADOS_HTML_16_1_16_(analysis, filesJson);

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1280).setHeight(760),
    "GFP — Arquivos importados"
  );

  return analysis;
}


/**
 * Analisa arquivos diretos da pasta de importação.
 *
 * Status:
 * - IMPORTADO_POR_ID: existe em DB_TRANSACOES/HIST pelo ID_ARQUIVO ou metadados.fileId. Pode mover.
 * - POSSIVEL_POR_NOME: não bateu por fileId, mas bateu por nome. Não move automaticamente.
 * - NAO_IDENTIFICADO: não encontrado na base. Fica na pasta.
 */
function GFP_ARQUIVOS_IMPORTADOS_ANALISAR_16_1_16() {
  const folder = GFP_IMPORTADOS_GET_IMPORT_FOLDER_16_1_16_();
  const index = GFP_IMPORTADOS_BUILD_INDEX_16_1_16_();
  const files = GFP_IMPORTADOS_LIST_DIRECT_FILES_16_1_16_(folder);

  const analyzed = files.map(function(file) {
    const nameKey = GFP_IMPORTADOS_NORMALIZE_NAME_16_1_16_(file.name);
    const byId = index.byFileId[file.id] || null;
    const byName = index.byFileName[nameKey] || null;

    let status = "NAO_IDENTIFICADO";
    let statusLabel = "fica na pasta";
    let canMove = false;
    let reason = "Não encontrei esse arquivo na DB_TRANSACOES/DB_TRANSACOES_HIST.";

    if (byId) {
      status = "IMPORTADO_POR_ID";
      statusLabel = "pode arquivar";
      canMove = true;
      reason = "Arquivo confirmado por ID_ARQUIVO/metadados.fileId. Linhas encontradas: " + byId.count + ".";
    } else if (byName) {
      status = "POSSIVEL_POR_NOME";
      statusLabel = "revisar";
      canMove = false;
      reason = "Encontrei mesmo nome em metadados, mas não o mesmo fileId. Não movo automaticamente.";
    }

    return {
      id: file.id,
      name: file.name,
      mime: file.mime,
      url: file.url,
      lastUpdated: file.lastUpdated,
      size: file.size,
      status: status,
      statusLabel: statusLabel,
      canMove: canMove,
      reason: reason,
      rowsById: byId ? byId.count : 0,
      rowsByName: byName ? byName.count : 0
    };
  });

  const summary = {
    total: analyzed.length,
    canMove: analyzed.filter(function(f) { return f.canMove; }).length,
    possibleByName: analyzed.filter(function(f) { return f.status === "POSSIVEL_POR_NOME"; }).length,
    notFound: analyzed.filter(function(f) { return f.status === "NAO_IDENTIFICADO"; }).length
  };

  return {
    ok: true,
    patch: GFP_ACOES_SENSIVEIS_PATCH_16_1_16,
    importFolder: {
      id: folder.getId(),
      name: folder.getName(),
      url: folder.getUrl()
    },
    archiveFolderName: GFP_IMPORTADOS_ARCHIVE_FOLDER_NAME_16_1_16,
    summary: summary,
    files: analyzed
  };
}


/**
 * Move apenas arquivos confirmados por fileId/ID_ARQUIVO.
 * Cria backup antes.
 */
function GFP_ARQUIVOS_IMPORTADOS_MOVER_CONFIRMADO_16_1_16() {
  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    return {
      ok: false,
      error: "Não foi possível obter lock. Tente novamente."
    };
  }

  const out = {
    ok: true,
    patch: GFP_ACOES_SENSIVEIS_PATCH_16_1_16,
    backup: null,
    moved: [],
    skipped: [],
    errors: [],
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  try {
    out.backup = GFP_BACKUP_ANTES_ACAO_SENSIVEL_16_1_16_("Arquivar arquivos importados");

    const analysis = GFP_ARQUIVOS_IMPORTADOS_ANALISAR_16_1_16();
    const candidates = (analysis.files || []).filter(function(f) { return f.canMove; });

    const importFolder = GFP_IMPORTADOS_GET_IMPORT_FOLDER_16_1_16_();
    const archiveFolder = GFP_IMPORTADOS_GET_OR_CREATE_CHILD_FOLDER_16_1_16_(
      importFolder,
      GFP_IMPORTADOS_ARCHIVE_FOLDER_NAME_16_1_16
    );

    candidates.forEach(function(fileInfo) {
      try {
        const file = DriveApp.getFileById(fileInfo.id);
        file.moveTo(archiveFolder);

        out.moved.push({
          id: fileInfo.id,
          name: fileInfo.name,
          rowsById: fileInfo.rowsById
        });

      } catch (eFile) {
        out.errors.push({
          id: fileInfo.id,
          name: fileInfo.name,
          error: eFile.message
        });
      }
    });

    (analysis.files || []).forEach(function(fileInfo) {
      if (!fileInfo.canMove) {
        out.skipped.push({
          id: fileInfo.id,
          name: fileInfo.name,
          status: fileInfo.status,
          reason: fileInfo.reason
        });
      }
    });

    if (out.errors.length) out.ok = false;

  } catch (e) {
    out.ok = false;
    out.error = e.message;
  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }

  out.finishedAt = new Date().toISOString();

  GFP_16_1_16_LOG_(
    out.ok ? "OK" : "WARN",
    "Arquivamento assistido de arquivos importados concluído.",
    "Movidos: " + out.moved.length + " | Ignorados: " + out.skipped.length + " | Erros: " + out.errors.length
  );

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Arquivos importados: " + out.moved.length + " movido(s), " + out.skipped.length + " ignorado(s).",
    "GFP 16.1.16",
    10
  );

  return out;
}


function GFP_IMPORTADOS_GET_IMPORT_FOLDER_16_1_16_() {
  if (typeof PROJECT_CONFIG === "undefined" || !PROJECT_CONFIG.FOLDER_ID_IMPORTS) {
    throw new Error("PROJECT_CONFIG.FOLDER_ID_IMPORTS não configurado.");
  }

  return DriveApp.getFolderById(PROJECT_CONFIG.FOLDER_ID_IMPORTS);
}


function GFP_IMPORTADOS_LIST_DIRECT_FILES_16_1_16_(folder) {
  const out = [];
  const files = folder.getFiles();

  while (files.hasNext()) {
    const f = files.next();
    const name = String(f.getName() || "");
    const lower = name.toLowerCase();
    const mime = f.getMimeType();

    const supported =
      mime === MimeType.PDF ||
      mime === MimeType.PLAIN_TEXT ||
      lower.endsWith(".csv") ||
      lower.endsWith(".txt") ||
      lower.endsWith(".pdf");

    if (!supported) continue;

    out.push({
      id: f.getId(),
      name: name,
      mime: mime,
      url: f.getUrl(),
      lastUpdated: Utilities.formatDate(f.getLastUpdated(), Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss"),
      size: f.getSize()
    });
  }

  out.sort(function(a, b) {
    return String(a.name).localeCompare(String(b.name), "pt-BR");
  });

  return out;
}


function GFP_IMPORTADOS_BUILD_INDEX_16_1_16_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const index = {
    byFileId: {},
    byFileName: {}
  };

  ["DB_TRANSACOES", "DB_TRANSACOES_HIST"].forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);

    if (!sh || sh.getLastRow() < 2) return;

    const lastCol = Math.max(14, Math.min(sh.getLastColumn(), 20));
    const values = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();

    values.forEach(function(row, idx) {
      const sheetRow = idx + 2;
      const idArquivo = String(row[11] || "").trim();
      const meta = GFP_IMPORTADOS_PARSE_JSON_16_1_16_(row[13]);

      const ids = [];
      if (idArquivo) ids.push(idArquivo);
      if (meta.fileId) ids.push(String(meta.fileId).trim());

      ids.filter(Boolean).forEach(function(fileId) {
        if (!index.byFileId[fileId]) {
          index.byFileId[fileId] = {
            count: 0,
            rows: []
          };
        }

        index.byFileId[fileId].count++;
        if (index.byFileId[fileId].rows.length < 12) {
          index.byFileId[fileId].rows.push(sheetName + "!" + sheetRow);
        }
      });

      const names = [];
      if (meta.fileName) names.push(meta.fileName);
      if (meta.invoiceFileName) names.push(meta.invoiceFileName);

      names.filter(Boolean).forEach(function(fileName) {
        const key = GFP_IMPORTADOS_NORMALIZE_NAME_16_1_16_(fileName);

        if (!key) return;

        if (!index.byFileName[key]) {
          index.byFileName[key] = {
            count: 0,
            rows: []
          };
        }

        index.byFileName[key].count++;
        if (index.byFileName[key].rows.length < 12) {
          index.byFileName[key].rows.push(sheetName + "!" + sheetRow);
        }
      });
    });
  });

  return index;
}


function GFP_IMPORTADOS_GET_OR_CREATE_CHILD_FOLDER_16_1_16_(parentFolder, childName) {
  const folders = parentFolder.getFoldersByName(childName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(childName);
}


function GFP_IMPORTADOS_NORMALIZE_NAME_16_1_16_(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


function GFP_IMPORTADOS_PARSE_JSON_16_1_16_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}


function GFP_16_1_16_GET_FN_(name) {
  try {
    const root = typeof globalThis !== "undefined" ? globalThis : this;
    return root && typeof root[name] === "function" ? root[name] : null;
  } catch (e) {
    return null;
  }
}


function GFP_16_1_16_LOG_(type, message, obs) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("SYS_LOGS");

    if (!sh) return;

    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, 5).setValues([[
      Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
      type || "INFO",
      "Arquivos importados",
      message || "",
      obs || ""
    ]]);
  } catch (e) {}
}


function GFP_ARQUIVOS_IMPORTADOS_HTML_16_1_16_(analysis, filesJson) {
  const summary = analysis.summary || {};

  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<base target="_top">',
    '<style>',
    'body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a}',
    '.top{background:#0b2d4d;color:#fff;padding:18px 22px}',
    '.top h1{margin:0;font-size:20px;font-weight:800}',
    '.top p{margin:6px 0 0;font-size:12px;opacity:.9}',
    '.wrap{padding:18px 22px 22px}',
    '.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}',
    '.kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px}',
    '.kpi b{display:block;font-size:20px;color:#0b2d4d;margin-bottom:4px}',
    '.kpi span{font-size:11px;color:#64748b;font-weight:700}',
    'table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-size:12px}',
    'th{background:#e5e7eb;text-align:left;padding:9px;color:#111827;border-bottom:1px solid #cbd5e1}',
    'td{padding:9px;border-bottom:1px solid #e5e7eb;vertical-align:top}',
    '.badge{display:inline-block;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}',
    '.ok{background:#dcfce7;color:#166534}',
    '.warn{background:#fef9c3;color:#92400e}',
    '.muted{background:#f1f5f9;color:#64748b}',
    '.reason{font-size:11px;color:#475569;line-height:1.35}',
    '.footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}',
    'button{border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer;font-size:12px}',
    '.primary{background:#0b2d4d;color:#fff}',
    '.secondary{background:#e0f2fe;color:#0b2d4d}',
    '.danger{background:#fee2e2;color:#991b1b}',
    '#result{display:none;margin-bottom:14px;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.4}',
    '#result.okbox{display:block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}',
    '#result.warnbox{display:block;background:#fef2f2;color:#991b1b;border:1px solid #fecaca}',
    '.note{font-size:12px;color:#475569;line-height:1.45;margin-top:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="top">',
    '<h1>📁 GFP — Arquivos importados</h1>',
    '<p>Analisa a pasta de importação e move para IMPORTADOS somente arquivos confirmados por ID_ARQUIVO/fileId.</p>',
    '</div>',
    '<div class="wrap">',
    '<div id="result"></div>',
    '<div class="summary">',
    '<div class="kpi"><b>' + summary.total + '</b><span>arquivos na pasta</span></div>',
    '<div class="kpi"><b>' + summary.canMove + '</b><span>confirmados por ID</span></div>',
    '<div class="kpi"><b>' + summary.possibleByName + '</b><span>possíveis por nome</span></div>',
    '<div class="kpi"><b>' + summary.notFound + '</b><span>não identificados</span></div>',
    '</div>',
    '<table>',
    '<thead><tr><th>Status</th><th>Arquivo</th><th>Linhas</th><th>Motivo</th></tr></thead>',
    '<tbody id="fileRows"></tbody>',
    '</table>',
    '<div class="note">',
    '<strong>Regra de segurança:</strong> somente arquivos confirmados por fileId/ID_ARQUIVO serão movidos. Arquivos que batem apenas por nome não serão movidos automaticamente.',
    '</div>',
    '<div class="footer">',
    '<button class="secondary" onclick="google.script.host.close()">Fechar</button>',
    '<button class="primary" onclick="moveFiles()">Mover confirmados para IMPORTADOS</button>',
    '</div>',
    '</div>',
    '<script>',
    'const FILES = ' + filesJson + ';',
    'function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").split(String.fromCharCode(39)).join("&#039;");}',
    'function badge(f){if(f.status==="IMPORTADO_POR_ID")return "<span class=\\"badge ok\\">Pode arquivar</span>";if(f.status==="POSSIVEL_POR_NOME")return "<span class=\\"badge warn\\">Revisar</span>";return "<span class=\\"badge muted\\">Fica na pasta</span>";}',
    'function render(){document.getElementById("fileRows").innerHTML=FILES.map(function(f){return "<tr><td>"+badge(f)+"</td><td><strong>"+esc(f.name)+"</strong><br><small>"+esc(f.mime)+"</small></td><td>"+esc(f.rowsById||0)+" por ID<br>"+esc(f.rowsByName||0)+" por nome</td><td class=\\"reason\\">"+esc(f.reason)+"</td></tr>";}).join("");}',
    'function show(ok,msg){var el=document.getElementById("result");el.className=ok?"okbox":"warnbox";el.innerHTML=msg;}',
    'function moveFiles(){show(true,"<strong>Executando:</strong> criando backup e movendo arquivos confirmados...");google.script.run.withSuccessHandler(function(res){show(res&&res.ok!==false,"<strong>Concluído.</strong><br>Movidos: "+(res&&res.moved?res.moved.length:0)+" | Ignorados: "+(res&&res.skipped?res.skipped.length:0)+" | Erros: "+(res&&res.errors?res.errors.length:0)+"<br>Feche e abra novamente para reanalisar.");}).withFailureHandler(function(err){show(false,"<strong>Erro:</strong> "+(err&&err.message?err.message:err));}).GFP_ARQUIVOS_IMPORTADOS_MOVER_CONFIRMADO_16_1_16();}',
    'render();',
    '</script>',
    '</body>',
    '</html>'
  ].join("\n");
}
