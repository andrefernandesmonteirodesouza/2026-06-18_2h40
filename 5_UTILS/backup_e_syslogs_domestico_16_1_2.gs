/**
 * 📂 ARQUIVO: 5_UTILS/backup_e_syslogs_domestico_16_1_2.gs
 * 🖥️ MÓDULO: BACKUP EXCEL + SYS_LOGS DOMÉSTICO
 * 🔢 VERSÃO: 16.1.2
 *
 * Funções:
 * - exportar backup integral da planilha como Excel (.xlsx);
 * - salvar na pasta "Extratos";
 * - manter SYS_LOGS no padrão antigo, limpo e legível.
 */

const GFP_DOMESTICO_16_1_2_VERSION = "16.1.2";


// =============================================================================
// BACKUP DE SEGURANÇA EM EXCEL
// =============================================================================

/**
 * Exporta a planilha inteira como Excel (.xlsx) e salva na pasta "Extratos".
 *
 * Nome:
 *   GFP_BACKUP_SEGURANCA_0001_yyyy-MM-dd_HHmmss.xlsx
 */
function GFP_BACKUP_SEGURANCA_EXCEL_16_1_2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folder = GFP_BACKUP_SEGURANCA_GET_EXTRATOS_FOLDER_16_1_2_(ss);

  const seq = GFP_BACKUP_SEGURANCA_NEXT_SEQUENCE_16_1_2_(folder);
  const stamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || "America/Sao_Paulo",
    "yyyy-MM-dd_HHmmss"
  );

  const fileName = "GFP_BACKUP_SEGURANCA_" + GFP_BACKUP_SEGURANCA_PAD_16_1_2_(seq, 4) + "_" + stamp + ".xlsx";

  const exportUrl = "https://docs.google.com/spreadsheets/d/" +
    ss.getId() +
    "/export?format=xlsx";

  const response = UrlFetchApp.fetch(exportUrl, {
    method: "get",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();

  if (code < 200 || code >= 300) {
    const msg = "Falha ao exportar backup Excel. HTTP " + code + ".";
    GFP_SYS_LOGS_LOG_LIMPO_16_1_2_("ERRO", "GFP_BACKUP_SEGURANCA_EXCEL_16_1_2", msg, response.getContentText().substring(0, 500));
    throw new Error(msg);
  }

  const blob = response.getBlob().setName(fileName);
  const file = folder.createFile(blob);

  GFP_SYS_LOGS_LOG_LIMPO_16_1_2_(
    "OK",
    "GFP_BACKUP_SEGURANCA_EXCEL_16_1_2",
    "Backup de segurança criado em Excel: " + fileName,
    ""
  );

  GFP_SYS_LOGS_RESTAURAR_PADRAO_ANTIGO_16_1_2();

  SpreadsheetApp.getActive().toast(
    "Backup Excel criado na pasta Extratos: " + fileName,
    "GFMB"
  );

  return {
    ok: true,
    version: GFP_DOMESTICO_16_1_2_VERSION,
    fileName: fileName,
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    folderId: folder.getId(),
    folderName: folder.getName()
  };
}

/**
 * Localiza a pasta "Extratos".
 *
 * Ordem:
 * 1. Script Property GFP_EXTRATOS_FOLDER_ID ou EXTRATOS_FOLDER_ID, se existir.
 * 2. Pasta "Extratos" dentro da mesma pasta da planilha.
 * 3. Primeira pasta "Extratos" encontrada no Drive.
 * 4. Cria "Extratos" na mesma pasta da planilha, ou no Drive raiz.
 */
/**
 * Localiza a pasta correta de backup:
 *
 *   Meu Drive / Extratos Bancários André / BACKUP
 *
 * Ordem:
 * 1. Se houver Script Property GFP_BACKUP_FOLDER_ID, usa essa pasta.
 * 2. Procura o caminho exato no Meu Drive.
 * 3. Se "BACKUP" não existir dentro de "Extratos Bancários André", cria.
 * 4. Se "Extratos Bancários André" não existir no Meu Drive, cria também.
 *
 * Importante:
 * - Não procura mais qualquer pasta "Extratos" solta no Drive.
 * - Não salva mais na pasta antiga da Maria Brasileira por coincidência de nome.
 */
function GFP_BACKUP_SEGURANCA_GET_EXTRATOS_FOLDER_16_1_2_(ss) {
  const props = PropertiesService.getScriptProperties();

  const configuredId =
    props.getProperty("GFP_BACKUP_FOLDER_ID") ||
    props.getProperty("GFP_EXTRATOS_BANCARIOS_BACKUP_FOLDER_ID");

  if (configuredId) {
    try {
      return DriveApp.getFolderById(configuredId);
    } catch (e) {
      // Se o ID configurado estiver inválido, segue para o caminho fixo.
    }
  }

  const root = DriveApp.getRootFolder();

  const pastaExtratosBancarios = GFP_BACKUP_GET_OR_CREATE_CHILD_FOLDER_16_1_2_(
    root,
    "Extratos Bancários André"
  );

  const pastaBackup = GFP_BACKUP_GET_OR_CREATE_CHILD_FOLDER_16_1_2_(
    pastaExtratosBancarios,
    "BACKUP"
  );

  // Guarda o ID correto para as próximas execuções, evitando busca repetida.
  props.setProperty("GFP_BACKUP_FOLDER_ID", pastaBackup.getId());

  return pastaBackup;
}

/**
 * Busca uma subpasta direta pelo nome. Se não existir, cria.
 */
function GFP_BACKUP_GET_OR_CREATE_CHILD_FOLDER_16_1_2_(parentFolder, childName) {
  const folders = parentFolder.getFoldersByName(childName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(childName);
}

/**
 * Diagnóstico opcional.
 *
 * Depois de aplicar, você pode executar:
 *
 *   GFP_BACKUP_DIAGNOSTICAR_PASTA_16_1_2()
 *
 * Ele mostrará no log e em toast o ID/URL da pasta que será usada.
 */
function GFP_BACKUP_DIAGNOSTICAR_PASTA_16_1_2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folder = GFP_BACKUP_SEGURANCA_GET_EXTRATOS_FOLDER_16_1_2_(ss);

  const result = {
    ok: true,
    folderName: folder.getName(),
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    expectedPath: "Meu Drive / Extratos Bancários André / BACKUP"
  };

  if (typeof GFP_SYS_LOGS_LOG_LIMPO_16_1_2_ === "function") {
    GFP_SYS_LOGS_LOG_LIMPO_16_1_2_(
      "OK",
      "GFP_BACKUP_DIAGNOSTICAR_PASTA_16_1_2",
      "Pasta de backup configurada: " + result.expectedPath + " | " + result.folderName,
      ""
    );
  }

  SpreadsheetApp.getActive().toast(
    "Backup configurado para: Extratos Bancários André / BACKUP",
    "GFMB"
  );

  return result;
}



function GFP_BACKUP_SEGURANCA_NEXT_SEQUENCE_16_1_2_(folder) {
  let max = 0;
  const files = folder.getFiles();

  while (files.hasNext()) {
    const f = files.next();
    const name = String(f.getName() || "");
    const m = name.match(/^GFP_BACKUP_SEGURANCA_(\d{4})_/);

    if (m) {
      const n = Number(m[1]);
      if (!isNaN(n) && n > max) max = n;
    }
  }

  return max + 1;
}

function GFP_BACKUP_SEGURANCA_PAD_16_1_2_(num, size) {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
}


// =============================================================================
// SYS_LOGS — PADRÃO ANTIGO E LIMPO
// =============================================================================

/**
 * Restaura SYS_LOGS para o padrão antigo:
 *
 * Timestamp | Level | Function | Message | Stack Trace
 *
 * Remove:
 * - payload={...}
 * - importações técnicas de LOG_ARQUIVAMENTO/LOG_REVISAO_IA
 * - OBS_FINAL_LOG / OBS16_LOG
 * - mensagens gigantes em JSON que quebram altura da linha
 *
 * Também:
 * - sem wrap;
 * - altura normal;
 * - mais recente no topo.
 */
function GFP_SYS_LOGS_RESTAURAR_PADRAO_ANTIGO_16_1_2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_LOGS");

  if (!sh) {
    sh = ss.insertSheet("SYS_LOGS");
  }

  GFP_SYS_LOGS_ENSURE_HEADER_16_1_2_(sh);

  const lastRow = sh.getLastRow();
  const lastCol = Math.max(5, sh.getLastColumn());

  if (lastRow < 2) {
    GFP_SYS_LOGS_FORMATAR_16_1_2_(sh);
    return { ok: true, kept: 0, removed: 0 };
  }

  const raw = sh.getRange(2, 1, lastRow - 1, Math.min(lastCol, 5)).getValues();
  const cleaned = [];
  let removed = 0;

  raw.forEach(function(row) {
    const normalized = GFP_SYS_LOGS_NORMALIZAR_ROW_16_1_2_(row);

    if (!normalized) {
      removed++;
      return;
    }

    cleaned.push(normalized);
  });

  cleaned.sort(function(a, b) {
    return GFP_SYS_LOGS_DATE_VALUE_16_1_2_(b[0]) - GFP_SYS_LOGS_DATE_VALUE_16_1_2_(a[0]);
  });

  if (lastRow > 1) {
    sh.getRange(2, 1, lastRow - 1, Math.max(5, lastCol)).clearContent();
  }

  if (cleaned.length) {
    sh.getRange(2, 1, cleaned.length, 5).setValues(cleaned);
  }

  GFP_SYS_LOGS_FORMATAR_16_1_2_(sh);

  return {
    ok: true,
    kept: cleaned.length,
    removed: removed
  };
}

function GFP_SYS_LOGS_LOG_LIMPO_16_1_2_(level, funcName, message, stack) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_LOGS");

  if (!sh) {
    sh = ss.insertSheet("SYS_LOGS");
  }

  GFP_SYS_LOGS_ENSURE_HEADER_16_1_2_(sh);

  sh.insertRowBefore(2);

  sh.getRange(2, 1, 1, 5).setValues([[
    GFP_SYS_LOGS_FORMAT_DATE_16_1_2_(new Date()),
    GFP_SYS_LOGS_ONE_LINE_16_1_2_(level || "INFO").toUpperCase(),
    GFP_SYS_LOGS_ONE_LINE_16_1_2_(funcName || ""),
    GFP_SYS_LOGS_TRUNC_16_1_2_(GFP_SYS_LOGS_STRIP_PAYLOAD_16_1_2_(message || ""), 1000),
    GFP_SYS_LOGS_TRUNC_16_1_2_(GFP_SYS_LOGS_STRIP_PAYLOAD_16_1_2_(stack || ""), 500)
  ]]);

  GFP_SYS_LOGS_FORMATAR_16_1_2_(sh);
}

function GFP_SYS_LOGS_NORMALIZAR_ROW_16_1_2_(row) {
  const timestamp = row[0];
  let level = GFP_SYS_LOGS_ONE_LINE_16_1_2_(row[1] || "INFO").toUpperCase();
  let func = GFP_SYS_LOGS_ONE_LINE_16_1_2_(row[2] || "");
  let message = GFP_SYS_LOGS_ONE_LINE_16_1_2_(row[3] || "");
  let stack = GFP_SYS_LOGS_ONE_LINE_16_1_2_(row[4] || "");

  const joined = row.map(function(v) { return String(v || ""); }).join(" | ").trim();
  if (!joined) return null;

  // Remove linhas técnicas importadas que só poluíram o SYS_LOGS.
  if (
    func.indexOf("IMPORTADO_") === 0 ||
    message.indexOf("OBS_FINAL_LOG|") >= 0 ||
    message.indexOf("OBS16_LOG|") >= 0 ||
    message.indexOf('"sourceSheet":"LOG_ARQUIVAMENTO"') >= 0 ||
    message.indexOf('"sourceSheet":"LOG_REVISAO_IA"') >= 0
  ) {
    return null;
  }

  message = GFP_SYS_LOGS_STRIP_PAYLOAD_16_1_2_(message);
  stack = GFP_SYS_LOGS_STRIP_PAYLOAD_16_1_2_(stack);

  message = GFP_SYS_LOGS_TRUNC_16_1_2_(message, 1000);
  stack = GFP_SYS_LOGS_TRUNC_16_1_2_(stack, 500);

  if (!level) level = "INFO";
  if (level === "ERROR") level = "ERRO";
  if (level === "WARNING") level = "WARN";

  return [
    timestamp || GFP_SYS_LOGS_FORMAT_DATE_16_1_2_(new Date()),
    level,
    func,
    message || GFP_SYS_LOGS_TRUNC_16_1_2_(joined, 1000),
    stack
  ];
}

function GFP_SYS_LOGS_STRIP_PAYLOAD_16_1_2_(text) {
  text = String(text || "");

  const markers = [
    " | payload=",
    " payload={",
    " | {\"version\"",
    " | {\"ok\"",
    " | {\"patch\"",
    " | {\"sourceSheet\""
  ];

  for (let i = 0; i < markers.length; i++) {
    const idx = text.indexOf(markers[i]);
    if (idx >= 0) {
      return text.substring(0, idx).trim();
    }
  }

  return text.trim();
}

function GFP_SYS_LOGS_ONE_LINE_16_1_2_(value) {
  return String(value || "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function GFP_SYS_LOGS_TRUNC_16_1_2_(text, max) {
  text = GFP_SYS_LOGS_ONE_LINE_16_1_2_(text);
  if (text.length <= max) return text;
  return text.substring(0, max) + " ...[cortado]";
}

function GFP_SYS_LOGS_ENSURE_HEADER_16_1_2_(sh) {
  sh.getRange(1, 1, 1, 5).setValues([[
    "Timestamp",
    "Level",
    "Function",
    "Message",
    "Stack Trace"
  ]]);
}

function GFP_SYS_LOGS_FORMATAR_16_1_2_(sh) {
  const lastRow = Math.max(1, sh.getLastRow());

  sh.getRange(1, 1, 1, 5)
    .setFontWeight("bold")
    .setBackground("#000000")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) {
    sh.getFilter().remove();
  }

  sh.getDataRange().createFilter();

  try { sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss"); } catch (e) {}

  try {
    sh.getRange(1, 1, lastRow, 5).setWrap(false);
  } catch (e2) {}

  try {
    if (lastRow >= 2) {
      sh.setRowHeights(2, lastRow - 1, 21);
    }
  } catch (e3) {}

  try { sh.setColumnWidth(1, 145); } catch (e4) {}
  try { sh.setColumnWidth(2, 70); } catch (e5) {}
  try { sh.setColumnWidth(3, 260); } catch (e6) {}
  try { sh.setColumnWidth(4, 720); } catch (e7) {}
  try { sh.setColumnWidth(5, 180); } catch (e8) {}
}

function GFP_SYS_LOGS_DATE_VALUE_16_1_2_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.getTime();
  }

  if (typeof value === "number" && !isNaN(value)) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).getTime();
  }

  const text = String(value || "").trim();
  if (!text) return 0;

  const native = new Date(text);
  if (!isNaN(native.getTime())) return native.getTime();

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (br) {
    return new Date(
      Number(br[3]),
      Number(br[2]) - 1,
      Number(br[1]),
      Number(br[4] || 0),
      Number(br[5] || 0),
      Number(br[6] || 0)
    ).getTime();
  }

  return 0;
}

function GFP_SYS_LOGS_FORMAT_DATE_16_1_2_(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() || "America/Sao_Paulo",
    "dd/MM/yyyy HH:mm:ss"
  );
}
