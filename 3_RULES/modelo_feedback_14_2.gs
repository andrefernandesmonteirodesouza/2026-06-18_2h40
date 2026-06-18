/**
 * 📂 ARQUIVO: 3_RULES/modelo_feedback_14_2.gs
 * 🧠 MÓDULO: FEEDBACK DE ACERTO/ERRO DO MODELO
 * 🔢 VERSÃO: 14.2.0
 * 📅 DATA: 09/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Registrar aprendizado positivo/negativo quando sugestões automáticas
 * forem aprovadas ou corrigidas pelo usuário.
 *
 * PRINCÍPIO:
 * - A sugestão pode vir de GEMINI_* ou MODELO_*.
 * - O usuário aprova/corrige no painel.
 * - Quando a linha vira OK/CONCILIADO, este módulo lê o METADADOS,
 *   compara categoria sugerida x categoria final e atualiza a
 *   CFG_Modelo_Classificacao.
 * -----------------------------------------------------------------------------
 */

const GFP_FEEDBACK_MODEL_SHEET_14_2 = "CFG_Modelo_Classificacao";
const GFP_FEEDBACK_DB_SHEET_14_2 = "DB_TRANSACOES";
const GFP_FEEDBACK_PATCH_VERSION_14_2 = "14.2.0";

const GFP_FEEDBACK_HEADERS_14_2 = [
  "CHAVE_NORMALIZADA",
  "PADRAO_ORIGINAL",
  "CONTA",
  "TIPO",
  "CATEGORIA_SUGERIDA",
  "CATEGORIAS_NEGADAS",
  "ACERTOS",
  "ERROS",
  "SCORE",
  "FAIXA_CONFIANCA",
  "STATUS_MODELO",
  "ORIGEM_PRINCIPAL",
  "ORIGENS",
  "PRIMEIRO_TREINO",
  "ULTIMO_ACERTO",
  "ULTIMO_ERRO",
  "ULTIMA_ATUALIZACAO",
  "EXEMPLO_DESCRICAO",
  "OBSERVACOES",
  "HASH_MODELO"
];

/**
 * DRY-RUN: processa feedback pendente sem escrever.
 *
 * @param {number=} limit Quantidade máxima de linhas. Padrão: 30.
 */
function GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_DRYRUN_14_2(limit) {
  return GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_14_2_(limit || 30, true);
}

/**
 * APPLY: processa feedback pendente e escreve no modelo.
 *
 * @param {number=} limit Quantidade máxima de linhas. Padrão: 30.
 */
function GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_APPLY_14_2(limit) {
  return GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_14_2_(limit || 30, false);
}

/**
 * Scanner principal.
 *
 * Procura linhas OK/CONCILIADO com metadados de sugestão automática ainda
 * não processados.
 */
function GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_14_2_(limit, dryRun) {
  const fn = "GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_14_2_";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_FEEDBACK_DB_SHEET_14_2);
  if (!db) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const model = ss.getSheetByName(GFP_FEEDBACK_MODEL_SHEET_14_2);
  if (!model) {
    throw new Error("Aba CFG_Modelo_Classificacao não encontrada. Rode antes o instalador da fase 14.0.");
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 200));
  const lastRow = db.getLastRow();

  if (lastRow < 2) {
    return { dryRun: !!dryRun, scanned: 0, candidates: 0, processed: 0 };
  }

  const values = db.getRange(2, 1, lastRow - 1, 14).getValues();
  const candidates = [];

  values.forEach((row, idx) => {
    if (candidates.length >= safeLimit) return;

    const sheetRow = idx + 2;
    const descricao = String(row[1] || "").trim();
    const tipo = String(row[3] || "").trim().toUpperCase();
    const conta = String(row[4] || "").trim();
    const categoriaFinal = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();
    const meta = GFP_FEEDBACK_parseJson_14_2_(row[13]);

    if (!descricao) return;
    if (status !== "OK" && status !== "CONCILIADO") return;
    if (!GFP_FEEDBACK_isCategory_14_2_(categoriaFinal)) return;

    const cp = meta && meta.classificationParams ? meta.classificationParams : null;
    if (!cp) return;

    const source = String(cp.source || "").toUpperCase();
    const suggestedCategory = String(cp.suggestedCategory || "").trim();

    if (!suggestedCategory || !GFP_FEEDBACK_isCategory_14_2_(suggestedCategory)) return;

    // Já processado.
    if (cp.feedbackProcessedAt) return;

    // Só processar sugestões automáticas.
    const autoSource =
      source.indexOf("GEMINI") >= 0 ||
      source.indexOf("MODELO") >= 0 ||
      String(cp.status || "").toUpperCase().indexOf("GEMINI_") === 0 ||
      String(cp.status || "").toUpperCase().indexOf("MODELO_") === 0;

    if (!autoSource) return;

    candidates.push({
      sheetRow: sheetRow,
      descricao: descricao,
      conta: conta || "*",
      tipo: tipo || "*",
      categoriaFinal: categoriaFinal,
      categoriaSugerida: suggestedCategory,
      confidence: Number(cp.confidence || 0),
      faixa: String(cp.faixa || "").trim(),
      source: String(cp.source || "AUTO").trim(),
      statusSugestao: String(cp.status || "").trim(),
      reason: String(cp.reason || "").trim(),
      meta: meta
    });
  });

  Logger.log(`[${fn}] ${dryRun ? "DRY-RUN" : "APPLY"} | candidatos=${candidates.length} | limite=${safeLimit}`);

  const events = [];

  candidates.forEach(item => {
    const same = GFP_FEEDBACK_sameCategory_14_2_(item.categoriaFinal, item.categoriaSugerida);

    if (same) {
      events.push({
        type: "ACERTO",
        sheetRow: item.sheetRow,
        descricao: item.descricao,
        conta: item.conta,
        tipo: item.tipo,
        categoria: item.categoriaFinal,
        categoriaNegada: "",
        origem: "FEEDBACK_ACERTO",
        peso: GFP_FEEDBACK_weightByConfidence_14_2_(item.confidence),
        item: item
      });
    } else {
      // Penaliza sugestão errada.
      events.push({
        type: "ERRO",
        sheetRow: item.sheetRow,
        descricao: item.descricao,
        conta: item.conta,
        tipo: item.tipo,
        categoria: item.categoriaSugerida,
        categoriaNegada: item.categoriaFinal,
        origem: "FEEDBACK_ERRO",
        peso: 1,
        item: item
      });

      // Reforça categoria final correta.
      events.push({
        type: "ACERTO_CORRECAO",
        sheetRow: item.sheetRow,
        descricao: item.descricao,
        conta: item.conta,
        tipo: item.tipo,
        categoria: item.categoriaFinal,
        categoriaNegada: item.categoriaSugerida,
        origem: "FEEDBACK_CORRECAO",
        peso: 3,
        item: item
      });
    }

    Logger.log(
      `[${fn}] ${dryRun ? "[DRY]" : "[APPLY]"} linha=${item.sheetRow} | ` +
      `sugerida='${item.categoriaSugerida}' | final='${item.categoriaFinal}' | ` +
      `resultado=${same ? "ACERTO" : "ERRO+CORRECAO"} | conf=${item.confidence}`
    );
  });


  if (!dryRun && events.length) {
    const modelMap = GFP_FEEDBACK_loadModelMap_14_2_(model);

    events.forEach(ev => {
      GFP_FEEDBACK_applyEventToModelMap_14_2_(modelMap, ev);
    });

    GFP_FEEDBACK_writeModelMap_14_2_(model, modelMap);

    // Marca cada linha DB_TRANSACOES como feedback processado.
    candidates.forEach(item => {
      const metaCell = db.getRange(item.sheetRow, 14);
      const meta = GFP_FEEDBACK_parseJson_14_2_(metaCell.getValue());
      if (!meta.classificationParams) meta.classificationParams = {};

      const same = GFP_FEEDBACK_sameCategory_14_2_(item.categoriaFinal, item.categoriaSugerida);

      meta.classificationParams.feedbackProcessedAt = new Date().toISOString();
      meta.classificationParams.feedbackPatch = GFP_FEEDBACK_PATCH_VERSION_14_2;
      meta.classificationParams.feedbackResult = same ? "ACERTO" : "ERRO_CORRIGIDO";
      meta.classificationParams.feedbackFinalCategory = item.categoriaFinal;
      meta.classificationParams.feedbackSuggestedCategory = item.categoriaSugerida;

      metaCell.setValue(JSON.stringify(meta));
    });

    // GFP 14.4.1 — Recalibração automática pós-feedback.
    try {
      if (typeof GFP_RECALIBRAR_MAYBE_AUTO_POS_FEEDBACK_14_4_1 === "function") {
        GFP_RECALIBRAR_MAYBE_AUTO_POS_FEEDBACK_14_4_1(100, "FEEDBACK_14_2");
      }
    } catch (recalError) {
      Logger.warn("[GFP 14.4.1] Falha ao chamar recalibrador automático pós-feedback: " + recalError.message);
    }
  }

  return {
    dryRun: !!dryRun,
    scanned: values.length,
    candidates: candidates.length,
    events: events.length,
    processed: dryRun ? 0 : candidates.length,
    examples: candidates.slice(0, 30)
  };
}

/**
 * Hook opcional para processar uma única linha logo após apiSaveReview/apiSaveBatch.
 *
 * Pode ser chamado depois que a linha já foi salva como OK.
 */
function GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2(rowNumber) {
  return GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_14_2_(rowNumber, false);
}

/**
 * Dry-run de linha única.
 */
function GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_DRYRUN_14_2(rowNumber) {
  return GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_14_2_(rowNumber, true);
}

function GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_14_2_(rowNumber, dryRun) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_FEEDBACK_DB_SHEET_14_2);
  if (!db) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const row = Number(rowNumber);
  if (!row || row < 2 || row > db.getLastRow()) {
    throw new Error("Número de linha inválido para feedback: " + rowNumber);
  }

  // Implementação simples: processa por scanner com limite amplo, mas apenas
  // se a linha ainda estiver pendente de feedback.
  const all = db.getRange(2, 1, db.getLastRow() - 1, 14).getValues();
  const targetMeta = GFP_FEEDBACK_parseJson_14_2_(all[row - 2][13]);

  if (targetMeta && targetMeta.classificationParams && targetMeta.classificationParams.feedbackProcessedAt) {
    return { dryRun: !!dryRun, row: row, skipped: true, reason: "feedback já processado" };
  }

  // Para preservar simplicidade e segurança, chamamos o scanner.
  // Se houver outras linhas pendentes antes/depois, ele poderá processar também.
  return GFP_MODELO_FEEDBACK_PROCESSAR_OK_PENDENTES_14_2_(200, dryRun);
}

/**
 * Carrega CFG_Modelo_Classificacao em mapa.
 */
function GFP_FEEDBACK_loadModelMap_14_2_(sh) {
  const map = {};

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return map;

  const values = sh.getRange(2, 1, lastRow - 1, GFP_FEEDBACK_HEADERS_14_2.length).getValues();

  values.forEach(row => {
    const obj = GFP_FEEDBACK_rowToModelObj_14_2_(row);
    if (!obj.chave || !obj.categoria) return;

    const key = GFP_FEEDBACK_buildModelKey_14_2_(obj.chave, obj.conta, obj.tipo, obj.categoria);
    map[key] = obj;
  });

  return map;
}

/**
 * Aplica evento ACERTO/ERRO no mapa.
 */
function GFP_FEEDBACK_applyEventToModelMap_14_2_(map, ev) {
  const now = new Date();

  const chave = GFP_FEEDBACK_normalizeKey_14_2_(ev.descricao);
  const conta = ev.conta || "*";
  const tipo = ev.tipo || "*";
  const categoria = ev.categoria;

  const key = GFP_FEEDBACK_buildModelKey_14_2_(chave, conta, tipo, categoria);

  if (!map[key]) {
    map[key] = {
      chave: chave,
      padraoOriginal: ev.descricao,
      conta: conta,
      tipo: tipo,
      categoria: categoria,
      negadas: [],
      acertos: 0,
      erros: 0,
      score: 0,
      faixa: "BAIXA_NAO_PREENCHER",
      statusModelo: "REVISAR",
      origemPrincipal: ev.origem,
      origens: {},
      primeiroTreino: now,
      ultimoAcerto: "",
      ultimoErro: "",
      ultimaAtualizacao: now,
      exemploDescricao: ev.descricao,
      observacoes: "",
      hash: GFP_FEEDBACK_hash_14_2_(key)
    };
  }

  const obj = map[key];

  obj.padraoOriginal = obj.padraoOriginal || ev.descricao;
  obj.exemploDescricao = GFP_FEEDBACK_mergeExamples_14_2_(obj.exemploDescricao, ev.descricao);
  obj.origemPrincipal = obj.origemPrincipal || ev.origem;
  obj.origens[ev.origem] = (obj.origens[ev.origem] || 0) + 1;

  const peso = Math.max(1, Number(ev.peso || 1));

  if (ev.type.indexOf("ACERTO") === 0) {
    obj.acertos = Number(obj.acertos || 0) + peso;
    obj.ultimoAcerto = now;
  } else if (ev.type === "ERRO") {
    obj.erros = Number(obj.erros || 0) + peso;
    obj.ultimoErro = now;
  }

  if (ev.categoriaNegada) {
    GFP_FEEDBACK_addNegada_14_2_(obj, ev.categoriaNegada);
  }

  GFP_FEEDBACK_recalculateObj_14_2_(obj);

  const detalhes =
    `[${GFP_FEEDBACK_PATCH_VERSION_14_2}] ${ev.type} via ${ev.origem}. ` +
    `Linha DB_TRANSACOES=${ev.sheetRow}. Categoria evento='${ev.categoria}'.`;

  obj.observacoes = GFP_FEEDBACK_appendObservation_14_2_(obj.observacoes, detalhes);

  obj.ultimaAtualizacao = now;
}

/**
 * Recalcula score/faixa/status.
 */
function GFP_FEEDBACK_recalculateObj_14_2_(obj) {
  const acertos = Number(obj.acertos || 0);
  const erros = Number(obj.erros || 0);
  const total = acertos + erros;

  obj.score = total > 0 ? Math.round((acertos / total) * 100) : 0;
  obj.faixa = GFP_FEEDBACK_faixaFromScore_14_2_(obj.score, acertos, erros);

  if (obj.faixa === "BLOQUEADA") {
    obj.statusModelo = "BLOQUEADA";
  } else if (obj.faixa === "BAIXA_NAO_PREENCHER") {
    obj.statusModelo = "REVISAR";
  } else {
    obj.statusModelo = "ATIVO";
  }
}

function GFP_FEEDBACK_faixaFromScore_14_2_(score, acertos, erros) {
  const s = Number(score || 0);

  if (acertos === 0 && erros >= 3) return "BLOQUEADA";
  if (s >= 95) return "FORTE";
  if (s >= 80) return "MEDIA";
  if (s >= 60) return "FRACA";
  return "BAIXA_NAO_PREENCHER";
}

/**
 * Escreve mapa na aba, preservando estrutura.
 */
function GFP_FEEDBACK_writeModelMap_14_2_(sh, map) {
  const rows = Object.keys(map).map(key => GFP_FEEDBACK_modelObjToRow_14_2_(map[key]));

  rows.sort((a, b) => {
    const order = { FORTE: 1, MEDIA: 2, FRACA: 3, BAIXA_NAO_PREENCHER: 4, BLOQUEADA: 5 };
    const oa = order[a[9]] || 99;
    const ob = order[b[9]] || 99;
    if (oa !== ob) return oa - ob;
    return Number(b[8] || 0) - Number(a[8] || 0);
  });

  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, GFP_FEEDBACK_HEADERS_14_2.length).clearContent();
  }

  if (rows.length) {
    sh.getRange(2, 1, rows.length, GFP_FEEDBACK_HEADERS_14_2.length).setValues(rows);
  }

  GFP_FEEDBACK_applyModelVisualRules_14_2_(sh);
}

/**
 * Reaplica cores na CFG_Modelo_Classificacao.
 */
function GFP_FEEDBACK_applyModelVisualRules_14_2_(sh) {
  const maxRows = Math.max(sh.getMaxRows() - 1, 1);
  const all = sh.getRange(2, 1, maxRows, GFP_FEEDBACK_HEADERS_14_2.length);

  const rules = [];

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$J2="FORTE"')
      .setBackground("#d9ead3")
      .setFontColor("#14532d")
      .setRanges([all])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$J2="MEDIA"')
      .setBackground("#fff2cc")
      .setFontColor("#7c5e00")
      .setRanges([all])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$J2="FRACA"')
      .setBackground("#fce5cd")
      .setFontColor("#9a3412")
      .setRanges([all])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$J2="BAIXA_NAO_PREENCHER"')
      .setBackground("#f3f4f6")
      .setFontColor("#4b5563")
      .setRanges([all])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$J2="BLOQUEADA"')
      .setBackground("#f4cccc")
      .setFontColor("#991b1b")
      .setRanges([all])
      .build()
  );

  sh.setConditionalFormatRules(rules);
}

/**
 * Transforma linha da aba em objeto.
 */
function GFP_FEEDBACK_rowToModelObj_14_2_(row) {
  return {
    chave: String(row[0] || "").trim(),
    padraoOriginal: String(row[1] || "").trim(),
    conta: String(row[2] || "*").trim() || "*",
    tipo: String(row[3] || "*").trim().toUpperCase() || "*",
    categoria: String(row[4] || "").trim(),
    negadas: GFP_FEEDBACK_parseNegadas_14_2_(row[5]),
    acertos: Number(row[6] || 0),
    erros: Number(row[7] || 0),
    score: Number(row[8] || 0),
    faixa: String(row[9] || "").trim(),
    statusModelo: String(row[10] || "").trim(),
    origemPrincipal: String(row[11] || "").trim(),
    origens: GFP_FEEDBACK_parseOrigens_14_2_(row[12]),
    primeiroTreino: row[13] || "",
    ultimoAcerto: row[14] || "",
    ultimoErro: row[15] || "",
    ultimaAtualizacao: row[16] || "",
    exemploDescricao: String(row[17] || "").trim(),
    observacoes: String(row[18] || "").trim(),
    hash: String(row[19] || "").trim()
  };
}

/**
 * Transforma objeto em linha da aba.
 */
function GFP_FEEDBACK_modelObjToRow_14_2_(obj) {
  return [
    obj.chave,
    obj.padraoOriginal,
    obj.conta,
    obj.tipo,
    obj.categoria,
    obj.negadas && obj.negadas.length ? obj.negadas.join("; ") : "-",
    Number(obj.acertos || 0),
    Number(obj.erros || 0),
    Number(obj.score || 0),
    obj.faixa,
    obj.statusModelo,
    obj.origemPrincipal,
    GFP_FEEDBACK_origensToString_14_2_(obj.origens),
    obj.primeiroTreino || "",
    obj.ultimoAcerto || "",
    obj.ultimoErro || "",
    obj.ultimaAtualizacao || "",
    obj.exemploDescricao || "",
    obj.observacoes || "",
    obj.hash || GFP_FEEDBACK_hash_14_2_(GFP_FEEDBACK_buildModelKey_14_2_(obj.chave, obj.conta, obj.tipo, obj.categoria))
  ];
}

function GFP_FEEDBACK_buildModelKey_14_2_(chave, conta, tipo, categoria) {
  return [
    String(chave || "").trim(),
    String(conta || "*").trim() || "*",
    String(tipo || "*").trim().toUpperCase() || "*",
    String(categoria || "").trim()
  ].join("||");
}

function GFP_FEEDBACK_sameCategory_14_2_(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

function GFP_FEEDBACK_weightByConfidence_14_2_(confidence) {
  const c = Number(confidence || 0);
  if (c >= 95) return 3;
  if (c >= 80) return 2;
  return 1;
}

function GFP_FEEDBACK_addNegada_14_2_(obj, category) {
  const c = String(category || "").trim();
  if (!c) return;

  if (!obj.negadas) obj.negadas = [];
  if (obj.negadas.indexOf(c) < 0) obj.negadas.push(c);
}

function GFP_FEEDBACK_parseNegadas_14_2_(value) {
  const txt = String(value || "").trim();
  if (!txt || txt === "-") return [];

  return txt
    .split(";")
    .map(s => String(s || "").trim())
    .filter(Boolean);
}

function GFP_FEEDBACK_parseOrigens_14_2_(value) {
  const txt = String(value || "").trim();
  const out = {};
  if (!txt) return out;

  txt.split(";").forEach(part => {
    const p = String(part || "").trim();
    if (!p) return;

    const m = p.match(/^(.+?)\s*\((\d+)\)$/);
    if (m) {
      out[m[1].trim()] = Number(m[2]);
    } else {
      out[p] = (out[p] || 0) + 1;
    }
  });

  return out;
}

function GFP_FEEDBACK_origensToString_14_2_(origens) {
  const obj = origens || {};
  return Object.keys(obj)
    .sort((a, b) => Number(obj[b] || 0) - Number(obj[a] || 0))
    .map(k => `${k} (${obj[k]})`)
    .join("; ");
}

function GFP_FEEDBACK_mergeExamples_14_2_(existing, value) {
  const list = String(existing || "")
    .split("|")
    .map(s => String(s || "").trim())
    .filter(Boolean);

  const v = String(value || "").trim();
  if (v && list.indexOf(v) < 0) list.push(v);

  return list.slice(0, 5).join(" | ");
}

function GFP_FEEDBACK_appendObservation_14_2_(existing, text) {
  const old = String(existing || "").trim();
  const add = String(text || "").trim();
  if (!add) return old;

  if (!old) return add;

  const combined = old + "\n" + add;
  return combined.length > 2000 ? combined.slice(combined.length - 2000) : combined;
}

function GFP_FEEDBACK_isCategory_14_2_(value) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(value || "").trim());
}

function GFP_FEEDBACK_parseJson_14_2_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_FEEDBACK_normalizeKey_14_2_(value) {
  let txt = GFP_FEEDBACK_stripAccents_14_2_(String(value || ""))
    .toUpperCase()
    .trim();

  if (!txt) return "";

  txt = txt
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]+\)/g, " ")
    .replace(/\bCOM SALDO\b/g, " ")
    .replace(/\bCOM CARTAO\b/g, " ")
    .replace(/\bCOM CARTÃO\b/g, " ")
    .replace(/\bPIX ENVIADO\s*-\s*/g, "")
    .replace(/\bPIX RECEBIDO\s*-\s*/g, "")
    .replace(/\bCOMPRA REALIZADA\s*-\s*/g, "")
    .replace(/\bCOMPRA REALIZADA\b/g, "")
    .replace(/\bPAGAMENTO REALIZADO\s*-\s*/g, "")
    .replace(/\bPAGAMENTO REALIZADO\b/g, "")
    .replace(/\bRENDIMENTO RECEBIDO\s*-\s*/g, "")
    .replace(/\bPARC\s*\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\bPARCELA\s*\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  txt = txt.replace(/^[\s\-–—:;.]+|[\s\-–—:;.]+$/g, "").trim();

  if (txt.length > 120) txt = txt.slice(0, 120).trim();

  return txt;
}

function GFP_FEEDBACK_stripAccents_14_2_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function GFP_FEEDBACK_hash_14_2_(txt) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    String(txt || ""),
    Utilities.Charset.UTF_8
  );

  return raw.map(b => {
    const v = (b + 256) % 256;
    return v.toString(16).padStart(2, "0");
  }).join("");
}
