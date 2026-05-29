import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import FirmwareSelector from '../components/FirmwareSelector';
import styles from './index.module.css';

function HomepageHero() {
  return (
    <div className="hero-frangipool">
      <h1>Frangi<span style={{ color: 'var(--ifm-color-primary)' }}>Pool</span></h1>
      <p>
        Firmware ESP32 open-source pour piscine à sel.<br />
        Filtration autonome, électrolyseur, Redox, pH.
      </p>
      <div className="hero-badges">
        <span className="hero-badge">ESP32</span>
        <span className="hero-badge">ESPHome 2024.6+</span>
        <span className="hero-badge">Home Assistant 2024.6+</span>
        <span className="hero-badge">Open Source</span>
      </div>
    </div>
  );
}

function InstallerCard() {
  return (
    <div className="installer-card">
      <h2>Choisir votre configuration et flasher</h2>
      <FirmwareSelector />
    </div>
  );
}

function FeatureGrid() {
  return (
    <div className="features-grid" style={{ maxWidth: '820px', margin: '3rem auto' }}>
      <div className="feature-card">
        <h3>🔄 Filtration autonome</h3>
        <p>L'ESP calcule et gère les horaires de pompe sans aucune action Home Assistant. Antigel intégré.</p>
      </div>
      <div className="feature-card">
        <h3>⚗️ Électrolyseur</h3>
        <p>Contrôle automatique par seuil Redox avec hystérésis. Modes Off / Auto / Forcé.</p>
      </div>
      <div className="feature-card">
        <h3>📊 Redox & pH</h3>
        <p>Capteurs calibrables. Redox pilote l'électrolyseur. pH en lecture continue avec alerte.</p>
      </div>
      <div className="feature-card">
        <h3>💧 Booster</h3>
        <p>Relais surpresseur optionnel pour les configurations avec pompe de boost.</p>
      </div>
    </div>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1rem' }}>
        <HomepageHero />
        <InstallerCard />
        <FeatureGrid />
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <Link className="button button--primary button--lg" to="/docs/getting-started/choisir-son-preset">
            Lire la documentation →
          </Link>
        </div>
      </main>
    </Layout>
  );
}
