/**
 * 📂 ARQUIVO: 1_CORE/core_import.gs
 * 🏦 MÓDULO: ORQUESTRADOR DE IMPORTAÇÃO CSV
 * 🔢 VERSÃO: 15.1 (PICPAY CONTA CSV)
 * 📅 DATA: 07/06/2026
 * 📝 RESUMO:
 * - Atua como Dispatcher: identifica o banco/conta e chama o processador específico.
 * - Suporta Mercado Pago, Conta PicPay e Inter.
 * - Garante passagem do rawLine para o pipeline principal.
 */

function coreImportPipeline(payload) {
  const functionName = "coreImportPipeline";
  Logger.log(`[START] ${functionName}: Iniciando Pipeline CSV V15.1...`, functionName);

  if (!payload || typeof payload !== "object") payload = {};
  if (!payload.raw) payload.raw = [];
  if (!payload.context) payload.context = { filesProcessed: [] };
  if (!payload.warnings) payload.warnings = [];
  if (!payload.errors) payload.errors = [];
  if (!payload.meta) payload.meta = {};

  return runImportFromDrive(payload);
}


function runImportFromDrive(payload) {
  const functionName = "runImportFromDrive";

  try {
    const folderId = PROJECT_CONFIG.FOLDER_ID_IMPORTS;
    const files = listCsvFilesByExtension(folderId);

    if (files.length === 0) {
      Logger.log(`[INFO] ${functionName}: Nenhum arquivo CSV encontrado.`, functionName);
      return payload;
    }

    files.forEach(file => {
      const fileName = file.name;

      try {
        const blob = DriveApp.getFileById(file.id).getBlob();
        const content = blob.getDataAsString("UTF-8");

        const bankName = detectBankFromFile(fileName, content);

        if (!bankName) {
          Logger.warn(`[SKIP] '${fileName}' ignorado (banco desconhecido).`, functionName);
          return;
        }

        let rows = [];

        if (bankName === "PICPAY_CONTA") {
          if (typeof processModulePicPayConta === "function") {
            rows = processModulePicPayConta(content);
          } else {
            throw new Error("Módulo processModulePicPayConta não encontrado. Crie o arquivo 2_MOD/conta_picpay.gs.");
          }

        } else if (bankName === "MERCADOPAGO") {
          rows = processModuleMercadoPago(content, ";");

        } else if (bankName === "INTER") {
          rows = parseGeneric(Utilities.parseCsv(content, ","), "Banco Inter");

        } else {
          rows = parseGeneric(Utilities.parseCsv(content, ","), bankName);
        }

        if (rows.length > 0) {
          rows.forEach(r => {
            payload.raw.push({
              data: r.data,
              desc: r.desc,
              value: r.value,
              type: r.type,
              account: r.account,
              category: r.category || "",
              installments: r.installments || { current: 1, total: 1 },
              rawLine: r.rawLine || JSON.stringify(r),
              _meta: {
                fileId: file.id,
                fileName: fileName,
                bankName: bankName,
                origin: `CSV_IMPORT_V15.1_${bankName}`
              }
            });
          });

          payload.context.filesProcessed.push({
            name: fileName,
            bankName: bankName,
            count: rows.length
          });

          Logger.log(`[SUCCESS] Importado '${fileName}' (${bankName}) - ${rows.length} lançamentos.`, functionName);

        } else {
          Logger.warn(`[WARN] Arquivo '${fileName}' processado mas retornou 0 linhas.`, functionName);
        }

      } catch (innerError) {
        Logger.error(`[ERROR] Falha ao processar arquivo '${fileName}': ${innerError.message}`, functionName);
        payload.errors.push(`Erro em '${fileName}': ${innerError.message}`);
      }
    });

    payload.meta.coreImport = {
      executed: true,
      timestamp: new Date(),
      count: payload.raw.length
    };

  } catch (e) {
    Logger.error(`[CRITICAL] Erro fatal no Drive (core_import).`, functionName, e);
    payload.errors.push(`Erro Fatal Importação: ${e.message}`);
  }

  return payload;
}


// --- PARSERS LEGADOS / GENÉRICOS ---
function parseGeneric(csvData, accName) {
  const out = [];

  for (let i = 1; i < csvData.length; i++) {
    const c = csvData[i];

    if (c.length < 2) continue;

    let valIdx = c.length - 1;
    let v = String(c[valIdx]).replace("R$", "").replace(",", ".");
    const numV = parseFloat(v);

    if (isNaN(numV)) continue;

    const reconstructed = c.join(",");

    out.push({
      data: c[0],
      desc: c[1] || "Genérico",
      value: Math.abs(numV),
      type: numV < 0 ? "D" : "C",
      account: accName,
      rawLine: reconstructed
    });
  }

  return out;
}


// --- HELPERS ---

function detectBankFromFile(fileName, content) {
  const n = String(fileName || "").toLowerCase();
  const head = String(content || "").slice(0, 1500).toUpperCase();

  // Conta PicPay exportada em CSV:
  // data,hora,tipo,"origem / destino",valor,"forma de pagamento"
  if (
    (n.includes("picpay") && n.includes("extrato")) ||
    (
      head.includes("DATA") &&
      head.includes("HORA") &&
      head.includes("TIPO") &&
      head.includes("ORIGEM / DESTINO") &&
      head.includes("FORMA DE PAGAMENTO")
    )
  ) {
    return "PICPAY_CONTA";
  }

  if (n.includes("account_statement") || n.includes("mp_") || n.includes("mercado")) {
    return "MERCADOPAGO";
  }

  if (head.includes("RELEASE_DATE") || head.includes("INITIAL_BALANCE")) {
    return "MERCADOPAGO";
  }

  if (n.includes("inter") || n.includes("bancointer")) {
    return "INTER";
  }

  return null;
}


function listCsvFilesByExtension(folderId) {
  const out = [];
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();

  while (files.hasNext()) {
    const f = files.next();

    if (f.getName().toLowerCase().endsWith(".csv")) {
      out.push({ id: f.getId(), name: f.getName() });
    }
  }

  return out;
}
