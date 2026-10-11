export const exportToCSV = (rows, filename, headers) => {
  const csvRows = [];

  if (headers && headers.length > 0) {
    csvRows.push(headers.map((h) => `"${h}"`).join(","));
  }

  rows.forEach((row) => {
    const values = headers && headers.length > 0
      ? headers.map((h) => {
          const val = typeof row[h] === "object" ? JSON.stringify(row[h]) : (row[h] ?? "");
          return `"${String(val).replace(/"/g, '""')}"`;
        })
      : Object.values(row).map((v) => {
          const val = typeof v === "object" ? JSON.stringify(v) : (v ?? "");
          return `"${String(val).replace(/"/g, '""')}"`;
        });
    csvRows.push(values.join(","));
  });

  const csv = csvRows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};