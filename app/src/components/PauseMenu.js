import React from 'react';
import './PauseMenu.css';

function PauseMenu({ onResume, onQuit }) {
  return (
    <div className="pause-menu-overlay">
      <div className="pause-menu">
        <div className="pause-menu-header">
          <h1 className="pause-menu-title">PAUSED</h1>
          <p className="pause-menu-subtitle">Game is paused. Press ESC to resume.</p>
        </div>

        <div className="pause-menu-actions">
          <button className="pause-btn pause-btn-primary" onClick={onResume}>
            Resume Game
          </button>
          <button className="pause-btn pause-btn-danger" onClick={onQuit}>
            Quit to Lobby
          </button>
        </div>

        <div className="pause-menu-hint">
          <p>Press <span className="key-hint">ESC</span> to resume</p>
        </div>
      </div>
    </div>
  );
}

export default PauseMenu;
