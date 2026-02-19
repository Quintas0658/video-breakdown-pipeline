"use client";

import { useState, useEffect } from "react";
import type { Persona } from "@/lib/types";
import { fetchPersonas } from "@/lib/api";

interface UrlInputProps {
  onLoad: (url: string, persona: string) => void;
  isLoading: boolean;
}

export default function UrlInput({ onLoad, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState("外贸小白");

  useEffect(() => {
    fetchPersonas()
      .then((data) => {
        setPersonas(data.personas);
        if (data.personas.length > 0) {
          setSelectedPersona(data.personas[0].name);
        }
      })
      .catch(() => {
        // Backend not available yet, use default
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onLoad(url.trim(), selectedPersona);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "14px 24px",
        borderBottom: "1px solid #e8dfd6",
        background: "#fdfcfb",
        position: "relative",
        zIndex: 1,
      }}
    >
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste YouTube URL..."
        className="input-glow"
        style={{
          flex: 1,
          padding: "9px 14px",
          borderRadius: "8px",
          border: "1px solid #e8dfd6",
          background: "#ffffff",
          color: "#3a3229",
          fontSize: "13px",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={(e) => { e.target.style.borderColor = "#d9a88f"; }}
        onBlur={(e) => { e.target.style.borderColor = "#e8dfd6"; }}
      />
      {personas.length > 0 && (
        <select
          value={selectedPersona}
          onChange={(e) => setSelectedPersona(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid #e8dfd6",
            background: "#ffffff",
            color: "#8b7e70",
            fontSize: "13px",
            outline: "none",
            cursor: "pointer",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#d9a88f"; }}
          onBlur={(e) => { e.target.style.borderColor = "#e8dfd6"; }}
        >
          {personas.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="submit"
        disabled={isLoading || !url.trim()}
        style={{
          padding: "9px 20px",
          borderRadius: "8px",
          background: isLoading || !url.trim() ? "#e8dfd6" : "#d9a88f",
          color: isLoading || !url.trim() ? "#bfb5a8" : "#ffffff",
          fontSize: "13px",
          fontWeight: 500,
          border: "none",
          cursor: isLoading || !url.trim() ? "not-allowed" : "pointer",
          transition: "background 0.15s, color 0.15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (!isLoading && url.trim()) {
            (e.target as HTMLElement).style.background = "#c9997f";
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading && url.trim()) {
            (e.target as HTMLElement).style.background = "#d9a88f";
          }
        }}
      >
        {isLoading ? "Loading…" : "Load"}
      </button>
    </form>
  );
}
