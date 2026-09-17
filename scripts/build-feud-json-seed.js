const fs = require("fs");

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

function loadDeck(filePath, version) {
  const rows = parseCSV(fs.readFileSync(filePath, "utf8"));
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length < 7) continue;
    const idNum = String(cols[0] || "").trim();
    if (!idNum) continue;
    const answers = [cols[3], cols[4], cols[5], cols[6]].map((a) =>
      String(a || "").trim()
    );
    const prompt = cols[2] || "";
    if (!prompt || answers.some((a) => !a)) continue;
    out.push({
      id: `${version}-${idNum}`,
      prompt,
      theme: cols[1] || "",
      answers,
      sort_order: Number(idNum) || r,
      version,
    });
  }
  return out;
}

const all = [
  ...loadDeck(
    "c:/Users/HP/Downloads/beyond_periphery_200_family_feud_questions.csv",
    "classic"
  ),
  ...loadDeck(
    "c:/Users/HP/Downloads/beyond_periphery_200_funny_family_feud_questions.csv",
    "funny"
  ),
];

const size = 50;
for (let i = 0; i < all.length; i += size) {
  const chunk = all.slice(i, i + size);
  const json = JSON.stringify(chunk).replace(/'/g, "''");
  const sql = `insert into category_three.question_bank (id, prompt, theme, answers, sort_order, version)
select r->>'id', r->>'prompt', r->>'theme', array(select jsonb_array_elements_text(r->'answers')), (r->>'sort_order')::int, r->>'version'
from jsonb_array_elements('${json}'::jsonb) r;`;
  const n = i / size;
  fs.writeFileSync(
    `c:/Users/HP/Downloads/check/scripts/feud-json-${String(n).padStart(2, "0")}.sql`,
    sql
  );
  console.log("chunk", n, "bytes", sql.length);
}
