import React, { useState, useEffect } from "react";

const SettingsPanel = ({
  isOpen,
  onClose,
  onSave,
  sensitivity,
  musicEnabled,
}) => {
  const [sens, setSens] = useState(sensitivity ?? 1.0);
  const [music, setMusic] = useState(musicEnabled ?? true);

  useEffect(() => {
    setSens(sensitivity ?? 1.0);
    setMusic(musicEnabled ?? true);
  }, [sensitivity, musicEnabled, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(20,20,30,0.82)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#181826",
          borderRadius: 16,
          padding: "36px 32px",
          minWidth: 320,
          boxShadow: "0 8px 32px 0 #18182680",
          color: "#fff",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: "#9c51ff" }}>⚙️ Settings</h2>

        <div style={{ margin: "28px 0" }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 4 }}>
            Mouse/Touch Sensitivity
          </label>
          <input
            type="range"
            min={0.1}
            max={5.0}
            step={0.01}
            value={sens}
            onChange={(e) => setSens(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ textAlign: "right", fontSize: 12, color: "#aaa" }}>
            {sens.toFixed(2)}
          </div>
        </div>

        <div style={{ margin: "24px 0" }}>
          <label style={{ fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={music}
              onChange={(e) => setMusic(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Enable Music
          </label>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 32,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 24px",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              background: "#33334e",
              color: "#fff",
              cursor: "pointer",
              marginRight: 10,
            }}
          >
            Close
          </button>
          <button
            onClick={() => onSave({ sensitivity: sens, musicEnabled: music })}
            style={{
              padding: "8px 24px",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              background: "#9c51ff",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
