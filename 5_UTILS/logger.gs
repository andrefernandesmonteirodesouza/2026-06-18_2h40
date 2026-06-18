/**
 * 📂 ARQUIVO: 5_UTILS/logger.gs
 * 👁️ MÓDULO: SYS_LOGS — LINGUAGEM SIMPLES
 * 🔢 VERSÃO: 16.1.4
 *
 * Objetivo:
 * - manter compatibilidade com chamadas antigas Logger.log/warn/error;
 * - traduzir logs técnicos para linguagem humana;
 * - ocultar ruído técnico sem utilidade para o usuário;
 * - manter SYS_LOGS como linha do tempo simples.
 */

const LOG_SHEET_NAME = "SYS_LOGS";
const GFP_LOG_HUMANO_VERSION_16_1_4 = "16.1.4";

/**
 * Função principal de registro.
 *
 * Assinatura preservada:
 *   Logger(message, funcName, errorObject, level)
 */
function Logger(message, funcName, errorObject, level) {
  try {
    level = level || "INFO";

    const item = GFP_LOG_HUMANO_CLASSIFICAR_16_1_4_(message, funcName, level, errorObject);

    if (!item || item.keep === false) {
      return;
    }

    GFP_LOG_HUMANO_APPEND_16_1_4_(
      item.level || level,
      item.area || funcName || "",
      item.message || message || "",
      item.stack || ""
    );

  } catch (e) {
    console.error("[FATAL] Logger falhou: " + e.message);
  }
}

/**
 * Separador antigo de execução.
 *
 * Em vez de linha técnica/visual, vira uma linha simples.
 */
function logSeparator() {
  Logger("Importação iniciada.", "Importação", null, "INFO");
}


// =============================================================================
// ALIASES COMPATÍVEIS
// =============================================================================

Logger.log = function(m, f) {
  Logger(m, f, null, "INFO");
};

Logger.warn = function(m, f) {
  Logger(m, f, null, "WARN");
};

Logger.error = function(m, f, e) {
  Logger(m, f, e, "ERRO");
};

Logger.critical = function(m, f, e) {
  Logger(m, f, e, "ERRO");
};

Logger.separator = function() {
  logSeparator();
};


// =============================================================================
// HUMANIZAÇÃO
// =============================================================================

function GFP_LOG_HUMANO_CLASSIFICAR_16_1_4_(message, funcName, level, errorObject) {
  const rawOriginal = String(message || "");
  let raw = GFP_LOG_HUMANO_ONE_LINE_16_1_4_(rawOriginal);
  let func = GFP_LOG_HUMANO_ONE_LINE_16_1_4_(funcName || "");

  if (!raw && errorObject instanceof Error) {
    raw = errorObject.message || "";
  }

  if (!raw && !func) return null;

  const bracketFunc = GFP_LOG_HUMANO_EXTRACT_BRACKET_FUNC_16_1_4_(raw);
  if (!func && bracketFunc) func = bracketFunc;

  const txt = raw.toUpperCase();
  const fn = String(func || "").toUpperCase();

  let lvl = GFP_LOG_HUMANO_NORMALIZE_LEVEL_16_1_4_(level);

  if (errorObject instanceof Error) {
    lvl = "ERRO";
  }

  // ---------------------------------------------------------------------------
  // RUÍDOS QUE NÃO DEVEM APARECER NO SYS_LOGS
  // ---------------------------------------------------------------------------

  if (txt.indexOf("SCANNED=") >= 0 && txt.indexOf("APPLIED=") >= 0 && txt.indexOf("SKIPPED=") >= 0) {
    return null;
  }

  if (
    fn.indexOf("GFP_APLICAR_CHECKBOX") >= 0 ||
    fn.indexOf("GFP_APPLY_GEMINI_CONFIDENCE") >= 0 ||
    fn.indexOf("GFP_COMPACTAR_NOTAS") >= 0 ||
    fn.indexOf("GFP_SANEAR_VISUAL") >= 0 ||
    fn.indexOf("GFP_SORT_DB_TRANSACOES") >= 0 ||
    fn.indexOf("CORENORMALIZEPIPELINE") >= 0 ||
    fn.indexOf("COREIMPORTPIPELINE") >= 0 ||
    fn.indexOf("COREPDFPIPELINE") >= 0 && txt.indexOf("PASTA VAZIA") >= 0 ||
    txt.indexOf("DELIMITADOR DETECTADO") >= 0 ||
    txt.indexOf("MEMÓRIA CARREGADA") >= 0 ||
    txt.indexOf("INICIANDO BLINDAGEM") >= 0 ||
    txt.indexOf("ENVIANDO PROMPT NLP") >= 0 ||
    txt.indexOf("BLOB DE ÁUDIO CRIADO") >= 0 ||
    txt.indexOf("TRANSCRIÇÃO OK USANDO MODELO") >= 0 ||
    txt.indexOf("ARQUIVO SALVO: HTTP") >= 0 ||
    txt.indexOf("RECEBENDO IMAGEM") >= 0
  ) {
    return null;
  }

  if (txt.indexOf("[DUPLICATA DB]") >= 0) {
    return null;
  }

  if (txt.indexOf("RESULTADO: {") >= 0 && txt.indexOf("\"CHANGES\":0") >= 0) {
    return null;
  }

  if (txt.indexOf("PULADO POR THROTTLE") >= 0) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // BACKUP
  // ---------------------------------------------------------------------------

  if (fn.indexOf("GFP_BACKUP") >= 0 || txt.indexOf("BACKUP DE SEGURANÇA") >= 0) {
    return {
      keep: true,
      level: lvl === "ERRO" ? "ERRO" : "OK",
      area: "Backup",
      message: GFP_LOG_HUMANO_CLEAN_TEXT_16_1_4_(raw)
    };
  }

  // ---------------------------------------------------------------------------
  // IMPORTAÇÃO
  // ---------------------------------------------------------------------------

  if (txt.indexOf("IMPORTAÇÃO INICIADA") >= 0 || txt.indexOf("PIPELINE INICIADO") >= 0 || txt.indexOf("NOVA EXECUÇÃO DO PIPELINE") >= 0) {
    return {
      keep: true,
      level: "INFO",
      area: "Importação",
      message: "Importação iniciada."
    };
  }

  if (txt.indexOf("[SUCCESS] IMPORTADO") >= 0 || txt.indexOf("IMPORTADO '") >= 0) {
    const file = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /Importado\s+'([^']+)'/i);
    const qtd = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /-\s*(\d+)\s+lançamentos?/i);

    return {
      keep: true,
      level: "OK",
      area: "Importação",
      message: "Arquivo lido" + (file ? ": " + file : "") + (qtd ? " — " + qtd + " lançamentos encontrados." : ".")
    };
  }

  if (txt.indexOf("FILTRAGEM CONCLUÍDA") >= 0) {
    const novos = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /Novos:\s*(\d+)/i) || "0";
    const barrados = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /Barrados:\s*(\d+)/i) || "0";
    const erros = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /Erros:\s*(\d+)/i) || "0";

    let msg = "Importação conferida: ";

    if (Number(novos) > 0) {
      msg += novos + " lançamento(s) novo(s)";
    } else {
      msg += "nenhum lançamento novo";
    }

    if (Number(barrados) > 0) {
      msg += "; " + barrados + " já estavam cadastrados";
    }

    if (Number(erros) > 0) {
      msg += "; " + erros + " erro(s)";
    }

    msg += ".";

    return {
      keep: true,
      level: Number(erros) > 0 ? "WARN" : "OK",
      area: "Importação",
      message: msg
    };
  }

  if (txt.indexOf("TODOS OS ITENS ERAM DUPLICATAS") >= 0) {
    return {
      keep: true,
      level: "OK",
      area: "Importação",
      message: "Importação concluída: todos os lançamentos do arquivo já estavam cadastrados."
    };
  }

  if (txt.indexOf("PROCESSAMENTO FINALIZADO") >= 0 && txt.indexOf("LINHAS EXTRAÍDAS") >= 0) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // PAINEL DE REVISÃO / APRENDIZADO
  // ---------------------------------------------------------------------------

  if (fn.indexOf("APIREVIEWPANELV2COMMITSESSION") >= 0 || txt.indexOf("APIREVIEWPANELV2COMMITSESSION") >= 0) {
    const archived = raw.indexOf('"autoArchiveMoved":1') >= 0 || raw.indexOf('"archived":1') >= 0;

    return {
      keep: true,
      level: "OK",
      area: "Painel de Revisão",
      message: archived
        ? "Alteração salva no Painel de Revisão e lançamento enviado ao histórico."
        : "Alteração salva no Painel de Revisão."
    };
  }

  if (fn.indexOf("GFP_PANEL_V2_PROCESSAR") >= 0) {
    return {
      keep: true,
      level: "OK",
      area: "Painel de Revisão",
      message: "Painel de Revisão: alteração processada com sucesso."
    };
  }

  if (fn.indexOf("GFP_MODELO_FEEDBACK_PROCESSAR") >= 0 || txt.indexOf("GFP_MODELO_FEEDBACK_PROCESSAR") >= 0) {
    if (txt.indexOf("ERRO+CORRECAO") >= 0) {
      return {
        keep: true,
        level: "OK",
        area: "Aprendizado",
        message: "Correção de categoria registrada para melhorar as próximas sugestões."
      };
    }

    if (txt.indexOf("ACERTO") >= 0) {
      return {
        keep: true,
        level: "OK",
        area: "Aprendizado",
        message: "Confirmação de categoria registrada para melhorar as próximas sugestões."
      };
    }

    return null;
  }

  if (fn.indexOf("GFP_RECALIBRAR") >= 0 || txt.indexOf("GFP_RECALIBRAR") >= 0) {
    const mudancas = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /mudanças\s*=\s*(\d+)/i) ||
      GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /"changes"\s*:\s*(\d+)/i);

    if (mudancas && Number(mudancas) > 0) {
      return {
        keep: true,
        level: "OK",
        area: "Aprendizado",
        message: "Aprendizado automático atualizado: " + mudancas + " sugestão(ões) melhorada(s)."
      };
    }

    return null;
  }

  if (fn.indexOf("GFP_ON_EDIT_APROVAR") >= 0 || txt.indexOf("GFP_ON_EDIT_APROVAR") >= 0) {
    return {
      keep: true,
      level: "OK",
      area: "Aprendizado",
      message: "Categoria aprovada na planilha e usada para melhorar futuras sugestões."
    };
  }

  // ---------------------------------------------------------------------------
  // HISTÓRICO / ARQUIVAMENTO
  // ---------------------------------------------------------------------------

  if (txt.indexOf("ARQUIVAMENTO CONCLUÍDO") >= 0 || txt.indexOf("DESARQUIVAMENTO CONCLUÍDO") >= 0) {
    return {
      keep: true,
      level: lvl === "WARN" || lvl === "ERRO" ? lvl : "OK",
      area: "Histórico",
      message: GFP_LOG_HUMANO_RESUMIR_HISTORICO_16_1_4_(raw)
    };
  }

  if (txt.indexOf("LOG_ARQUIVAMENTO REMOVID") >= 0) {
    return {
      keep: true,
      level: "OK",
      area: "Sistema",
      message: "Aba técnica de arquivamento removida. Os próximos registros irão apenas para o SYS_LOGS."
    };
  }

  // ---------------------------------------------------------------------------
  // FATURA
  // ---------------------------------------------------------------------------

  if (txt.indexOf("RUNINVOICESUMMARYCHECK") >= 0 || txt.indexOf("INTERFACE DE CONFERÊNCIA") >= 0) {
    return {
      keep: true,
      level: "INFO",
      area: "Faturas",
      message: "Conferência de fatura aberta."
    };
  }

  // ---------------------------------------------------------------------------
  // VOZ / TEXTO / IMAGEM
  // ---------------------------------------------------------------------------

  if (txt.indexOf("PROCESSANDO INPUT") >= 0) {
    const quoted = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /"([^"]+)"/);
    return {
      keep: true,
      level: "INFO",
      area: "Entrada manual",
      message: quoted ? "Texto recebido: \"" + quoted + "\"" : "Texto recebido para processamento."
    };
  }

  if (txt.indexOf("TRANSCRIÇÃO CONCLUÍDA") >= 0) {
    const quoted = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /Transcrição concluída:\s*"([^"]+)"/i);
    return {
      keep: true,
      level: "OK",
      area: "Voz",
      message: quoted ? "Áudio transcrito: \"" + quoted + "\"" : "Áudio transcrito com sucesso."
    };
  }

  if (txt.indexOf("INICIANDO PIPELINE DE TRANSCRIÇÃO") >= 0) {
    return {
      keep: true,
      level: "INFO",
      area: "Voz",
      message: "Áudio recebido para transcrição."
    };
  }

  if (txt.indexOf("FALHA NO PROCESSAMENTO DE ÁUDIO") >= 0 || txt.indexOf("ERRO DE CONEXÃO NA TRANSCRIÇÃO") >= 0) {
    return {
      keep: true,
      level: "WARN",
      area: "Voz",
      message: "Não foi possível transcrever o áudio. Tente novamente em instantes."
    };
  }

  if (txt.indexOf("FOTO PROCESSADA") >= 0 || txt.indexOf("IMAGEM PROCESSADA") >= 0) {
    return {
      keep: true,
      level: "OK",
      area: "Imagem",
      message: "Imagem processada e registrada na memória."
    };
  }

  if (txt.indexOf("ERRO API VISION") >= 0 || txt.indexOf("NENHUM MODELO FUNCIONOU") >= 0) {
    return {
      keep: true,
      level: "WARN",
      area: "Imagem",
      message: "Não foi possível processar a imagem. Tente novamente em instantes."
    };
  }

  // ---------------------------------------------------------------------------
  // ERROS GERAIS
  // ---------------------------------------------------------------------------

  if (lvl === "ERRO" || lvl === "WARN") {
    return {
      keep: true,
      level: lvl,
      area: GFP_LOG_HUMANO_AREA_16_1_4_(func, raw),
      message: GFP_LOG_HUMANO_CLEAN_TEXT_16_1_4_(raw || (errorObject && errorObject.message) || "O sistema registrou um aviso.")
    };
  }

  // ---------------------------------------------------------------------------
  // FALLBACK: se for muito técnico, não mostra. Se for legível, mantém limpo.
  // ---------------------------------------------------------------------------

  if (GFP_LOG_HUMANO_IS_TECNICO_DEMAIS_16_1_4_(raw, func)) {
    return null;
  }

  return {
    keep: true,
    level: lvl,
    area: GFP_LOG_HUMANO_AREA_16_1_4_(func, raw),
    message: GFP_LOG_HUMANO_CLEAN_TEXT_16_1_4_(raw)
  };
}

function GFP_LOG_HUMANO_RESUMIR_HISTORICO_16_1_4_(raw) {
  const up = raw.toUpperCase();

  const movidos = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /movidos:\s*(\d+)/i) || "0";
  const verificados = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /verificados:\s*(\d+)/i) || "0";
  const ignorados = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /ignorados:\s*(\d+)/i) || "0";
  const origem = GFP_LOG_HUMANO_MATCH_16_1_4_(raw, /origem:\s*([^|]+)/i) || "";

  let origemHumana = "sistema";

  if (origem.indexOf("PAINEL_REVISAO") >= 0) origemHumana = "Painel de Revisão";
  else if (origem.indexOf("MENU_ARQUIVAR") >= 0) origemHumana = "comando Arquivar Linhas OK";
  else if (origem.indexOf("VALIDACAO_CHECKBOX") >= 0) origemHumana = "validação da planilha";
  else if (origem.indexOf("UI_DESARQUIVAR") >= 0) origemHumana = "Histórico Arquivado";

  if (up.indexOf("DESARQUIVAMENTO") >= 0) {
    return "Histórico: lançamento restaurado para a lista principal.";
  }

  if (Number(movidos) > 0) {
    let msg = "Histórico: " + movidos + " lançamento(s) arquivado(s) pelo " + origemHumana + ".";

    if (Number(ignorados) > 0 && Number(verificados) > Number(movidos)) {
      msg += " " + ignorados + " permaneceram na lista de revisão.";
    }

    return msg;
  }

  return "Histórico: nenhum lançamento novo foi arquivado.";
}


// =============================================================================
// ESCRITA NO SYS_LOGS
// =============================================================================

function GFP_LOG_HUMANO_APPEND_16_1_4_(level, area, message, stack) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(LOG_SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET_NAME);
  }

  GFP_LOG_HUMANO_ENSURE_HEADER_16_1_4_(sh);

  sh.insertRowBefore(2);

  sh.getRange(2, 1, 1, 5).setValues([[
    GFP_LOG_HUMANO_FORMAT_DATE_16_1_4_(new Date()),
    GFP_LOG_HUMANO_NORMALIZE_LEVEL_16_1_4_(level),
    GFP_LOG_HUMANO_ONE_LINE_16_1_4_(area || "Sistema"),
    GFP_LOG_HUMANO_TRUNC_16_1_4_(GFP_LOG_HUMANO_CLEAN_TEXT_16_1_4_(message || ""), 1000),
    GFP_LOG_HUMANO_TRUNC_16_1_4_(GFP_LOG_HUMANO_CLEAN_TEXT_16_1_4_(stack || ""), 500)
  ]]);

  GFP_LOG_HUMANO_FORMAT_SHEET_16_1_4_(sh);
}

function GFP_LOG_HUMANO_ENSURE_HEADER_16_1_4_(sh) {
  sh.getRange(1, 1, 1, 5).setValues([[
    "Quando",
    "Tipo",
    "Área",
    "O que aconteceu",
    "Observação"
  ]]);
}

function GFP_LOG_HUMANO_FORMAT_SHEET_16_1_4_(sh) {
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
  try { sh.getRange(1, 1, lastRow, 5).setWrap(false); } catch (e2) {}

  try {
    if (lastRow >= 2) {
      sh.setRowHeights(2, lastRow - 1, 21);
    }
  } catch (e3) {}

  try { sh.setColumnWidth(1, 145); } catch (e4) {}
  try { sh.setColumnWidth(2, 70); } catch (e5) {}
  try { sh.setColumnWidth(3, 180); } catch (e6) {}
  try { sh.setColumnWidth(4, 760); } catch (e7) {}
  try { sh.setColumnWidth(5, 220); } catch (e8) {}
}


// =============================================================================
// HUMANIZAR LOGS EXISTENTES
// =============================================================================

/**
 * Execute uma vez depois de aplicar este hotfix:
 *
 *   GFP_SYS_LOGS_HUMANIZAR_EXISTENTE_16_1_4()
 */
function GFP_SYS_LOGS_HUMANIZAR_EXISTENTE_16_1_4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(LOG_SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET_NAME);
    GFP_LOG_HUMANO_ENSURE_HEADER_16_1_4_(sh);
    return { ok: true, kept: 0, removed: 0 };
  }

  const lastRow = sh.getLastRow();
  const lastCol = Math.max(5, sh.getLastColumn());

  if (lastRow < 2) {
    GFP_LOG_HUMANO_ENSURE_HEADER_16_1_4_(sh);
    GFP_LOG_HUMANO_FORMAT_SHEET_16_1_4_(sh);
    return { ok: true, kept: 0, removed: 0 };
  }

  const values = sh.getRange(2, 1, lastRow - 1, Math.min(lastCol, 5)).getValues();

  const output = [];
  let removed = 0;

  values.forEach(function(row) {
    const timestamp = row[0];
    const level = row[1] || "INFO";
    const func = row[2] || "";
    const msg = row[3] || "";
    const stack = row[4] || "";

    const item = GFP_LOG_HUMANO_CLASSIFICAR_16_1_4_(msg || stack, func, level, null);

    if (!item || item.keep === false) {
      removed++;
      return;
    }

    output.push([
      timestamp || new Date(),
      item.level || GFP_LOG_HUMANO_NORMALIZE_LEVEL_16_1_4_(level),
      item.area || GFP_LOG_HUMANO_AREA_16_1_4_(func, msg),
      GFP_LOG_HUMANO_TRUNC_16_1_4_(GFP_LOG_HUMANO_CLEAN_TEXT_16_1_4_(item.message || msg), 1000),
      GFP_LOG_HUMANO_TRUNC_16_1_4_(GFP_LOG_HUMANO_CLEAN_TEXT_16_1_4_(item.stack || ""), 500)
    ]);
  });

  output.sort(function(a, b) {
    return GFP_LOG_HUMANO_DATE_VALUE_16_1_4_(b[0]) - GFP_LOG_HUMANO_DATE_VALUE_16_1_4_(a[0]);
  });

  sh.clearContents();

  GFP_LOG_HUMANO_ENSURE_HEADER_16_1_4_(sh);

  if (output.length) {
    sh.getRange(2, 1, output.length, 5).setValues(output);
  }

  GFP_LOG_HUMANO_FORMAT_SHEET_16_1_4_(sh);

  SpreadsheetApp.getActive().toast(
    "SYS_LOGS humanizado: " + output.length + " linhas mantidas; " + removed + " ruídos removidos.",
    "GFP 16.1.4"
  );

  return {
    ok: true,
    kept: output.length,
    removed: removed
  };
}


// =============================================================================
// HELPERS
// =============================================================================

function GFP_LOG_HUMANO_EXTRACT_BRACKET_FUNC_16_1_4_(text) {
  const m = String(text || "").match(/^\[([^\]]+)\]/);
  return m ? m[1] : "";
}

function GFP_LOG_HUMANO_MATCH_16_1_4_(text, regex) {
  const m = String(text || "").match(regex);
  return m ? m[1] : "";
}

function GFP_LOG_HUMANO_IS_TECNICO_DEMAIS_16_1_4_(raw, func) {
  raw = String(raw || "");
  func = String(func || "");

  if (raw.indexOf("{") >= 0 && raw.indexOf("}") >= 0) return true;
  if (raw.indexOf("scanned=") >= 0) return true;
  if (raw.indexOf("applied=") >= 0) return true;
  if (raw.indexOf("skipped=") >= 0) return true;
  if (raw.indexOf("dryRun") >= 0) return true;
  if (raw.indexOf("patch") >= 0 && raw.indexOf("{") >= 0) return true;
  if (/^GFP_[A-Z0-9_]+/.test(func)) return true;
  if (func.indexOf("_14_") >= 0 || func.indexOf("_15_") >= 0 || func.indexOf("_16_") >= 0) return true;

  return false;
}

function GFP_LOG_HUMANO_AREA_16_1_4_(func, raw) {
  const text = (String(func || "") + " " + String(raw || "")).toUpperCase();

  if (text.indexOf("IMPORT") >= 0 || text.indexOf("PIPELINE") >= 0 || text.indexOf("ANTIDUP") >= 0 || text.indexOf("DUPLICATA") >= 0) return "Importação";
  if (text.indexOf("BACKUP") >= 0) return "Backup";
  if (text.indexOf("REVIEW") >= 0 || text.indexOf("PAINEL") >= 0) return "Painel de Revisão";
  if (text.indexOf("DASHBOARD") >= 0) return "Dashboard";
  if (text.indexOf("DATALAKE") >= 0 || text.indexOf("ARQUIV") >= 0 || text.indexOf("HIST") >= 0) return "Histórico";
  if (text.indexOf("VOICE") >= 0 || text.indexOf("AUDIO") >= 0 || text.indexOf("TRANSCRI") >= 0) return "Voz";
  if (text.indexOf("VISION") >= 0 || text.indexOf("IMAGEM") >= 0 || text.indexOf("FOTO") >= 0) return "Imagem";
  if (text.indexOf("FATURA") >= 0 || text.indexOf("INVOICE") >= 0) return "Faturas";
  if (text.indexOf("MODELO") >= 0 || text.indexOf("RECALIBR") >= 0 || text.indexOf("GEMINI") >= 0) return "Aprendizado";

  return "Sistema";
}

function GFP_LOG_HUMANO_CLEAN_TEXT_16_1_4_(text) {
  text = GFP_LOG_HUMANO_ONE_LINE_16_1_4_(text);

  text = text.replace(/^\[[^\]]+\]\s*/g, "");
  text = text.replace(/\s*\|\s*payload=.*$/i, "");
  text = text.replace(/\s*\|\s*\{.*$/i, "");

  text = text.replace(/\bscanned\b/gi, "verificados");
  text = text.replace(/\bapplied\b/gi, "aplicados");
  text = text.replace(/\bskipped\b/gi, "ignorados");
  text = text.replace(/\bthrottle\b/gi, "intervalo de segurança");
  text = text.replace(/\bdryRun\b/gi, "simulação");
  text = text.replace(/\bcommit\b/gi, "salvamento");
  text = text.replace(/\bpipeline\b/gi, "importação");
  text = text.replace(/\bSUCCESS\b/g, "OK");
  text = text.replace(/\bERROR\b/g, "ERRO");
  text = text.replace(/\bWARNING\b/g, "AVISO");

  return text.trim();
}

function GFP_LOG_HUMANO_ONE_LINE_16_1_4_(value) {
  return String(value || "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function GFP_LOG_HUMANO_TRUNC_16_1_4_(value, max) {
  const text = GFP_LOG_HUMANO_ONE_LINE_16_1_4_(value);
  if (text.length <= max) return text;
  return text.substring(0, max) + " ...[cortado]";
}

function GFP_LOG_HUMANO_NORMALIZE_LEVEL_16_1_4_(level) {
  const s = String(level || "INFO").toUpperCase();

  if (s === "ERROR" || s === "CRITICAL" || s === "ERRO") return "ERRO";
  if (s === "WARNING" || s === "WARN" || s === "AVISO") return "WARN";
  if (s === "OK" || s === "SUCCESS") return "OK";

  return "INFO";
}

function GFP_LOG_HUMANO_FORMAT_DATE_16_1_4_(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() || "America/Sao_Paulo",
    "dd/MM/yyyy HH:mm:ss"
  );
}

function GFP_LOG_HUMANO_DATE_VALUE_16_1_4_(value) {
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
