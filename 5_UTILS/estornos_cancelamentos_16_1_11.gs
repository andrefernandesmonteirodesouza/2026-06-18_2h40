/**
 * 📂 ARQUIVO: 5_UTILS/estornos_cancelamentos_16_1_11.gs
 * ↩️ MÓDULO: Central de Estornos / Cancelamentos — versão estável segura
 * 🔢 BASE: funcionalidade aproveitada da versão nova, saneada para a versão ouro
 *
 * REGRAS DE SEGURANÇA DESTA VERSÃO:
 * - não cria abas novas;
 * - não cria relatórios técnicos;
 * - não chama Gemini;
 * - não recalibra classificação;
 * - não ordena DB_TRANSACOES;
 * - não chama saneamento visual global;
 * - lê/escreve linhas pela largura total da aba, nunca só A:J;
 * - em cancelamento parcial, cria a linha de parte cancelada no final da aba,
 *   para não deslocar linhas enquanto outras decisões ainda são processadas.
 */

const GFP_ESTORNOS_VERSION_16_1_11 = "16.1.11-ESTAVEL-SEGURO";
const GFP_ESTORNOS_CATEGORIA_PADRAO_16_1_11 = "99.14 — Transitorias — Ajustes de Cartao — Estornos / Cancelamentos";
const GFP_ESTORNOS_DB_16_1_17 = "DB_TRANSACOES";
const GFP_ESTORNOS_HIST_16_1_17 = "DB_TRANSACOES_HIST";
const GFP_ESTORNOS_TOLERANCIA_CENTAVOS_16_1_17 = 5;

/**
 * GFP 16.1.17 — Central de Estornos/Cancelamentos.
 *
 * Abre tela visual para tratar:
 * - pares simples;
 * - cancelamentos parciais;
 * - conjuntos de compensação.
 */
function GFP_ESTORNOS_MARCAR_SELECIONADOS_16_1_11() {
  return GFP_ESTORNOS_ABRIR_CENTRAL_16_1_17();
}

function GFP_ESTORNOS_ABRIR_CENTRAL_16_1_17() {
  const html = HtmlService
    .createHtmlOutput(GFP_ESTORNOS_HTML_16_1_17_())
    .setWidth(1240)
    .setHeight(820)
    .setTitle("GFP — Estornos e Cancelamentos");

  SpreadsheetApp.getUi().showModalDialog(html, "↩️ GFP — Estornos e Cancelamentos");
}

/**
 * Analisa as linhas selecionadas e sugere:
 * - conjuntos;
 * - pares individuais;
 * - cancelamentos parciais.
 */
function GFP_ESTORNOS_ANALISAR_SELECIONADOS_16_1_17() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();

  if (!sh || sh.getName() !== GFP_ESTORNOS_DB_16_1_17) {
    return {
      ok: false,
      message: "Abra a aba DB_TRANSACOES e selecione as linhas que aparecem como estorno/cancelamento no app do cartão.",
      refunds: [],
      groups: []
    };
  }

  const lastRow = sh.getLastRow();

  if (lastRow < 2) {
    return {
      ok: false,
      message: "DB_TRANSACOES está vazia.",
      refunds: [],
      groups: []
    };
  }

  const headers = GFP_ESTORNOS_HEADERS_16_1_11_(sh);
  const required = ["DATA", "DESCRICAO", "VALOR", "TIPO", "CONTA", "CATEGORIA", "STATUS", "NOTAS"];
  const missing = required.filter(function(h) { return !headers[h]; });

  if (missing.length) {
    return {
      ok: false,
      message: "Colunas obrigatórias não encontradas: " + missing.join(", "),
      refunds: [],
      groups: []
    };
  }

  const selectedRows = GFP_ESTORNOS_SELECTED_ROWS_16_1_11_(sh, lastRow);

  if (!selectedRows.length) {
    return {
      ok: false,
      message: "Selecione uma ou mais linhas da DB_TRANSACOES.",
      refunds: [],
      groups: []
    };
  }

  const dbRows = GFP_ESTORNOS_READ_SHEET_ROWS_16_1_17_(GFP_ESTORNOS_DB_16_1_17);
  const histRows = GFP_ESTORNOS_READ_SHEET_ROWS_16_1_17_(GFP_ESTORNOS_HIST_16_1_17);

  const selectedKey = {};
  selectedRows.forEach(function(r) {
    selectedKey[GFP_ESTORNOS_DB_16_1_17 + "#" + r] = true;
  });

  const selectedItems = selectedRows
    .map(function(rowNumber) {
      return dbRows.filter(function(r) { return r.rowNumber === rowNumber; })[0];
    })
    .filter(Boolean)
    .filter(function(item) {
      return Math.abs(item.value || 0) >= 0.005;
    });

  const allCandidates = dbRows.concat(histRows).filter(function(item) {
    if (selectedKey[item.key]) return false;

    const tipo = GFP_ESTORNOS_NORM_16_1_17_(item.tipo);
    const cat = String(item.category || "");

    if (cat === GFP_ESTORNOS_CATEGORIA_PADRAO_16_1_11) return false;

    return tipo === "D" || item.value < -0.005;
  });

  const groups = GFP_ESTORNOS_DETECT_GROUPS_16_1_17_(selectedItems, allCandidates);

  const usedByRecommendedGroup = {};
  groups.forEach(function(g) {
    if (g.recommended) {
      g.refunds.forEach(function(r) { usedByRecommendedGroup[r.key] = true; });
      g.purchases.forEach(function(p) { usedByRecommendedGroup[p.key] = true; });
    }
  });

  const refunds = selectedItems.map(function(item) {
    const candidates = allCandidates
      .filter(function(candidate) {
        return !usedByRecommendedGroup[candidate.key];
      })
      .map(function(candidate) {
        return GFP_ESTORNOS_SCORE_CANDIDATE_16_1_17_(item, candidate);
      })
      .filter(function(scored) {
        return scored && scored.score >= 35;
      })
      .sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if (a.mode !== b.mode) return a.mode === "EXACT" ? -1 : 1;
        return Math.abs(a.daysDiff) - Math.abs(b.daysDiff);
      })
      .slice(0, 6);

    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].score >= 65) {
        candidates[i].recommended = true;
        break;
      }
    }

    return {
      ok: true,
      rowNumber: item.rowNumber,
      selected: item,
      alreadyInRecommendedGroup: !!usedByRecommendedGroup[item.key],
      candidates: candidates,
      recommendedKey: candidates.filter(function(c) { return c.recommended; }).map(function(c) { return c.candidate.key; })[0] || ""
    };
  });

  return {
    ok: true,
    version: GFP_ESTORNOS_VERSION_16_1_11,
    message: "Análise concluída.",
    selectedRows: selectedRows,
    groups: groups,
    refunds: refunds,
    totals: {
      selected: selectedItems.length,
      dbCandidates: dbRows.length,
      histCandidates: histRows.length
    }
  };
}

/**
 * Detecta conjuntos N estornos ↔ N compras/parcelas.
 */
function GFP_ESTORNOS_DETECT_GROUPS_16_1_17_(selectedItems, allCandidates) {
  const buckets = {};

  selectedItems.forEach(function(item) {
    const root = GFP_ESTORNOS_ROOT_16_1_17_(item.description);
    const accountKey = GFP_ESTORNOS_NORM_16_1_17_(item.account);
    const monthKey = item.cashMonth || "";
    const key = root + "|" + accountKey + "|" + monthKey;

    if (!buckets[key]) {
      buckets[key] = {
        root: root,
        accountKey: accountKey,
        monthKey: monthKey,
        refunds: []
      };
    }

    buckets[key].refunds.push(item);
  });

  const groups = [];

  Object.keys(buckets).forEach(function(bucketKey) {
    const bucket = buckets[bucketKey];

    if (!bucket.refunds.length) return;

    const totalRefund = GFP_ESTORNOS_ROUND_16_1_11_(
      bucket.refunds.reduce(function(acc, r) { return acc + Math.abs(r.value || 0); }, 0)
    );

    if (totalRefund < 0.01) return;

    const candidatePool = allCandidates
      .filter(function(c) {
        const sameRoot = GFP_ESTORNOS_ROOT_16_1_17_(c.description) === bucket.root;
        const sameAccount = !bucket.accountKey || GFP_ESTORNOS_NORM_16_1_17_(c.account) === bucket.accountKey;
        const valueOk = Math.abs(c.value || 0) <= totalRefund + 0.05;
        const notNeutral = String(c.category || "") !== GFP_ESTORNOS_CATEGORIA_PADRAO_16_1_11;

        return sameRoot && sameAccount && valueOk && notNeutral;
      })
      .map(function(c) {
        const sc = GFP_ESTORNOS_SCORE_GROUP_PURCHASE_16_1_17_(bucket, c);
        c._groupScore = sc.score;
        c._groupReasons = sc.reasons;
        return c;
      })
      .sort(function(a, b) {
        if ((b._groupScore || 0) !== (a._groupScore || 0)) return (b._groupScore || 0) - (a._groupScore || 0);
        return Math.abs(b.value || 0) - Math.abs(a.value || 0);
      })
      .slice(0, 28);

    const subset = GFP_ESTORNOS_FIND_SUBSET_16_1_17_(candidatePool, totalRefund);

    if (!subset || !subset.items || !subset.items.length) return;

    const totalPurchases = GFP_ESTORNOS_ROUND_16_1_11_(
      subset.items.reduce(function(acc, p) { return acc + Math.abs(p.value || 0); }, 0)
    );

    const diff = GFP_ESTORNOS_ROUND_16_1_11_(totalRefund - totalPurchases);
    const absDiffCents = Math.abs(GFP_ESTORNOS_TO_CENTS_16_1_17_(diff));

    if (absDiffCents > GFP_ESTORNOS_TOLERANCIA_CENTAVOS_16_1_17) return;

    let score = 55;
    const reasons = ["total dos créditos fecha com total das compras/parcelas"];

    if (bucket.refunds.length > 1 || subset.items.length > 1) {
      score += 10;
      reasons.push("compensação em conjunto");
    }

    const sameMonthCount = subset.items.filter(function(p) {
      return bucket.monthKey && p.cashMonth === bucket.monthKey;
    }).length;

    if (sameMonthCount === subset.items.length && subset.items.length) {
      score += 10;
      reasons.push("mesmo mês de caixa/fatura");
    }

    const source0 = bucket.refunds.map(function(r) { return r.sourceFile; }).filter(Boolean)[0] || "";
    const sameSourceCount = source0
      ? subset.items.filter(function(p) { return p.sourceFile && p.sourceFile === source0; }).length
      : 0;

    if (source0 && sameSourceCount === subset.items.length) {
      score += 10;
      reasons.push("mesmo arquivo/fatura");
    }

    const avgPurchaseScore = subset.items.reduce(function(acc, p) {
      return acc + Number(p._groupScore || 0);
    }, 0) / Math.max(1, subset.items.length);

    score += Math.round(Math.min(15, avgPurchaseScore / 6));

    let label = "Média";
    if (score >= 85) label = "Muito forte";
    else if (score >= 70) label = "Forte";

    groups.push({
      key: "GROUP#" + (groups.length + 1),
      mode: "GROUP_EXACT",
      modeLabel: "Conjunto de compensação",
      root: bucket.root,
      confidenceLabel: label,
      score: Math.min(100, score),
      recommended: score >= 70,
      reasons: reasons,
      totalRefund: totalRefund,
      totalPurchases: totalPurchases,
      diff: diff,
      refunds: bucket.refunds,
      purchases: subset.items
    });
  });

  return groups.sort(function(a, b) {
    return b.score - a.score;
  });
}

function GFP_ESTORNOS_SCORE_GROUP_PURCHASE_16_1_17_(bucket, candidate) {
  let score = 0;
  const reasons = [];

  const candRoot = GFP_ESTORNOS_ROOT_16_1_17_(candidate.description);

  if (candRoot === bucket.root) {
    score += 35;
    reasons.push("mesmo estabelecimento");
  }

  if (bucket.accountKey && GFP_ESTORNOS_NORM_16_1_17_(candidate.account) === bucket.accountKey) {
    score += 20;
    reasons.push("mesma conta/cartão");
  }

  if (bucket.monthKey && candidate.cashMonth === bucket.monthKey) {
    score += 15;
    reasons.push("mesmo mês de caixa");
  }

  const refundSource = bucket.refunds.map(function(r) { return r.sourceFile; }).filter(Boolean)[0] || "";
  if (refundSource && candidate.sourceFile === refundSource) {
    score += 15;
    reasons.push("mesma fatura/arquivo");
  }

  const minDays = bucket.refunds.reduce(function(min, r) {
    return Math.min(min, GFP_ESTORNOS_DAYS_DIFF_16_1_17_(r.date, candidate.date));
  }, 9999);

  if (minDays <= 7) {
    score += 8;
    reasons.push("datas próximas");
  } else if (minDays <= 60) {
    score += 4;
    reasons.push("datas no mesmo período");
  }

  return { score: score, reasons: reasons };
}

/**
 * Subset-sum controlado em centavos.
 * Procura combinação de compras cujo total fecha com o total dos estornos.
 */
function GFP_ESTORNOS_FIND_SUBSET_16_1_17_(candidates, targetValue) {
  const target = GFP_ESTORNOS_TO_CENTS_16_1_17_(targetValue);
  const tol = GFP_ESTORNOS_TOLERANCIA_CENTAVOS_16_1_17;

  const arr = candidates
    .map(function(c) {
      return {
        item: c,
        cents: Math.abs(GFP_ESTORNOS_TO_CENTS_16_1_17_(c.value)),
        score: Number(c._groupScore || 0)
      };
    })
    .filter(function(x) {
      return x.cents > 0 && x.cents <= target + tol;
    })
    .sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.cents - a.cents;
    });

  let best = null;
  let nodes = 0;
  const maxNodes = 60000;

  function currentScore(combo) {
    return combo.reduce(function(acc, x) { return acc + x.score; }, 0);
  }

  function backtrack(start, sum, combo) {
    nodes++;

    if (nodes > maxNodes) return true;

    const diff = Math.abs(sum - target);

    if (diff <= tol) {
      if (!best || combo.length < best.combo.length || currentScore(combo) > currentScore(best.combo)) {
        best = { combo: combo.slice(), sum: sum };
      }
      return false;
    }

    if (sum > target + tol) return false;

    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      const stop = backtrack(i + 1, sum + arr[i].cents, combo);
      combo.pop();
      if (stop) return true;
    }

    return false;
  }

  backtrack(0, 0, []);

  if (!best) return null;

  return {
    cents: best.sum,
    items: best.combo.map(function(x) { return x.item; })
  };
}

/**
 * Aplica decisões da tela:
 * - GROUP;
 * - LINK exact/partial;
 * - NO_PAIR.
 */
function GFP_ESTORNOS_APLICAR_DECISOES_16_1_17(payload) {
  payload = payload || {};

  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];

  if (!decisions.length) {
    return { ok: false, message: "Nenhuma decisão recebida." };
  }

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    return {
      ok: false,
      message: "Outro processo está em execução. Tente novamente em alguns segundos."
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_ESTORNOS_DB_16_1_17);
  const hist = ss.getSheetByName(GFP_ESTORNOS_HIST_16_1_17);

  const out = {
    ok: true,
    version: GFP_ESTORNOS_VERSION_16_1_11,
    applied: 0,
    groups: 0,
    exact: 0,
    partial: 0,
    noPair: 0,
    skipped: 0,
    errors: [],
    details: []
  };

  try {
    if (!db) {
      return { ok: false, message: "DB_TRANSACOES não encontrada." };
    }

    const dbHeaders = GFP_ESTORNOS_HEADERS_16_1_11_(db);
    const histHeaders = hist ? GFP_ESTORNOS_HEADERS_16_1_11_(hist) : {};
    const usedRefunds = {};
    const usedMatches = {};

    decisions.forEach(function(decision) {
      try {
        const action = String(decision.action || "").toUpperCase();

        if (action === "GROUP") {
          const refundRows = Array.isArray(decision.refundRows) ? decision.refundRows.map(Number).filter(Boolean) : [];
          const matchKeys = Array.isArray(decision.matchKeys) ? decision.matchKeys.map(String).filter(Boolean) : [];

          if (!refundRows.length || !matchKeys.length) {
            out.skipped++;
            out.errors.push("Conjunto inválido: sem estornos ou sem compras.");
            return;
          }

          const groupId = GFP_ESTORNOS_GROUP_ID_16_1_17_();

          refundRows.forEach(function(refundRow) {
            const refundKey = GFP_ESTORNOS_DB_16_1_17 + "#" + refundRow;

            if (usedRefunds[refundKey]) return;

            const refundItem = GFP_ESTORNOS_GET_ROW_ITEM_16_1_17_(db, dbHeaders, refundRow, GFP_ESTORNOS_DB_16_1_17);
            if (!refundItem) return;

            GFP_ESTORNOS_APPLY_REFUND_ONLY_16_1_17_(db, dbHeaders, refundItem, {
              groupId: groupId,
              status: "OK",
              role: "ESTORNO_CREDITO_CONJUNTO",
              note: "Estorno/Cancelamento confirmado em conjunto de compensação."
            });

            usedRefunds[refundKey] = true;
          });

          matchKeys.forEach(function(matchKey) {
            if (usedMatches[matchKey]) return;

            const ref = GFP_ESTORNOS_RESOLVE_KEY_16_1_17_(matchKey, db, dbHeaders, hist, histHeaders);
            if (!ref || !ref.item) return;

            GFP_ESTORNOS_APPLY_PURCHASE_EXACT_16_1_17_(ref.sheet, ref.headers, ref.item, {
              groupId: groupId,
              role: "COMPRA_CANCELADA_CONJUNTO",
              note: "Compra/parcela neutralizada por conjunto de estornos/cancelamentos."
            });

            usedMatches[matchKey] = true;
          });

          out.applied++;
          out.groups++;
          out.details.push({
            action: "GROUP",
            refundRows: refundRows,
            matchKeys: matchKeys,
            groupId: groupId
          });
          return;
        }

        const refundRow = Number(decision.refundRow || 0);
        const mode = String(decision.mode || "").toUpperCase();
        const matchKey = String(decision.matchKey || "").trim();

        if (!refundRow || refundRow < 2) {
          out.skipped++;
          out.errors.push("Linha de estorno inválida: " + refundRow);
          return;
        }

        const refundKey = GFP_ESTORNOS_DB_16_1_17 + "#" + refundRow;

        if (usedRefunds[refundKey]) {
          out.skipped++;
          out.errors.push("Estorno já usado em outra decisão: linha " + refundRow + ".");
          return;
        }

        const refundItem = GFP_ESTORNOS_GET_ROW_ITEM_16_1_17_(db, dbHeaders, refundRow, GFP_ESTORNOS_DB_16_1_17);

        if (!refundItem) {
          out.skipped++;
          out.errors.push("Estorno não encontrado na DB_TRANSACOES, linha " + refundRow + ".");
          return;
        }

        if (action === "NO_PAIR" || !matchKey) {
          GFP_ESTORNOS_APPLY_REFUND_ONLY_16_1_17_(db, dbHeaders, refundItem, {
            groupId: GFP_ESTORNOS_GROUP_ID_16_1_17_(),
            status: "PENDENTE_ESTORNO_SEM_PAR",
            role: "ESTORNO_SEM_PAR",
            note: "Estorno/Cancelamento marcado sem par automático. Revisar compra original correspondente quando possível."
          });

          usedRefunds[refundKey] = true;
          out.applied++;
          out.noPair++;
          out.details.push({
            refundRow: refundRow,
            action: "NO_PAIR"
          });
          return;
        }

        if (usedMatches[matchKey]) {
          out.skipped++;
          out.errors.push("O mesmo par foi escolhido mais de uma vez: " + matchKey + ".");
          return;
        }

        const ref = GFP_ESTORNOS_RESOLVE_KEY_16_1_17_(matchKey, db, dbHeaders, hist, histHeaders);

        if (!ref || !ref.item) {
          out.skipped++;
          out.errors.push("Compra original não encontrada: " + matchKey + ".");
          return;
        }

        const purchaseItem = ref.item;
        const refundAbs = Math.abs(refundItem.value);
        const purchaseAbs = Math.abs(purchaseItem.value);
        const groupId = GFP_ESTORNOS_GROUP_ID_16_1_17_();

        if (Math.abs(refundAbs - purchaseAbs) <= 0.01 || mode === "EXACT") {
          GFP_ESTORNOS_APPLY_REFUND_ONLY_16_1_17_(db, dbHeaders, refundItem, {
            groupId: groupId,
            status: "OK",
            role: "ESTORNO_CREDITO",
            note: "Estorno/Cancelamento confirmado e vinculado à compra original."
          });

          GFP_ESTORNOS_APPLY_PURCHASE_EXACT_16_1_17_(ref.sheet, ref.headers, purchaseItem, {
            groupId: groupId,
            role: "COMPRA_CANCELADA_TOTAL",
            note: "Compra original neutralizada por estorno/cancelamento total.",
            refund: refundItem
          });

          usedRefunds[refundKey] = true;
          usedMatches[matchKey] = true;

          out.applied++;
          out.exact++;
          out.details.push({
            refundRow: refundRow,
            matchKey: matchKey,
            mode: "EXACT",
            value: refundAbs
          });
          return;
        }

        if (mode === "PARTIAL" && purchaseAbs > refundAbs + 0.01) {
          GFP_ESTORNOS_APPLY_REFUND_ONLY_16_1_17_(db, dbHeaders, refundItem, {
            groupId: groupId,
            status: "OK",
            role: "ESTORNO_CREDITO_PARCIAL",
            note: "Estorno/Cancelamento parcial confirmado e vinculado à compra original."
          });

          GFP_ESTORNOS_APPLY_PURCHASE_PARTIAL_16_1_17_(ref.sheet, ref.headers, purchaseItem, refundAbs, {
            groupId: groupId,
            refund: refundItem
          });

          usedRefunds[refundKey] = true;
          usedMatches[matchKey] = true;

          out.applied++;
          out.partial++;
          out.details.push({
            refundRow: refundRow,
            matchKey: matchKey,
            mode: "PARTIAL",
            refundValue: refundAbs,
            purchaseValue: purchaseAbs,
            remainingValue: GFP_ESTORNOS_ROUND_16_1_11_(purchaseAbs - refundAbs)
          });
          return;
        }

        out.skipped++;
        out.errors.push("Decisão inválida para linha " + refundRow + ". Valor do estorno não é compatível com a compra.");

      } catch (eItem) {
        out.skipped++;
        out.errors.push(eItem.message);
      }
    });

    // GFP 16.1.11 ESTÁVEL SEGURO:
    // Não chamamos saneamento visual global nem ordenação aqui.
    // A central de estornos deve apenas aplicar as decisões selecionadas.
    // Reordenação/visual global ficam para comando manual separado, se necessário.
    try {
      SpreadsheetApp.flush();
    } catch (eFlush) {
      out.errors.push("Aplicado, mas flush final falhou: " + eFlush.message);
    }

    const msg = "Estornos/Cancelamentos aplicados: " + out.applied +
      " | conjuntos: " + out.groups +
      " | pares: " + out.exact +
      " | parciais: " + out.partial +
      " | sem par: " + out.noPair +
      (out.errors.length ? " | alertas: " + out.errors.length : "");

    GFP_ESTORNOS_LOG_16_1_11_(msg);
    ss.toast(msg, "GFP Estornos");

    out.ok = out.errors.length === 0;
    out.message = msg;
    return out;

  } finally {
    try { lock.releaseLock(); } catch (eUnlock) {}
  }
}

function GFP_ESTORNOS_RESOLVE_KEY_16_1_17_(key, db, dbHeaders, hist, histHeaders) {
  const parts = String(key || "").split("#");
  const sheetName = parts[0];
  const rowNumber = Number(parts[1] || 0);

  if (!sheetName || !rowNumber) return null;

  const sh = sheetName === GFP_ESTORNOS_HIST_16_1_17 ? hist : db;
  const headers = sheetName === GFP_ESTORNOS_HIST_16_1_17 ? histHeaders : dbHeaders;

  if (!sh) return null;

  const item = GFP_ESTORNOS_GET_ROW_ITEM_16_1_17_(sh, headers, rowNumber, sheetName);

  return {
    sheet: sh,
    headers: headers,
    item: item
  };
}

/**
 * Lê uma aba em objetos.
 */
function GFP_ESTORNOS_READ_SHEET_ROWS_16_1_17_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);

  if (!sh || sh.getLastRow() < 2) return [];

  const headers = GFP_ESTORNOS_HEADERS_16_1_11_(sh);
  const width = sh.getLastColumn();
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();

  const out = [];

  values.forEach(function(row, idx) {
    const rowNumber = idx + 2;
    const item = GFP_ESTORNOS_ROW_TO_ITEM_16_1_17_(sh, headers, row, rowNumber, sheetName);
    if (item) out.push(item);
  });

  return out;
}

function GFP_ESTORNOS_GET_ROW_ITEM_16_1_17_(sh, headers, rowNumber, sheetName) {
  if (!sh || rowNumber < 2 || rowNumber > sh.getLastRow()) return null;

  const row = sh.getRange(rowNumber, 1, 1, sh.getLastColumn()).getValues()[0];
  return GFP_ESTORNOS_ROW_TO_ITEM_16_1_17_(sh, headers, row, rowNumber, sheetName);
}

function GFP_ESTORNOS_ROW_TO_ITEM_16_1_17_(sh, headers, row, rowNumber, sheetName) {
  headers = headers || {};

  const value = GFP_ESTORNOS_PARSE_NUMBER_16_1_11_(row[(headers.VALOR || 3) - 1]);
  const desc = String(row[(headers.DESCRICAO || 2) - 1] || "");
  const account = String(row[(headers.CONTA || 5) - 1] || "");
  const category = String(row[(headers.CATEGORIA || 6) - 1] || "");
  const status = String(row[(headers.STATUS || 9) - 1] || "");
  const notes = String(row[(headers.NOTAS || 10) - 1] || "");
  const tipo = String(row[(headers.TIPO || 4) - 1] || "");
  const dateValue = row[(headers.DATA || 1) - 1];
  const metaCol = GFP_ESTORNOS_META_COL_16_1_14_(headers);
  const metaRaw = metaCol ? row[metaCol - 1] : "";
  const meta = GFP_ESTORNOS_PARSE_JSON_16_1_11_(metaRaw);
  const dateKey = GFP_ESTORNOS_DATE_KEY_16_1_17_(dateValue);
  const cashMonth = GFP_ESTORNOS_EXTRACT_CASH_MONTH_16_1_17_(meta);
  const id = String(row[(headers.ID_TRANSACAO || 11) - 1] || "");
  const hashHeader = headers.HASH || headers.HASH_LINHA || 13;
  const hash = String(row[hashHeader - 1] || "");

  if (!desc && !value) return null;

  return {
    key: sheetName + "#" + rowNumber,
    sheetName: sheetName,
    rowNumber: rowNumber,
    date: dateKey,
    dateBr: GFP_ESTORNOS_DATE_BR_16_1_17_(dateKey),
    description: desc,
    merchant: GFP_ESTORNOS_MERCHANT_16_1_17_(desc),
    root: GFP_ESTORNOS_ROOT_16_1_17_(desc),
    value: value,
    valueAbs: Math.abs(value || 0),
    tipo: tipo,
    account: account,
    category: category,
    status: status,
    notes: notes,
    id: id,
    hash: hash,
    meta: meta,
    cashMonth: cashMonth,
    sourceFile: String(meta.invoiceFileName || meta.fileName || meta.fileId || meta.origin || ""),
    isHistory: sheetName === GFP_ESTORNOS_HIST_16_1_17
  };
}

/**
 * Pontua candidato individual.
 */
function GFP_ESTORNOS_SCORE_CANDIDATE_16_1_17_(refund, candidate) {
  const refundAbs = Math.abs(refund.value);
  const candAbs = Math.abs(candidate.value);

  if (!refundAbs || !candAbs) return null;

  const exact = Math.abs(refundAbs - candAbs) <= 0.01;
  const partial = candAbs > refundAbs + 0.01;

  if (!exact && !partial) return null;

  const sameAccount = GFP_ESTORNOS_NORM_16_1_17_(refund.account) === GFP_ESTORNOS_NORM_16_1_17_(candidate.account);
  const sameCashMonth = refund.cashMonth && candidate.cashMonth && refund.cashMonth === candidate.cashMonth;
  const sameSourceFile = refund.sourceFile && candidate.sourceFile && refund.sourceFile === candidate.sourceFile;
  const sameRoot = refund.root && candidate.root && refund.root === candidate.root;
  const sim = GFP_ESTORNOS_TEXT_SIMILARITY_16_1_17_(refund.merchant, candidate.merchant);
  const daysDiff = GFP_ESTORNOS_DAYS_DIFF_16_1_17_(refund.date, candidate.date);

  let score = 0;
  const reasons = [];

  if (exact) {
    score += 45;
    reasons.push("valor igual");
  } else {
    score += 25;
    reasons.push("estorno parcial: valor menor que a compra");
  }

  if (sameAccount) {
    score += 15;
    reasons.push("mesma conta/cartão");
  }

  if (sameRoot) {
    score += 20;
    reasons.push("mesmo estabelecimento");
  } else {
    const descScore = Math.round(sim * 25);
    score += descScore;

    if (sim >= 0.80) reasons.push("descrição muito parecida");
    else if (sim >= 0.45) reasons.push("descrição parecida");
    else if (sim > 0) reasons.push("alguns termos em comum");
  }

  if (sameSourceFile) {
    score += 10;
    reasons.push("mesma fatura/arquivo");
  } else if (sameCashMonth) {
    score += 7;
    reasons.push("mesmo mês de caixa");
  }

  if (daysDiff <= 7) {
    score += 5;
    reasons.push("datas próximas");
  } else if (daysDiff <= 45) {
    score += 3;
    reasons.push("datas no mesmo período");
  } else if (daysDiff <= 120) {
    score += 1;
  }

  if (candidate.isHistory) {
    score -= 2;
    reasons.push("encontrado no histórico");
  }

  let label = "Baixa";
  if (score >= 80) label = "Muito forte";
  else if (score >= 65) label = "Forte";
  else if (score >= 50) label = "Média";

  return {
    score: score,
    confidenceLabel: label,
    mode: exact ? "EXACT" : "PARTIAL",
    modeLabel: exact ? "Cancelamento total" : "Cancelamento parcial",
    daysDiff: daysDiff,
    reasons: reasons,
    candidate: candidate,
    recommended: false
  };
}

/**
 * Aplica o lado do estorno/crédito.
 */
function GFP_ESTORNOS_APPLY_REFUND_ONLY_16_1_17_(sh, headers, refundItem, options) {
  options = options || {};

  const rowNumber = refundItem.rowNumber;
  const valueAbs = Math.abs(refundItem.value);
  const metaCol = GFP_ESTORNOS_META_COL_16_1_14_(headers);
  const meta = GFP_ESTORNOS_PARSE_JSON_16_1_11_(metaCol ? sh.getRange(rowNumber, metaCol).getValue() : "");
  const nowText = GFP_ESTORNOS_NOW_TEXT_16_1_17_();

  if (!Array.isArray(meta.ajustes_estorno_cancelamento)) {
    meta.ajustes_estorno_cancelamento = [];
  }

  meta.ajustes_estorno_cancelamento.push({
    version: GFP_ESTORNOS_VERSION_16_1_11,
    groupId: options.groupId || "",
    role: options.role || "ESTORNO_CREDITO",
    appliedAt: new Date().toISOString(),
    source: "CENTRAL_ESTORNOS_16_1_17",
    originalValue: refundItem.value,
    adjustedValue: valueAbs,
    originalType: refundItem.tipo,
    adjustedType: "C",
    adjustedCategory: GFP_ESTORNOS_CATEGORIA_PADRAO_16_1_11,
    adjustedStatus: options.status || "OK"
  });

  const note = GFP_ESTORNOS_APPEND_NOTE_16_1_11_(
    refundItem.notes,
    "[" + nowText + "] " + (options.note || "Estorno/Cancelamento confirmado manualmente.") +
      " Categoria neutra aplicada: 99.14. Grupo: " + (options.groupId || "-") + "."
  );

  sh.getRange(rowNumber, headers.VALOR).setValue(valueAbs);
  sh.getRange(rowNumber, headers.TIPO).setValue("C");
  sh.getRange(rowNumber, headers.CATEGORIA).setValue(GFP_ESTORNOS_CATEGORIA_PADRAO_16_1_11);
  sh.getRange(rowNumber, headers.STATUS).setValue(options.status || "OK");
  sh.getRange(rowNumber, headers.NOTAS).setValue(note);

  if (metaCol) {
    sh.getRange(rowNumber, metaCol).setValue(JSON.stringify(meta));
  }

  GFP_ESTORNOS_LIGHT_GREEN_16_1_17_(sh, rowNumber, headers);
}

/**
 * Aplica neutralização total da compra/parcela.
 */
function GFP_ESTORNOS_APPLY_PURCHASE_EXACT_16_1_17_(sh, headers, purchaseItem, options) {
  options = options || {};

  const rowNumber = purchaseItem.rowNumber;
  const valueAbs = Math.abs(purchaseItem.value);
  const metaCol = GFP_ESTORNOS_META_COL_16_1_14_(headers);
  const meta = GFP_ESTORNOS_PARSE_JSON_16_1_11_(metaCol ? sh.getRange(rowNumber, metaCol).getValue() : "");
  const nowText = GFP_ESTORNOS_NOW_TEXT_16_1_17_();

  if (!Array.isArray(meta.ajustes_estorno_cancelamento)) {
    meta.ajustes_estorno_cancelamento = [];
  }

  meta.ajustes_estorno_cancelamento.push({
    version: GFP_ESTORNOS_VERSION_16_1_11,
    groupId: options.groupId || "",
    role: options.role || "COMPRA_CANCELADA_TOTAL",
    appliedAt: new Date().toISOString(),
    source: "CENTRAL_ESTORNOS_16_1_17",
    originalValue: purchaseItem.value,
    adjustedValue: -valueAbs,
    originalCategory: purchaseItem.category,
    adjustedCategory: GFP_ESTORNOS_CATEGORIA_PADRAO_16_1_11,
    linkedRefundRow: options.refund ? options.refund.rowNumber : ""
  });

  const note = GFP_ESTORNOS_APPEND_NOTE_16_1_11_(
    purchaseItem.notes,
    "[" + nowText + "] " + (options.note || "Compra original neutralizada por estorno/cancelamento.") +
      " Ela permanece como débito, mas em categoria neutra 99.14 para não aparecer como despesa real. Grupo: " +
      (options.groupId || "-") + "."
  );

  sh.getRange(rowNumber, headers.VALOR).setValue(-valueAbs);
  sh.getRange(rowNumber, headers.TIPO).setValue("D");
  sh.getRange(rowNumber, headers.CATEGORIA).setValue(GFP_ESTORNOS_CATEGORIA_PADRAO_16_1_11);
  sh.getRange(rowNumber, headers.STATUS).setValue("OK");
  sh.getRange(rowNumber, headers.NOTAS).setValue(note);

  if (metaCol) {
    sh.getRange(rowNumber, metaCol).setValue(JSON.stringify(meta));
  }

  GFP_ESTORNOS_LIGHT_GREEN_16_1_17_(sh, rowNumber, headers);
}

/**
 * Aplica cancelamento parcial com split controlado.
 */
function GFP_ESTORNOS_APPLY_PURCHASE_PARTIAL_16_1_17_(sh, headers, purchaseItem, refundAbs, options) {
  options = options || {};

  const isHist = sh.getName() === GFP_ESTORNOS_HIST_16_1_17;
  const rowNumber = purchaseItem.rowNumber;
  const width = sh.getLastColumn();
  const rowRange = sh.getRange(rowNumber, 1, 1, width);
  const row = rowRange.getValues()[0];

  const purchaseAbs = Math.abs(purchaseItem.value);
  const remainingAbs = GFP_ESTORNOS_ROUND_16_1_11_(purchaseAbs - refundAbs);

  if (remainingAbs <= 0.01) {
    GFP_ESTORNOS_APPLY_PURCHASE_EXACT_16_1_17_(sh, headers, purchaseItem, options);
    return;
  }

  const metaCol = GFP_ESTORNOS_META_COL_16_1_14_(headers);
  const nowText = GFP_ESTORNOS_NOW_TEXT_16_1_17_();
  const groupId = options.groupId || GFP_ESTORNOS_GROUP_ID_16_1_17_();

  const originalMeta = GFP_ESTORNOS_PARSE_JSON_16_1_11_(metaCol ? row[metaCol - 1] : "");

  if (!Array.isArray(originalMeta.ajustes_estorno_cancelamento)) {
    originalMeta.ajustes_estorno_cancelamento = [];
  }

  originalMeta.ajustes_estorno_cancelamento.push({
    version: GFP_ESTORNOS_VERSION_16_1_11,
    groupId: groupId,
    role: "COMPRA_REMANESCENTE_APOS_CANCELAMENTO_PARCIAL",
    appliedAt: new Date().toISOString(),
    originalValue: purchaseItem.value,
    remainingValue: -remainingAbs,
    canceledPartValue: -refundAbs,
    originalCategory: purchaseItem.category
  });

  const originalNote = GFP_ESTORNOS_APPEND_NOTE_16_1_11_(
    purchaseItem.notes,
    "[" + nowText + "] Compra ajustada por cancelamento parcial. " +
      "Despesa real remanescente: " + GFP_ESTORNOS_FMT_MONEY_16_1_11_(remainingAbs) +
      ". Parte cancelada: " + GFP_ESTORNOS_FMT_MONEY_16_1_11_(refundAbs) +
      ". Grupo: " + groupId + "."
  );

  sh.getRange(rowNumber, headers.VALOR).setValue(-remainingAbs);
  sh.getRange(rowNumber, headers.TIPO).setValue("D");
  sh.getRange(rowNumber, headers.NOTAS).setValue(originalNote);

  if (metaCol) {
    sh.getRange(rowNumber, metaCol).setValue(JSON.stringify(originalMeta));
  }

  const canceledRow = row.slice();
  canceledRow[(headers.VALOR || 3) - 1] = -refundAbs;
  canceledRow[(headers.TIPO || 4) - 1] = "D";
  canceledRow[(headers.CATEGORIA || 6) - 1] = GFP_ESTORNOS_CATEGORIA_PADRAO_16_1_11;
  canceledRow[(headers.STATUS || 9) - 1] = "OK";
  canceledRow[(headers.NOTAS || 10) - 1] = "[" + nowText + "] Parte cancelada da compra original. " +
    "Linha criada automaticamente para compensar estorno parcial. Grupo: " + groupId + ".";

  if (headers.DESCRICAO) {
    canceledRow[headers.DESCRICAO - 1] = "[PARTE CANCELADA] " + purchaseItem.description;
  }

  if (headers.ID_TRANSACAO) {
    canceledRow[headers.ID_TRANSACAO - 1] = String(purchaseItem.id || "SEMID") + "-CANC-" + groupId.slice(-6);
  }

  if (headers.HASH) canceledRow[headers.HASH - 1] = "";
  if (headers.HASH_LINHA) canceledRow[headers.HASH_LINHA - 1] = "";

  const canceledMeta = GFP_ESTORNOS_PARSE_JSON_16_1_11_(metaCol ? row[metaCol - 1] : "");

  canceledMeta.ajustes_estorno_cancelamento = canceledMeta.ajustes_estorno_cancelamento || [];
  canceledMeta.ajustes_estorno_cancelamento.push({
    version: GFP_ESTORNOS_VERSION_16_1_11,
    groupId: groupId,
    role: "COMPRA_CANCELADA_PARCIAL",
    appliedAt: new Date().toISOString(),
    originalPurchaseRow: rowNumber,
    originalPurchaseSheet: sh.getName(),
    canceledValue: -refundAbs,
    linkedRefundRow: options.refund ? options.refund.rowNumber : ""
  });

  if (metaCol) {
    canceledRow[metaCol - 1] = JSON.stringify(canceledMeta);
  }

  if (!isHist) {
    for (let c = 14; c <= 18 && c < canceledRow.length; c++) {
      canceledRow[c] = "";
    }
  }

  // GFP 16.1.11 ESTÁVEL SEGURO:
  // Sempre cria a linha da parte cancelada no FINAL da aba.
  // Não usamos insertRowsAfter(rowNumber), porque isso desloca linhas abaixo
  // e pode fazer decisões seguintes atingirem a linha errada.
  const insertAt = sh.getLastRow() + 1;
  sh.getRange(insertAt, 1, 1, width).setValues([canceledRow]);
  GFP_ESTORNOS_LIGHT_GREEN_16_1_17_(sh, insertAt, headers);

  GFP_ESTORNOS_LIGHT_GREEN_16_1_17_(sh, rowNumber, headers);
}

function GFP_ESTORNOS_LIGHT_GREEN_16_1_17_(sh, rowNumber, headers) {
  try {
    const cols = [
      headers.VALOR,
      headers.TIPO,
      headers.CATEGORIA,
      headers.STATUS,
      headers.NOTAS
    ].filter(Boolean);

    cols.forEach(function(c) {
      sh.getRange(rowNumber, c).setBackground("#d9ead3");
    });
  } catch (e) {}
}

function GFP_ESTORNOS_HEADERS_16_1_11_(sh) {
  const raw = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};

  raw.forEach(function(h, idx) {
    const key = String(h || "").trim().toUpperCase();
    if (key) map[key] = idx + 1;
  });

  return map;
}

function GFP_ESTORNOS_META_COL_16_1_14_(headers) {
  headers = headers || {};

  if (headers.METADADOS) return headers.METADADOS;
  if (headers.SOURCE_FILE) return headers.SOURCE_FILE;

  return 0;
}

function GFP_ESTORNOS_SELECTED_ROWS_16_1_11_(sh, lastRow) {
  const set = {};

  try {
    const rangeList = sh.getActiveRangeList && sh.getActiveRangeList();
    const ranges = rangeList ? rangeList.getRanges() : [];

    if (ranges && ranges.length) {
      ranges.forEach(function(r) {
        const start = r.getRow();
        const end = start + r.getNumRows() - 1;
        for (let row = start; row <= end; row++) {
          if (row >= 2 && row <= lastRow) set[row] = true;
        }
      });
    }
  } catch (e) {}

  if (Object.keys(set).length === 0) {
    const r = sh.getActiveRange();
    if (r) {
      const start = r.getRow();
      const end = start + r.getNumRows() - 1;
      for (let row = start; row <= end; row++) {
        if (row >= 2 && row <= lastRow) set[row] = true;
      }
    }
  }

  return Object.keys(set).map(Number).sort(function(a, b) { return a - b; });
}

function GFP_ESTORNOS_PARSE_NUMBER_16_1_11_(value) {
  if (typeof value === "number") return value;

  let s = String(value || "").trim();
  if (!s) return NaN;

  s = s.replace(/R\$/gi, "");
  s = s.replace(/\s/g, "");
  s = s.replace(/−/g, "-");
  s = s.replace(/\u2212/g, "-");
  s = s.replace(/\./g, "");
  s = s.replace(/,/g, ".");
  s = s.replace(/[^0-9.-]/g, "");

  if (!s || s === "-" || s === ".") return NaN;
  return Number(s);
}

function GFP_ESTORNOS_PARSE_JSON_16_1_11_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return { meta_original_invalido: String(value || "") };
  }
}

function GFP_ESTORNOS_APPEND_NOTE_16_1_11_(oldNote, newNote) {
  const a = String(oldNote || "").trim();
  const b = String(newNote || "").trim();
  if (!a) return b;
  if (!b) return a;
  return a + "\n" + b;
}

function GFP_ESTORNOS_ROUND_16_1_11_(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function GFP_ESTORNOS_FMT_MONEY_16_1_11_(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function GFP_ESTORNOS_LOG_16_1_11_(message) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("SYS_LOGS");
    if (!sh) return;

    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, 5).setValues([[
      Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
      "OK",
      "Estornos/Cancelamentos",
      message,
      ""
    ]]);
  } catch (e) {
    try { Logger.log(message); } catch (e2) {}
  }
}

function GFP_ESTORNOS_GROUP_ID_16_1_17_() {
  return "EST-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyyMMdd-HHmmss") +
    "-" + Math.floor(Math.random() * 100000);
}

function GFP_ESTORNOS_NOW_TEXT_16_1_17_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM-dd HH:mm");
}

function GFP_ESTORNOS_NORM_16_1_17_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function GFP_ESTORNOS_MERCHANT_16_1_17_(desc) {
  let s = GFP_ESTORNOS_NORM_16_1_17_(desc);

  s = s.replace(/^\[\d{2}\/\d{2}\]\s*/, "");
  s = s.replace(/\b[A-Z]{0,3}PARC\s*\d{1,2}\s*\/\s*\d{1,2}\b/g, " ");
  s = s.replace(/\b[A-Z]{0,3}PARC\d{1,2}\/\d{1,2}\b/g, " ");
  s = s.replace(/\bPARCELA\s*\d{1,2}\s*DE\s*\d{1,2}\b/g, " ");
  s = s.replace(/[*_\-.,;:()[\]{}]/g, " ");
  s = s.replace(/\b\d{1,2}\/\d{1,2}\b/g, " ");
  s = s.replace(/\b(COM|COMERCIO|LTDA|SA|S A|BRASIL|BRA|PAGAMENTO|FATURA|COMPRA|REALIZADA|RECEBIDO|ENVIADO|COM|SALDO|CARTAO|VIRTUAL|HOTEL|AT)\b/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function GFP_ESTORNOS_ROOT_16_1_17_(desc) {
  const merchant = GFP_ESTORNOS_MERCHANT_16_1_17_(desc);
  const tokens = GFP_ESTORNOS_TOKENS_16_1_17_(merchant);

  if (!tokens.length) return merchant || "";

  if (tokens.indexOf("LATAM") >= 0) {
    const out = [];
    ["LATAM", "DCP", "ND"].forEach(function(t) {
      if (tokens.indexOf(t) >= 0) out.push(t);
    });
    return out.length ? out.join(" ") : "LATAM";
  }

  if (tokens.indexOf("DECOLAR") >= 0) return "DECOLAR";
  if (tokens.indexOf("BOOKING") >= 0) return "BOOKING";
  if (tokens.indexOf("CLICKBUS") >= 0) return "CLICKBUS";
  if (tokens.indexOf("UBER") >= 0 || tokens.indexOf("UBERRIDES") >= 0) return "UBER";
  if (tokens.indexOf("APPLE") >= 0 || tokens.indexOf("APPLECOMBILL") >= 0) return "APPLE";
  if (tokens.indexOf("AMAZON") >= 0 || tokens.indexOf("AMAZONMKTPLC") >= 0) return "AMAZON";
  if (tokens.indexOf("GOOGLE") >= 0) return "GOOGLE";

  return tokens.slice(0, Math.min(2, tokens.length)).join(" ");
}

function GFP_ESTORNOS_TOKENS_16_1_17_(text) {
  const s = GFP_ESTORNOS_MERCHANT_16_1_17_(text);
  const parts = s.split(/\s+/).filter(function(t) {
    return t && t.length >= 2 && !/^\d+$/.test(t);
  });

  const set = {};
  parts.forEach(function(t) { set[t] = true; });

  return Object.keys(set);
}

function GFP_ESTORNOS_TEXT_SIMILARITY_16_1_17_(a, b) {
  const ta = GFP_ESTORNOS_TOKENS_16_1_17_(a);
  const tb = GFP_ESTORNOS_TOKENS_16_1_17_(b);

  if (!ta.length || !tb.length) return 0;

  const setB = {};
  tb.forEach(function(t) { setB[t] = true; });

  let inter = 0;
  ta.forEach(function(t) {
    if (setB[t]) inter++;
  });

  const union = {};
  ta.concat(tb).forEach(function(t) { union[t] = true; });
  const u = Object.keys(union).length;

  return u ? inter / u : 0;
}

function GFP_ESTORNOS_DATE_KEY_16_1_17_(value) {
  if (!value) return "";

  let d = null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    d = value;
  } else {
    const s = String(value || "").trim();
    let m = s.match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);

    if (m) {
      d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    } else {
      m = s.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
      if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    if (!d) d = new Date(s);
  }

  if (!d || isNaN(d.getTime())) return "";

  return Utilities.formatDate(d, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM-dd");
}

function GFP_ESTORNOS_DATE_BR_16_1_17_(key) {
  const m = String(key || "").match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}

function GFP_ESTORNOS_DAYS_DIFF_16_1_17_(a, b) {
  if (!a || !b) return 9999;

  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");

  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 9999;

  return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

function GFP_ESTORNOS_EXTRACT_CASH_MONTH_16_1_17_(meta) {
  if (!meta || typeof meta !== "object") return "";

  const candidates = [
    meta.cashMonth,
    meta.cash_month,
    meta.competencia_fatura,
    meta.competenciaFatura,
    meta.invoiceReference,
    meta.invoiceMonth,
    meta.faturaMonth,
    meta.invoice && meta.invoice.cashMonth,
    meta.fatura && meta.fatura.cashMonth
  ];

  for (let i = 0; i < candidates.length; i++) {
    const cm = GFP_ESTORNOS_NORMALIZE_MONTH_16_1_17_(candidates[i]);
    if (cm) return cm;
  }

  const raw = JSON.stringify(meta);
  const m = raw.match(/20\d{2}-\d{2}/);
  return m ? m[0] : "";
}

function GFP_ESTORNOS_NORMALIZE_MONTH_16_1_17_(value) {
  const s = String(value || "").trim();
  if (!s) return "";

  let m = s.match(/^(20\d{2})-(\d{2})$/);
  if (m) return m[1] + "-" + m[2];

  m = s.match(/^(20\d{2})-(\d{2})-\d{2}$/);
  if (m) return m[1] + "-" + m[2];

  m = s.match(/^(\d{2})\/(20\d{2})$/);
  if (m) return m[2] + "-" + m[1];

  return "";
}

function GFP_ESTORNOS_TO_CENTS_16_1_17_(value) {
  return Math.round(Number(value || 0) * 100);
}

function GFP_ESTORNOS_HTML_16_1_17_() {
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; font-family: Arial, sans-serif; }
    body { margin: 0; background: #f6f8fb; color: #1f2937; font-size: 13px; }
    .top { padding: 16px 20px; background: #0f3b63; color: white; }
    .top h1 { margin: 0 0 4px; font-size: 20px; }
    .top p { margin: 0; opacity: .9; }
    .bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: white; border-bottom: 1px solid #e5e7eb; }
    .wrap { padding: 16px 20px 85px; }
    .loading { padding: 24px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; }
    .sectionTitle { font-size: 15px; font-weight: 900; margin: 12px 0 8px; color: #0f3b63; }
    .card { background: white; border: 1px solid #dbe3ef; border-radius: 14px; margin-bottom: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .cardHead { display: grid; grid-template-columns: 1fr auto; gap: 14px; padding: 14px 16px; background: #eef6ff; border-bottom: 1px solid #dbe3ef; }
    .groupHead { background: #f0fdf4; }
    .title { font-weight: 800; font-size: 15px; color: #0f3b63; }
    .sub { color: #526173; margin-top: 3px; }
    .money { font-weight: 800; font-size: 15px; color: #047857; white-space: nowrap; }
    .moneyNeg { font-weight: 800; font-size: 15px; color: #b91c1c; white-space: nowrap; }
    .candidates { padding: 12px 16px; }
    .option { border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; background: #fff; display: grid; grid-template-columns: 24px 1fr auto; gap: 10px; align-items: center; }
    .option:hover { background: #f9fbff; border-color: #b6c9e4; }
    .option.recommended { border-color: #22c55e; background: #f0fdf4; }
    .option.partial { border-color: #f59e0b; background: #fff7ed; }
    .option.none { background: #f9fafb; }
    .groupBox { border: 2px solid #22c55e; background: #f0fdf4; border-radius: 14px; padding: 12px 14px; margin-bottom: 14px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
    .miniList { background: white; border: 1px solid #dbe3ef; border-radius: 10px; padding: 8px; }
    .miniItem { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid #edf2f7; }
    .miniItem:last-child { border-bottom: 0; }
    .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 800; margin-right: 5px; }
    .bGreen { background: #dcfce7; color: #166534; }
    .bBlue { background: #dbeafe; color: #1e40af; }
    .bOrange { background: #ffedd5; color: #9a3412; }
    .bGray { background: #e5e7eb; color: #374151; }
    .desc { font-weight: 700; color: #111827; }
    .meta { color: #64748b; font-size: 12px; margin-top: 2px; }
    .why { color: #475569; font-size: 12px; margin-top: 5px; }
    .right { text-align: right; white-space: nowrap; }
    .score { font-weight: 800; color: #0f3b63; }
    .footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 20px; background: white; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    button { border: 0; border-radius: 10px; padding: 10px 16px; font-weight: 800; cursor: pointer; }
    .primary { background: #15803d; color: white; }
    .secondary { background: #e5e7eb; color: #111827; }
    .small { font-size: 12px; color: #64748b; }
    .empty { padding: 18px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; color: #9a3412; }
    input[type="radio"], input[type="checkbox"] { transform: scale(1.2); }

    .confirmOverlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, .45);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .confirmBox {
      width: min(620px, 96vw);
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
      border: 1px solid #dbe3ef;
      overflow: hidden;
      animation: gfpPop .14s ease-out;
    }

    @keyframes gfpPop {
      from { transform: scale(.97); opacity: .4; }
      to { transform: scale(1); opacity: 1; }
    }

    .confirmHead {
      padding: 18px 20px;
      background: #0f3b63;
      color: #ffffff;
    }

    .confirmHead h2 {
      margin: 0 0 4px;
      font-size: 19px;
    }

    .confirmHead p {
      margin: 0;
      opacity: .92;
      font-size: 13px;
    }

    .confirmBody {
      padding: 18px 20px;
    }

    .confirmGrid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 12px 0 16px;
    }

    .confirmMetric {
      border: 1px solid #e5e7eb;
      background: #f8fafc;
      border-radius: 12px;
      padding: 10px;
      text-align: center;
    }

    .confirmMetric strong {
      display: block;
      font-size: 22px;
      color: #0f3b63;
      line-height: 1;
      margin-bottom: 5px;
    }

    .confirmMetric span {
      display: block;
      font-size: 11px;
      color: #64748b;
      font-weight: 700;
    }

    .confirmNotice {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      border-radius: 12px;
      padding: 12px 14px;
      line-height: 1.4;
      font-weight: 600;
      white-space: pre-line;
    }

    .confirmActions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px 18px;
      background: #f8fafc;
      border-top: 1px solid #e5e7eb;
    }

    .confirmCancel {
      background: #e5e7eb;
      color: #111827;
    }

    .confirmOk {
      background: #15803d;
      color: #ffffff;
    }

    .confirmOk.blue {
      background: #0f3b63;
    }

  </style>
</head>
<body>
  <div class="top">
    <h1>↩️ Estornos e Cancelamentos</h1>
    <p>Trata pares, cancelamentos parciais e conjuntos de compensação. Sempre com confirmação humana.</p>
  </div>

  <div class="bar">
    <div>
      <strong>Como o sistema procura?</strong>
      <span class="small"> valor + conta + estabelecimento + data + fatura/cashMonth. Categoria não é critério principal.</span>
    </div>
    <button class="secondary" onclick="reload()">Reanalisar seleção</button>
  </div>

  <div class="wrap" id="content">
    <div class="loading">Analisando seleção...</div>
  </div>

  <div class="footer">
    <div id="summary" class="small">Aguardando análise...</div>
    <div>
      <button class="secondary" onclick="google.script.host.close()">Fechar</button>
      <button class="primary" id="applyBtn" onclick="apply()" disabled>Aplicar decisões</button>
    </div>
  </div>

  <div id="confirmOverlay" class="confirmOverlay">
    <div class="confirmBox">
      <div class="confirmHead">
        <h2>Confirmar aplicação?</h2>
        <p>Revise o resumo antes de alterar os lançamentos selecionados.</p>
      </div>

      <div class="confirmBody">
        <div class="confirmGrid">
          <div class="confirmMetric">
            <strong id="confirmGroups">0</strong>
            <span>Conjuntos</span>
          </div>
          <div class="confirmMetric">
            <strong id="confirmExact">0</strong>
            <span>Totais</span>
          </div>
          <div class="confirmMetric">
            <strong id="confirmPartial">0</strong>
            <span>Parciais</span>
          </div>
          <div class="confirmMetric">
            <strong id="confirmNoPair">0</strong>
            <span>Sem par</span>
          </div>
        </div>

        <div class="confirmNotice">
          O GFP aplicará a categoria neutra 99.14, registrará notas humanas nas linhas e neutralizará os pares/conjuntos aprovados.
        </div>
      </div>

      <div class="confirmActions">
        <button class="confirmCancel" onclick="closeConfirm()">Cancelar</button>
        <button class="confirmOk" onclick="confirmApply()">Sim, aplicar agora</button>
      </div>
    </div>
  </div>

  <div id="resultOverlay" class="confirmOverlay">
    <div class="confirmBox">
      <div class="confirmHead">
        <h2 id="resultTitle">Processo concluído</h2>
        <p id="resultSubtitle">Resumo da operação</p>
      </div>

      <div class="confirmBody">
        <div id="resultMessage" class="confirmNotice"></div>
      </div>

      <div class="confirmActions">
        <button class="confirmOk blue" onclick="closeResultAndExit()">OK, fechar</button>
      </div>
    </div>
  </div>

<script>
let analysis = null;
let pendingDecisions = [];

function money(v) {
  v = Number(v || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

function reload() {
  document.getElementById('content').innerHTML = '<div class="loading">Analisando seleção...</div>';
  document.getElementById('applyBtn').disabled = true;
  document.getElementById('summary').innerText = 'Aguardando análise...';

  google.script.run
    .withSuccessHandler(render)
    .withFailureHandler(function(err) {
      document.getElementById('content').innerHTML = '<div class="empty">Erro ao analisar: ' + esc(err && err.message ? err.message : err) + '</div>';
    })
    .GFP_ESTORNOS_ANALISAR_SELECIONADOS_16_1_17();
}

function groupDecisionValue(g) {
  return JSON.stringify({
    action: 'GROUP',
    mode: 'GROUP_EXACT',
    refundRows: (g.refunds || []).map(r => r.rowNumber),
    matchKeys: (g.purchases || []).map(p => p.key)
  });
}

function render(data) {
  analysis = data;

  if (!data || !data.ok) {
    document.getElementById('content').innerHTML = '<div class="empty">' + esc(data && data.message ? data.message : 'Não foi possível analisar.') + '</div>';
    document.getElementById('summary').innerText = 'Nenhuma decisão disponível.';
    return;
  }

  const groups = data.groups || [];
  const refunds = data.refunds || [];

  if (!refunds.length) {
    document.getElementById('content').innerHTML = '<div class="empty">Nenhuma linha selecionada foi reconhecida para análise.</div>';
    document.getElementById('summary').innerText = 'Nenhuma decisão disponível.';
    return;
  }

  let html = '';

  if (groups.length) {
    html += '<div class="sectionTitle">Conjuntos prováveis encontrados</div>';

    groups.forEach(function(g, idx) {
      const gid = 'group_' + idx;
      const checked = g.recommended ? ' checked' : '';

      html += '<div class="groupBox">';
      html += '<label style="display:flex;gap:10px;align-items:flex-start;">';
      html += '<input type="checkbox" class="groupCheck" id="' + gid + '" value="' + esc(groupDecisionValue(g)) + '"' + checked + '>';
      html += '<div style="flex:1">';
      html += '<div class="title">Conjunto provável — ' + esc(g.root || 'Estorno') + '</div>';
      html += '<div class="meta"><span class="badge bGreen">' + esc(g.modeLabel) + '</span><span class="badge bBlue">' + esc(g.confidenceLabel) + ' · ' + g.score + '%</span></div>';
      html += '<div class="why">Por que sugeri: ' + esc((g.reasons || []).join(', ')) + '.</div>';
      html += '<div class="grid2">';
      html += '<div class="miniList"><strong>Estornos selecionados</strong>';
      (g.refunds || []).forEach(function(r) {
        html += '<div class="miniItem"><span>' + esc(r.dateBr || r.date || '') + ' — ' + esc(r.description) + '</span><span class="money">+' + money(Math.abs(r.value || 0)) + '</span></div>';
      });
      html += '</div>';
      html += '<div class="miniList"><strong>Compras/parcelas encontradas</strong>';
      (g.purchases || []).forEach(function(p) {
        html += '<div class="miniItem"><span>' + esc(p.dateBr || p.date || '') + ' — ' + esc(p.description) + (p.isHistory ? ' <em>(histórico)</em>' : '') + '</span><span class="moneyNeg">-' + money(Math.abs(p.value || 0)) + '</span></div>';
      });
      html += '</div></div>';
      html += '<div class="meta" style="margin-top:8px;"><strong>Total estornos:</strong> +' + money(g.totalRefund) + ' · <strong>Total compras:</strong> -' + money(g.totalPurchases) + ' · <strong>Diferença:</strong> ' + money(g.diff || 0) + '</div>';
      html += '</div></label></div>';
    });
  }

  html += '<div class="sectionTitle">Análise individual das linhas selecionadas</div>';

  refunds.forEach(function(ref, idx) {
    const sel = ref.selected || {};
    const candidates = ref.candidates || [];

    html += '<div class="card" data-refund-row="' + esc(ref.rowNumber) + '">';
    html += '<div class="cardHead">';
    html += '<div><div class="title">Linha selecionada ' + (idx + 1) + ' — ' + esc(sel.description) + '</div>';
    html += '<div class="sub">' + esc(sel.dateBr || sel.date || '') + ' · ' + esc(sel.account || '') + ' · categoria atual: ' + esc(sel.category || 'sem categoria') + '</div>';
    if (ref.alreadyInRecommendedGroup) {
      html += '<div class="meta"><span class="badge bGreen">já incluída em conjunto recomendado</span></div>';
    }
    html += '</div>';
    html += '<div class="money">' + money(Math.abs(sel.value || 0)) + '</div>';
    html += '</div>';
    html += '<div class="candidates">';

    if (candidates.length) {
      candidates.forEach(function(c, cidx) {
        const item = c.candidate || {};
        const css = c.recommended ? ' option recommended' : (c.mode === 'PARTIAL' ? ' option partial' : ' option');
        const checked = c.recommended && !ref.alreadyInRecommendedGroup ? ' checked' : '';

        html += '<label class="' + css + '">';
        html += '<input type="radio" name="refund_' + ref.rowNumber + '" value="' + esc(JSON.stringify({ action: 'LINK', refundRow: ref.rowNumber, matchKey: item.key, mode: c.mode })) + '"' + checked + '>';
        html += '<div>';
        html += '<div>';
        html += '<span class="badge ' + (c.mode === 'EXACT' ? 'bGreen' : 'bOrange') + '">' + esc(c.modeLabel) + '</span>';
        if (c.recommended) html += '<span class="badge bBlue">recomendado</span>';
        if (item.isHistory) html += '<span class="badge bGray">histórico</span>';
        html += '</div>';
        html += '<div class="desc">' + esc(item.description) + '</div>';
        html += '<div class="meta">' + esc(item.dateBr || item.date || '') + ' · ' + esc(item.account || '') + ' · ' + esc(item.category || 'sem categoria') + '</div>';
        html += '<div class="why">Por que sugeri: ' + esc((c.reasons || []).join(', ')) + '.</div>';
        html += '</div>';
        html += '<div class="right"><div class="' + (c.mode === 'PARTIAL' ? 'moneyNeg' : 'money') + '">' + money(Math.abs(item.value || 0)) + '</div><div class="score">' + esc(c.confidenceLabel) + ' · ' + c.score + '%</div></div>';
        html += '</label>';
      });
    } else {
      html += '<div class="empty">Nenhum par provável encontrado. Você pode deixar como pendente sem par e revisar depois.</div>';
    }

    const noneChecked = (!candidates.length && !ref.alreadyInRecommendedGroup) ? ' checked' : '';
    html += '<label class="option none">';
    html += '<input type="radio" name="refund_' + ref.rowNumber + '" value="' + esc(JSON.stringify({ action: 'NO_PAIR', refundRow: ref.rowNumber, matchKey: '', mode: 'NONE' })) + '"' + noneChecked + '>';
    html += '<div><div class="desc">Não vincular agora</div><div class="meta">Marca o estorno como pendente sem par. Nenhuma compra original será alterada.</div></div>';
    html += '<div class="right"><span class="badge bGray">manual</span></div>';
    html += '</label>';

    html += '</div></div>';
  });

  document.getElementById('content').innerHTML = html;
  document.getElementById('summary').innerText = groups.length + ' conjunto(s) sugerido(s) · ' + refunds.length + ' linha(s) selecionada(s). Revise antes de aplicar.';
  document.getElementById('applyBtn').disabled = false;
}

function apply() {
  if (!analysis || !analysis.refunds) return;

  const decisions = [];
  const usedRefundRows = {};

  document.querySelectorAll('.groupCheck:checked').forEach(function(chk) {
    try {
      const d = JSON.parse(chk.value);
      decisions.push(d);
      (d.refundRows || []).forEach(function(r) { usedRefundRows[String(r)] = true; });
    } catch(e) {}
  });

  analysis.refunds.forEach(function(ref) {
    if (usedRefundRows[String(ref.rowNumber)]) return;

    const checked = document.querySelector('input[name="refund_' + ref.rowNumber + '"]:checked');
    if (!checked) return;

    try {
      decisions.push(JSON.parse(checked.value));
    } catch(e) {}
  });

  if (!decisions.length) {
    showSoftMessage('Nenhuma decisão selecionada.');
    return;
  }

  const groups = decisions.filter(d => d.action === 'GROUP').length;
  const exact = decisions.filter(d => d.mode === 'EXACT').length;
  const partial = decisions.filter(d => d.mode === 'PARTIAL').length;
  const noPair = decisions.filter(d => d.action === 'NO_PAIR').length;

  pendingDecisions = decisions;

  document.getElementById('confirmGroups').innerText = groups;
  document.getElementById('confirmExact').innerText = exact;
  document.getElementById('confirmPartial').innerText = partial;
  document.getElementById('confirmNoPair').innerText = noPair;

  document.getElementById('confirmOverlay').style.display = 'flex';
}

function closeConfirm() {
  document.getElementById('confirmOverlay').style.display = 'none';
}

function showSoftMessage(text) {
  const msg = String(text || '').trim();
  if (!msg) return;

  const old = document.getElementById('softMessage');
  if (old) old.remove();

  const div = document.createElement('div');
  div.id = 'softMessage';
  div.style.position = 'fixed';
  div.style.right = '20px';
  div.style.bottom = '78px';
  div.style.zIndex = '10000';
  div.style.background = '#0f3b63';
  div.style.color = '#fff';
  div.style.padding = '12px 16px';
  div.style.borderRadius = '12px';
  div.style.boxShadow = '0 12px 30px rgba(15,23,42,.24)';
  div.style.fontWeight = '700';
  div.innerText = msg;

  document.body.appendChild(div);

  setTimeout(function() {
    try { div.remove(); } catch(e) {}
  }, 2600);
}

function showResultOverlay(title, subtitle, message, isError) {
  document.getElementById('resultTitle').innerText = title || 'Processo concluído';
  document.getElementById('resultSubtitle').innerText = subtitle || 'Resumo da operação';

  const box = document.getElementById('resultMessage');
  box.innerText = String(message || 'Processo concluído.');

  if (isError) {
    box.style.background = '#fef2f2';
    box.style.borderColor = '#fecaca';
    box.style.color = '#991b1b';
  } else {
    box.style.background = '#f0fdf4';
    box.style.borderColor = '#bbf7d0';
    box.style.color = '#166534';
  }

  document.getElementById('resultOverlay').style.display = 'flex';
}

function closeResultAndExit() {
  document.getElementById('resultOverlay').style.display = 'none';
  google.script.host.close();
}

function confirmApply() {
  const decisions = pendingDecisions || [];

  if (!decisions.length) {
    closeConfirm();
    showSoftMessage('Nenhuma decisão selecionada.');
    return;
  }

  closeConfirm();

  document.getElementById('applyBtn').disabled = true;
  document.getElementById('applyBtn').innerText = 'Aplicando...';

  google.script.run
    .withSuccessHandler(function(result) {
      const msg = result && result.message ? result.message : 'Processo concluído.';

      showResultOverlay(
        'Estornos aplicados',
        'O GFP concluiu o tratamento dos lançamentos selecionados.',
        msg,
        false
      );
    })
    .withFailureHandler(function(err) {
      document.getElementById('applyBtn').disabled = false;
      document.getElementById('applyBtn').innerText = 'Aplicar decisões';

      showResultOverlay(
        'Erro ao aplicar',
        'A operação não foi concluída.',
        err && err.message ? err.message : err,
        true
      );
    })
    .GFP_ESTORNOS_APLICAR_DECISOES_16_1_17({ decisions: decisions });
}

reload();
</script>
</body>
</html>
`;
}
