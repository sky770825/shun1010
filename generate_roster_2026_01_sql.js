const fs = require("fs");
const path = require("path");

// 絕對路徑：1 月的排班 CSV
const csvPath = "/Users/caijunchang/Downloads/排班表_2026-01.csv";

const raw = fs.readFileSync(csvPath, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

// 解析 CSV（簡單逗號切割，因為內容沒有逗號）
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(",");
  if (cols.length < 8) continue;
  const [, yearMonth, , dayStr, shiftName, memberId] = cols;
  if (yearMonth !== "2026-01") continue;
  const day = parseInt(dayStr, 10);
  if (!day || day < 1 || day > 31) continue;

  const dateStr = `2026-01-${String(day).padStart(2, "0")}`;
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay(); // 0=Sun .. 6=Sat
  const isWeekend = dow === 0 || dow === 6;

  let slotCode;
  if (shiftName === "早班") {
    slotCode = isWeekend ? "WE_AM" : "WD_AM";
  } else if (shiftName === "中班") {
    // 中班只在假日使用
    slotCode = "WE_MD";
  } else if (shiftName === "晚班") {
    slotCode = isWeekend ? "WE_PM" : "WD_PM";
  } else {
    continue;
  }

  rows.push({ dateStr, slotCode, memberId: memberId.padStart(2, "0") });
}

if (rows.length === 0) {
  console.error("No valid rows parsed from CSV.");
  process.exit(1);
}

// 產生 SQL：upsert 到 roster_slots
let sql = `
INSERT INTO public.roster_slots (date, slot_code, assignee_id, is_substitute, original_assignee_id, status)
VALUES
`;

sql += rows
  .map(
    (r) =>
      `  ('${r.dateStr}', '${r.slotCode}', '${r.memberId}', false, NULL, 'final')`
  )
  .join(",\n");

sql += `
ON CONFLICT (date, slot_code)
DO UPDATE SET
  assignee_id = EXCLUDED.assignee_id,
  status = EXCLUDED.status,
  updated_at = now();
`;

process.stdout.write(sql);

