/**
 * 📂 ARQUIVO: 5_UTILS/painel_auditorias_16_1_17.gs
 * 🔎 MÓDULO: PAINEL DE AUDITORIAS LEVE
 * 🔢 VERSÃO: 16.1.17
 *
 * Leitura pura. Não altera dados.
 */

const GFP_PAINEL_AUDITORIAS_PATCH_16_1_17 = "16.1.17";


function GFP_PAINEL_AUDITORIAS_OPEN_16_1_17() {
  const html = GFP_PAINEL_AUDITORIAS_HTML_16_1_17_();

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1280).setHeight(780),
    "GFP — Painel de Auditorias"
  );
}


function GFP_PAINEL_AUDITORIAS_ANALISAR_16_1_17() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const out = {
    ok: true,
    patch: GFP_PAINEL_AUDITORIAS_PATCH_16_1_17,
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
    sheets: {},
    cards: [],
    details: {},
    recommendedNext: []
  };

  const db = ss.getSheetByName("DB_TRANSACOES");
  const hist = ss.getSheetByName("DB_TRANSACOES_HIST");

  out.sheets.DB_TRANSACOES = GFP_PAINEL_AUDITORIAS_RESUMIR_SHEET_16_1_17_(db, "DB_TRANSACOES");
  out.sheets.DB_TRANSACOES_HIST = GFP_PAINEL_AUDITORIAS_RESUMIR_SHEET_16_1_17_(hist, "DB_TRANSACOES_HIST");

  out.details.categoriasInvalidas = GFP_PAINEL_AUDITORIAS_CATEGORIAS_INVALIDAS_16_1_17_(ss);
  out.details.alinhamentoAS = GFP_PAINEL_AUDITORIAS_ALINHAMENTO_AS_16_1_17_();
  out.details.duplicidades = GFP_PAINEL_AUDITORIAS_DUPLICIDADES_16_1_17_(ss);
  out.details.coerenciaStatus = GFP_PAINEL_AUDITORIAS_STATUS_16_1_17_(ss);
  out.details.neutras99 = GFP_PAINEL_AUDITORIAS_NEUTRAS_99_16_1_17_(ss);
  out.details.arquivosImportacao = GFP_PAINEL_AUDITORIAS_ARQUIVOS_IMPORTACAO_16_1_17_();

  GFP_PAINEL_AUDITORIAS_BUILD_CARDS_16_1_17_(out);

  out.ok = out.cards.every(function(c) {
    return c.level !== "RED";
  });

  out.recommendedNext = GFP_PAINEL_AUDITORIAS_RECOMENDAR_16_1_17_(out);

  return out;
}


function GFP_PAINEL_AUDITORIAS_RESUMIR_SHEET_16_1_17_(sh, name) {
  if (!sh) {
    return {
      exists: false,
      name: name,
      rows: 0,
      cols: 0,
      dataRows: 0,
      lastRow: 0,
      lastCol: 0
    };
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const dataRows = Math.max(0, lastRow - 1);

  return {
    exists: true,
    name: name,
    rows: sh.getMaxRows(),
    cols: sh.getMaxColumns(),
    dataRows: dataRows,
    lastRow: lastRow,
    lastCol: lastCol
  };
}


function GFP_PAINEL_AUDITORIAS_CATEGORIAS_INVALIDAS_16_1_17_(ss) {
  const valid = GFP_PAINEL_AUDITORIAS_CATEGORIAS_SET_16_1_17_(ss);
  const result = {
    total: 0,
    bySheet: {},
    examples: []
  };

  ["DB_TRANSACOES", "DB_TRANSACOES_HIST"].forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);

    if (!sh || sh.getLastRow() < 2) {
      result.bySheet[sheetName] = 0;
      return;
    }

    const values = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues();
    let count = 0;

    values.forEach(function(r, idx) {
      const cat = String(r[0] || "").trim();

      if (!cat) return;
      if (valid[cat]) return;

      count++;
      result.total++;

      if (result.examples.length < 20) {
        result.examples.push({
          sheet: sheetName,
          row: idx + 2,
          category: cat
        });
      }
    });

    result.bySheet[sheetName] = count;
  });

  return result;
}


function GFP_PAINEL_AUDITORIAS_CATEGORIAS_SET_16_1_17_(ss) {
  const sh = ss.getSheetByName("CFG_Categorias");
  const set = {};

  if (!sh || sh.getLastRow() < 2) return set;

  sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues().forEach(function(r) {
    const cat = String(r[0] || "").trim();
    if (cat) set[cat] = true;
  });

  return set;
}


function GFP_PAINEL_AUDITORIAS_ALINHAMENTO_AS_16_1_17_() {
  const fn = GFP_PAINEL_AUDITORIAS_GET_FN_16_1_17_("GFP_AUDITAR_ALINHAMENTO_METADADOS_DB_16_1_12");

  if (!fn) {
    return {
      available: false,
      total: null,
      scanned: null,
      examples: [],
      message: "Função de auditoria A:S não encontrada."
    };
  }

  try {
    const res = fn();

    return {
      available: true,
      total: res && Array.isArray(res.alerts) ? res.alerts.length : 0,
      scanned: res && res.scanned || 0,
      examples: res && Array.isArray(res.alerts) ? res.alerts.slice(0, 20) : [],
      message: "Auditoria A:S executada."
    };
  } catch (e) {
    return {
      available: true,
      total: null,
      scanned: null,
      examples: [],
      error: e.message
    };
  }
}


function GFP_PAINEL_AUDITORIAS_DUPLICIDADES_16_1_17_(ss) {
  const result = {
    duplicateIdsInDb: 0,
    duplicateHashesInDb: 0,
    duplicateIdsInHist: 0,
    duplicateHashesInHist: 0,
    overlapIdDbHist: 0,
    overlapHashDbHist: 0,
    examples: []
  };

  const dbIndex = GFP_PAINEL_AUDITORIAS_INDEX_IDS_16_1_17_(ss.getSheetByName("DB_TRANSACOES"), "DB_TRANSACOES");
  const histIndex = GFP_PAINEL_AUDITORIAS_INDEX_IDS_16_1_17_(ss.getSheetByName("DB_TRANSACOES_HIST"), "DB_TRANSACOES_HIST");

  result.duplicateIdsInDb = dbIndex.duplicateIds;
  result.duplicateHashesInDb = dbIndex.duplicateHashes;
  result.duplicateIdsInHist = histIndex.duplicateIds;
  result.duplicateHashesInHist = histIndex.duplicateHashes;

  Object.keys(dbIndex.ids).forEach(function(id) {
    if (histIndex.ids[id]) {
      result.overlapIdDbHist++;
      if (result.examples.length < 20) {
        result.examples.push({
          type: "ID_EM_DB_E_HIST",
          id: id,
          dbRows: dbIndex.ids[id].rows,
          histRows: histIndex.ids[id].rows
        });
      }
    }
  });

  Object.keys(dbIndex.hashes).forEach(function(hash) {
    if (histIndex.hashes[hash]) {
      result.overlapHashDbHist++;
      if (result.examples.length < 20) {
        result.examples.push({
          type: "HASH_EM_DB_E_HIST",
          hash: hash,
          dbRows: dbIndex.hashes[hash].rows,
          histRows: histIndex.hashes[hash].rows
        });
      }
    }
  });

  return result;
}


function GFP_PAINEL_AUDITORIAS_INDEX_IDS_16_1_17_(sh, sheetName) {
  const out = {
    ids: {},
    hashes: {},
    duplicateIds: 0,
    duplicateHashes: 0
  };

  if (!sh || sh.getLastRow() < 2) return out;

  const lastRow = sh.getLastRow();
  const values = sh.getRange(2, 1, lastRow - 1, Math.min(Math.max(sh.getLastColumn(), 13), 20)).getValues();

  values.forEach(function(row, idx) {
    const rowNumber = idx + 2;
    const id = String(row[10] || "").trim();
    const hash = String(row[12] || "").trim();

    if (id) {
      if (!out.ids[id]) out.ids[id] = { count: 0, rows: [] };
      out.ids[id].count++;
      if (out.ids[id].rows.length < 8) out.ids[id].rows.push(sheetName + "!" + rowNumber);
    }

    if (hash) {
      if (!out.hashes[hash]) out.hashes[hash] = { count: 0, rows: [] };
      out.hashes[hash].count++;
      if (out.hashes[hash].rows.length < 8) out.hashes[hash].rows.push(sheetName + "!" + rowNumber);
    }
  });

  Object.keys(out.ids).forEach(function(id) {
    if (out.ids[id].count > 1) out.duplicateIds++;
  });

  Object.keys(out.hashes).forEach(function(hash) {
    if (out.hashes[hash].count > 1) out.duplicateHashes++;
  });

  return out;
}


function GFP_PAINEL_AUDITORIAS_STATUS_16_1_17_(ss) {
  const sh = ss.getSheetByName("DB_TRANSACOES");
  const out = {
    okWithoutCategory: 0,
    categorizedPending: 0,
    blankCategory: 0,
    statusOk: 0,
    examples: []
  };

  if (!sh || sh.getLastRow() < 2) return out;

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(Math.max(sh.getLastColumn(), 9), 19)).getValues();

  values.forEach(function(row, idx) {
    const sheetRow = idx + 2;
    const cat = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();

    if (!cat) out.blankCategory++;
    if (status === "OK") out.statusOk++;

    if (status === "OK" && !cat) {
      out.okWithoutCategory++;
      if (out.examples.length < 20) {
        out.examples.push({
          type: "OK_SEM_CATEGORIA",
          row: sheetRow,
          description: row[1] || "",
          value: row[2] || ""
        });
      }
    }

    if (cat && status !== "OK") {
      out.categorizedPending++;
    }
  });

  return out;
}


function GFP_PAINEL_AUDITORIAS_NEUTRAS_99_16_1_17_(ss) {
  const out = {
    countDb: 0,
    amountDb: 0,
    countHist: 0,
    amountHist: 0,
    byCategory: {}
  };

  ["DB_TRANSACOES", "DB_TRANSACOES_HIST"].forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);

    if (!sh || sh.getLastRow() < 2) return;

    const values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(Math.max(sh.getLastColumn(), 6), 20)).getValues();

    values.forEach(function(row) {
      const amount = Number(row[2] || 0);
      const cat = String(row[5] || "").trim();

      if (!cat || !cat.match(/^99\./)) return;

      if (!out.byCategory[cat]) {
        out.byCategory[cat] = {
          count: 0,
          amount: 0
        };
      }

      out.byCategory[cat].count++;
      out.byCategory[cat].amount += amount;

      if (sheetName === "DB_TRANSACOES") {
        out.countDb++;
        out.amountDb += amount;
      } else {
        out.countHist++;
        out.amountHist += amount;
      }
    });
  });

  out.amountDb = Math.round(out.amountDb * 100) / 100;
  out.amountHist = Math.round(out.amountHist * 100) / 100;

  Object.keys(out.byCategory).forEach(function(cat) {
    out.byCategory[cat].amount = Math.round(out.byCategory[cat].amount * 100) / 100;
  });

  return out;
}


function GFP_PAINEL_AUDITORIAS_ARQUIVOS_IMPORTACAO_16_1_17_() {
  const fn = GFP_PAINEL_AUDITORIAS_GET_FN_16_1_17_("GFP_ARQUIVOS_IMPORTADOS_ANALISAR_16_1_16");

  if (!fn) {
    return {
      available: false,
      summary: null,
      message: "Módulo 16.1.16 de arquivos importados não encontrado."
    };
  }

  try {
    const res = fn();

    return {
      available: true,
      summary: res && res.summary || null,
      importFolder: res && res.importFolder || null,
      message: "Análise da pasta de importação concluída."
    };
  } catch (e) {
    return {
      available: true,
      summary: null,
      error: e.message
    };
  }
}


function GFP_PAINEL_AUDITORIAS_BUILD_CARDS_16_1_17_(out) {
  const db = out.sheets.DB_TRANSACOES || {};
  const hist = out.sheets.DB_TRANSACOES_HIST || {};
  const cat = out.details.categoriasInvalidas || {};
  const as = out.details.alinhamentoAS || {};
  const dup = out.details.duplicidades || {};
  const status = out.details.coerenciaStatus || {};
  const neutras = out.details.neutras99 || {};
  const files = out.details.arquivosImportacao || {};

  out.cards = [
    {
      id: "db",
      title: "Mesa de trabalho",
      level: db.exists ? "GREEN" : "RED",
      value: db.exists ? db.dataRows : "não encontrada",
      subtitle: "linhas em DB_TRANSACOES"
    },
    {
      id: "hist",
      title: "Histórico",
      level: hist.exists ? "GREEN" : "YELLOW",
      value: hist.exists ? hist.dataRows : "não encontrado",
      subtitle: "linhas em DB_TRANSACOES_HIST"
    },
    {
      id: "categorias",
      title: "Categorias inválidas",
      level: cat.total === 0 ? "GREEN" : "RED",
      value: cat.total || 0,
      subtitle: "categoria fora da CFG_Categorias"
    },
    {
      id: "as",
      title: "A:S / Metadados",
      level: as.total === 0 ? "GREEN" : (as.total == null ? "YELLOW" : "RED"),
      value: as.total == null ? "n/d" : as.total,
      subtitle: "possíveis desalinhamentos"
    },
    {
      id: "duplicidades",
      title: "Duplicidades críticas",
      level: (dup.duplicateIdsInDb + dup.duplicateHashesInDb + dup.overlapIdDbHist + dup.overlapHashDbHist) === 0 ? "GREEN" : "RED",
      value: (dup.duplicateIdsInDb + dup.duplicateHashesInDb + dup.overlapIdDbHist + dup.overlapHashDbHist),
      subtitle: "IDs/HASH duplicados ou em DB + HIST"
    },
    {
      id: "pendencias",
      title: "Categorizadas pendentes",
      level: status.categorizedPending > 0 ? "YELLOW" : "GREEN",
      value: status.categorizedPending || 0,
      subtitle: "com categoria, mas ainda sem OK"
    },
    {
      id: "sem_categoria",
      title: "Sem categoria",
      level: status.blankCategory > 0 ? "YELLOW" : "GREEN",
      value: status.blankCategory || 0,
      subtitle: "linhas na mesa sem categoria"
    },
    {
      id: "ok_sem_categoria",
      title: "OK sem categoria",
      level: status.okWithoutCategory > 0 ? "RED" : "GREEN",
      value: status.okWithoutCategory || 0,
      subtitle: "não deveria acontecer"
    },
    {
      id: "neutras",
      title: "Categorias 99.* na mesa",
      level: "GREEN",
      value: neutras.countDb || 0,
      subtitle: "saldo: R$ " + GFP_PAINEL_AUDITORIAS_FMT_NUMBER_16_1_17_(neutras.amountDb || 0)
    },
    {
      id: "arquivos",
      title: "Arquivos na pasta",
      level: files.summary && files.summary.canMove > 0 ? "YELLOW" : "GREEN",
      value: files.summary ? files.summary.total : "n/d",
      subtitle: files.summary
        ? files.summary.canMove + " já importado(s) por ID"
        : (files.error || files.message || "módulo indisponível")
    }
  ];
}


function GFP_PAINEL_AUDITORIAS_RECOMENDAR_16_1_17_(out) {
  const rec = [];
  const cat = out.details.categoriasInvalidas || {};
  const as = out.details.alinhamentoAS || {};
  const dup = out.details.duplicidades || {};
  const status = out.details.coerenciaStatus || {};
  const files = out.details.arquivosImportacao || {};

  if (cat.total > 0) rec.push("Corrigir categorias inválidas antes de ordenar, arquivar ou recalibrar.");
  if (as.total > 0) rec.push("Investigar desalinhamentos A:S antes de qualquer movimentação em lote.");
  if ((dup.overlapIdDbHist || 0) + (dup.overlapHashDbHist || 0) > 0) rec.push("Há IDs/HASH presentes na mesa e no histórico; revisar duplicidade antes de arquivar.");
  if (status.okWithoutCategory > 0) rec.push("Há linhas OK sem categoria; revisar manualmente.");
  if (files.summary && files.summary.canMove > 0) rec.push("Há arquivos já importados na pasta principal; pode organizar usando a Central de Ferramentas.");

  if (!rec.length) rec.push("Sistema sem alerta crítico aparente. Pode seguir operação normal com prudência.");

  return rec;
}


function GFP_PAINEL_AUDITORIAS_HTML_16_1_17_() {
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
    '.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}',
    '.btn{border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer;background:#0b2d4d;color:#fff;font-size:12px}',
    '.btn2{background:#e0f2fe;color:#0b2d4d}',
    '.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}',
    '.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px;box-shadow:0 1px 2px rgba(15,23,42,.04)}',
    '.card h3{margin:0 0 8px;font-size:12px;color:#334155}',
    '.value{font-size:22px;font-weight:900;color:#0b2d4d}',
    '.sub{font-size:11px;color:#64748b;margin-top:4px;line-height:1.25}',
    '.GREEN{border-left:6px solid #22c55e}',
    '.YELLOW{border-left:6px solid #f59e0b}',
    '.RED{border-left:6px solid #ef4444}',
    '#result{display:none;margin-bottom:14px;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.4}',
    '#result.ok{display:block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}',
    '#result.warn{display:block;background:#fef2f2;color:#991b1b;border:1px solid #fecaca}',
    '.panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:12px}',
    '.panel h2{font-size:15px;margin:0 0 10px;color:#0b2d4d}',
    '.rec{margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.55}',
    'pre{white-space:pre-wrap;font-size:11px;max-height:260px;overflow:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px}',
    '@media(max-width:1100px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="top">',
    '<h1>🔎 GFP — Painel de Auditorias</h1>',
    '<p>Diagnóstico leve da estrutura do sistema. Não altera dados, não cria abas e não gera relatórios técnicos.</p>',
    '</div>',
    '<div class="wrap">',
    '<div class="toolbar">',
    '<div><strong>Leitura pura.</strong> Use para conferir fragilidades antes de importações, arquivamentos ou manutenção.</div>',
    '<div><button class="btn" onclick="refresh()">Atualizar diagnóstico</button> <button class="btn btn2" onclick="google.script.host.close()">Fechar</button></div>',
    '</div>',
    '<div id="result"></div>',
    '<div id="cards" class="grid"></div>',
    '<div class="panel"><h2>Próximos cuidados sugeridos</h2><ul id="rec" class="rec"></ul></div>',
    '<div class="panel"><h2>Detalhes técnicos resumidos</h2><pre id="details">Clique em “Atualizar diagnóstico”.</pre></div>',
    '</div>',
    '<script>',
    'function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\\x27/g,"&#039;");}',
    'function show(ok,msg){var el=document.getElementById("result");el.className=ok?"ok":"warn";el.innerHTML=msg;}',
    'function card(c){return "<div class=\\"card "+esc(c.level)+"\\"><h3>"+esc(c.title)+"</h3><div class=\\"value\\">"+esc(c.value)+"</div><div class=\\"sub\\">"+esc(c.subtitle)+"</div></div>";}',
    'function render(res){document.getElementById("cards").innerHTML=(res.cards||[]).map(card).join("");document.getElementById("rec").innerHTML=(res.recommendedNext||[]).map(function(x){return "<li>"+esc(x)+"</li>";}).join("");document.getElementById("details").textContent=JSON.stringify({geradoEm:res.generatedAt, sheets:res.sheets, details:res.details}, null, 2);show(res.ok!==false,"Diagnóstico atualizado em "+esc(res.generatedAt)+".");}',
    'function refresh(){show(true,"Executando diagnóstico...");google.script.run.withSuccessHandler(render).withFailureHandler(function(err){show(false,"Erro: "+esc(err&&err.message?err.message:err));}).GFP_PAINEL_AUDITORIAS_ANALISAR_16_1_17();}',
    'refresh();',
    '</script>',
    '</body>',
    '</html>'
  ].join("\n");
}


function GFP_PAINEL_AUDITORIAS_GET_FN_16_1_17_(name) {
  try {
    const root = typeof globalThis !== "undefined" ? globalThis : this;
    return root && typeof root[name] === "function" ? root[name] : null;
  } catch (e) {
    return null;
  }
}


function GFP_PAINEL_AUDITORIAS_FMT_NUMBER_16_1_17_(n) {
  return Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}