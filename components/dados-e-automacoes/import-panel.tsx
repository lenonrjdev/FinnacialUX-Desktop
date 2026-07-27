"use client";

import { useRef, useState } from "react";
import {
  FileIcon,
  ShieldIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import { parseCsvFile, parseOfxFile } from "@/lib/data-tools";
import type {
  CsvField,
  CsvMapping,
  ImportParseResult,
} from "@/types/dados-e-automacoes";

const mappingOptions: Array<{ value: CsvField; label: string }> = [
  { value: "ignore", label: dataToolsContent.import.mappingIgnore },
  { value: "date", label: dataToolsContent.import.mappingDate },
  { value: "description", label: dataToolsContent.import.mappingDescriptionField },
  { value: "amount", label: dataToolsContent.import.mappingAmount },
  { value: "type", label: dataToolsContent.import.mappingType },
  { value: "category", label: dataToolsContent.import.mappingCategory },
  { value: "account", label: dataToolsContent.import.mappingAccount },
];

export function ImportPanel({
  parsed,
  mapping,
  onParsed,
  onMappingChange,
  onClear,
}: {
  parsed: ImportParseResult | null;
  mapping: CsvMapping;
  onParsed: (result: ImportParseResult) => void;
  onMappingChange: (header: string, field: CsvField) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function readFile(file: File) {
    const extension = file.name.split(".").pop()?.toLocaleLowerCase("pt-BR");
    if (extension !== "csv" && extension !== "ofx") {
      setError(dataToolsContent.import.invalidFile);
      return;
    }
    setReading(true);
    setError("");
    try {
      const text = await file.text();
      const result = extension === "ofx" ? parseOfxFile(text, file.name) : parseCsvFile(text, file.name);
      if (!result.records.length) {
        setError(dataToolsContent.import.emptyFile);
        return;
      }
      onParsed(result);
    } catch {
      setError(dataToolsContent.import.invalidFile);
    } finally {
      setReading(false);
    }
  }

  return (
    <section className="data-tool-panel import-panel">
      <header className="data-tool-panel-header">
        <div>
          <span className="section-eyebrow">{dataToolsContent.views.import}</span>
          <h2>{dataToolsContent.import.title}</h2>
          <p>{dataToolsContent.import.description}</p>
        </div>
        <span className="data-tool-panel-icon"><UploadIcon /></span>
      </header>

      {!parsed ? (
        <div
          className={`file-drop-zone ${dragging ? "dragging" : ""}`}
          aria-label={dataToolsContent.accessibility.upload}
          onDragEnter={(event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event: React.DragEvent<HTMLDivElement>) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void readFile(file);
          }}
        >
          <span><FileIcon /></span>
          <strong>{dataToolsContent.import.dropTitle}</strong>
          <p>{dataToolsContent.import.dropHelper}</p>
          <button className="secondary-action-button" type="button" onClick={() => inputRef.current?.click()} disabled={reading}>
            <UploadIcon />
            {reading ? dataToolsContent.import.reading : dataToolsContent.import.chooseFile}
          </button>
          <small>{dataToolsContent.import.accepted}</small>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.ofx,text/csv,application/x-ofx"
            hidden
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      ) : (
        <div className="selected-import-file">
          <span className="selected-import-file-icon"><FileIcon /></span>
          <div>
            <small>{dataToolsContent.import.sourceFile}</small>
            <strong>{parsed.fileName}</strong>
            <p>{dataToolsContent.sourceTypes[parsed.sourceType]} · {parsed.records.length} {dataToolsContent.import.detectedRows}</p>
          </div>
          <button type="button" onClick={onClear}>
            <TrashIcon />
            {dataToolsContent.import.clear}
          </button>
        </div>
      )}

      {error ? <p className="data-tools-error">{error}</p> : null}

      {parsed?.sourceType === "csv" ? (
        <div className="column-mapping-section">
          <div className="data-tool-subheading">
            <div>
              <h3>{dataToolsContent.import.mappingTitle}</h3>
              <p>{dataToolsContent.import.mappingDescription}</p>
            </div>
          </div>
          <div className="column-mapping-grid">
            {parsed.headers.map((header) => (
              <label key={header}>
                <span>{header}</span>
                <select value={mapping[header] ?? "ignore"} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onMappingChange(header, event.target.value as CsvField)}>
                  {mappingOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <footer className="import-privacy-note">
        <ShieldIcon />
        <p>{dataToolsContent.import.privacy}</p>
      </footer>
    </section>
  );
}
