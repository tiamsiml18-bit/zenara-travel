'use client';

import { useState, useCallback } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';

export interface ParsedSheet {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[]; // raw string values, keyed by original header
}

/**
 * Parses in the browser via SheetJS — the file never has to round-trip to
 * the server just to discover its columns, which keeps this step fast and
 * means nothing touches the database until the admin explicitly commits.
 * Dynamically imported so the ~1MB xlsx parser isn't in the initial bundle
 * for anyone who never visits this page.
 */
async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('This file has no sheets.');

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) throw new Error('This file has no readable sheet data.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  if (rows.length === 0) throw new Error('This sheet has no data rows below the header.');

  const firstRow = rows[0];
  if (!firstRow) throw new Error('This sheet has no data rows below the header.');
  const headers = Object.keys(firstRow);
  const stringRows = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const h of headers) out[h] = String(row[h] ?? '').trim();
    return out;
  });

  return { fileName: file.name, headers, rows: stringRows };
}

export function UploadStep({ onParsed }: { onParsed: (sheet: ParsedSheet) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const validExt = /\.(xlsx|xls|csv)$/i.test(file.name);
      if (!validExt) {
        setError('Please upload an .xlsx, .xls, or .csv file.');
        return;
      }
      setIsParsing(true);
      try {
        const parsed = await parseSpreadsheet(file);
        if (parsed.rows.length > 20000) {
          setError(
            `This file has ${parsed.rows.length.toLocaleString()} rows. The importer supports up to 20,000 rows per file — split it into parts.`
          );
          return;
        }
        onParsed(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read this file.');
      } finally {
        setIsParsing(false);
      }
    },
    [onParsed]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          isDragging ? 'border-harbor-500 bg-harbor-50' : 'border-sand-200 bg-white'
        }`}
      >
        {isParsing ? (
          <p className="text-sm text-ink-500">Reading file\u2026</p>
        ) : (
          <>
            <UploadCloud className="mb-3 h-8 w-8 text-ink-500" strokeWidth={1.5} />
            <p className="mb-1 text-sm font-medium text-ink-900">Drag a spreadsheet here, or</p>
            <label className="cursor-pointer text-sm font-medium text-harbor-600 hover:underline">
              browse for a file
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </label>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
              <FileSpreadsheet className="h-3.5 w-3.5" /> .xlsx, .xls, or .csv \u2014 up to 20,000 rows
            </p>
          </>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-coral-600">{error}</p>}
    </div>
  );
}
