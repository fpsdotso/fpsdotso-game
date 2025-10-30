import React, { useEffect, useState, useCallback } from "react";

export default function SettingsOverlay({ open, onClose, gameBridge }) {
  const [sens, setSens] = useState(0.01);

  useEffect(() => {
    if (!open) return;
    const current = gameBridge?.getMouseSensitivity?.() ?? 0.01;
    setSens(current);
  }, [open, gameBridge]);

  const handleBackgroundClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose]
  );

  if (!open) return null;

  const min = 0.002;
  const max = 0.06;

  return (
    <div
      onClick={handleBackgroundClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 460,
          background: "rgba(25,25,35,0.95)",
          border: "2px solid rgba(156,81,255,0.6)",
          borderRadius: 12,
          padding: 24,
          color: "#fff",
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ fontSize: 20, color: "#9c51ff", marginBottom: 16 }}>
          SETTINGS
        </div>

        <div style={{ marginBottom: 8, color: "#c8c8dc" }}>Mouse Sensitivity</div>
        <input
          type="range"
          min={min}
          max={max}
          step={0.001}
          value={sens}
          onChange={(e) => setSens(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ marginTop: 6, fontFamily: "monospace" }}>{sens.toFixed(4)}</div>

        <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "#3b3b4d",
              border: "1px solid #767694",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              gameBridge?.setMouseSensitivity?.(sens);
              onClose?.();
            }}
            style={{
              background: "#00f294",
              border: "1px solid #00c07a",
              color: "#000",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}


