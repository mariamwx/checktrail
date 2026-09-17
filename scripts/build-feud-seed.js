const fs = require("fs");
const path = require("path");

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function esc(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''");
}

function loadDeck(filePath, version) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCSV(text);
  const header = rows[0].map((h) => h.trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length < 7) continue;
    const idNum = String(cols[0] || "").trim();
    if (!idNum) continue;
    const theme = cols[1] || "";
    const prompt = cols[2] || "";
    const answers = [cols[3], cols[4], cols[5], cols[6]].map((a) =>
      String(a || "").trim()
    );
    if (!prompt || answers.some((a) => !a)) continue;
    out.push({
      id: `${version}-${idNum}`,
      prompt,
      theme,
      answers,
      sort_order: Number(idNum) || r,
      version,
    });
  }
  return out;
}

const classic = loadDeck(
  "c:/Users/HP/Downloads/beyond_periphery_200_family_feud_questions.csv",
  "classic"
);
const funny = loadDeck(
  "c:/Users/HP/Downloads/beyond_periphery_200_funny_family_feud_questions.csv",
  "funny"
);
const all = [...classic, ...funny];

console.log(`classic=${classic.length} funny=${funny.length}`);

const values = all
  .map((q) => {
    const answersSql = `ARRAY[${q.answers.map((a) => `'${esc(a)}'`).join(",")}]::text[]`;
    return `('${esc(q.id)}','${esc(q.prompt)}','${esc(q.theme)}',${answersSql},${q.sort_order},'${q.version}')`;
  })
  .join(",\n");

const sql = `-- Auto-generated Feud question seed
truncate category_three.question_bank;
insert into category_three.question_bank (id, prompt, theme, answers, sort_order, version)
values
${values};
`;

const outPath = path.join(__dirname, "feud-seed.sql");
fs.writeFileSync(outPath, sql, "utf8");
console.log(`wrote ${outPath} (${sql.length} chars)`);
