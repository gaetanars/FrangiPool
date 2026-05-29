import React, { useState } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useBaseUrl from '@docusaurus/useBaseUrl';

// Déclaration du web component esp-web-install-button pour TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'esp-web-install-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { manifest?: string },
        HTMLElement
      >;
    }
  }
}

interface Preset {
  slug: string;
  label: string;
  features: string[];
}

const PRESETS: Preset[] = [
  { slug: 'erp',  label: 'Électrolyseur + Redox + pH',          features: ['Électrolyseur', 'Redox/ORP', 'pH', 'Auto-régulation'] },
  { slug: 'er',   label: 'Électrolyseur + Redox',               features: ['Électrolyseur', 'Redox/ORP', 'Auto-régulation'] },
  { slug: 'ep',   label: 'Électrolyseur + pH',                  features: ['Électrolyseur', 'pH'] },
  { slug: 'e',    label: 'Électrolyseur seul',                  features: ['Électrolyseur'] },
  { slug: 'berp', label: 'Booster + Électrolyseur + Redox + pH', features: ['Booster', 'Électrolyseur', 'Redox/ORP', 'pH', 'Auto-régulation'] },
  { slug: 'ber',  label: 'Booster + Électrolyseur + Redox',     features: ['Booster', 'Électrolyseur', 'Redox/ORP', 'Auto-régulation'] },
  { slug: 'bep',  label: 'Booster + Électrolyseur + pH',        features: ['Booster', 'Électrolyseur', 'pH'] },
  { slug: 'be',   label: 'Booster + Électrolyseur',             features: ['Booster', 'Électrolyseur'] },
];

function FirmwareSelectorInner() {
  const [selected, setSelected] = useState('erp');
  const manifestBase = useBaseUrl('install');

  return (
    <div>
      <div className="preset-grid">
        {PRESETS.map((preset) => (
          <label
            key={preset.slug}
            className={`preset-option${selected === preset.slug ? ' selected' : ''}`}
            onClick={() => setSelected(preset.slug)}
          >
            <span className="preset-slug">{preset.slug}</span>
            <span>
              <div className="preset-label">{preset.label}</div>
              <div className="preset-features">
                {preset.features.map((f) => (
                  <span key={f} className="preset-feature">{f}</span>
                ))}
              </div>
            </span>
          </label>
        ))}
      </div>

      <div className="install-row">
        <esp-web-install-button manifest={`${manifestBase}/${selected}/manifest.json`}>
          <button slot="activate">⚡ Installer FrangiPool</button>
        </esp-web-install-button>
        <p className="install-note">
          Requiert Chrome ou Edge avec accès USB (Web Serial API) — connectez l'ESP32 avant de cliquer
        </p>
      </div>
    </div>
  );
}

export default function FirmwareSelector(): JSX.Element {
  return (
    <BrowserOnly fallback={<div>Chargement du sélecteur de firmware...</div>}>
      {() => <FirmwareSelectorInner />}
    </BrowserOnly>
  );
}
