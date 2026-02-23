import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppNavbar from '../components/AppNavbar';

const features = [
  {
    title: 'Realtime Workspaces',
    description: 'Room-based collaboration with chat, meetings, and file context in a single flow.',
  },
  {
    title: 'Git-Aware Collaboration',
    description: 'Version-aware file editing, snapshots, restore paths, and discussion continuity.',
  },
  {
    title: 'Built-In Execution Surface',
    description: 'Use integrated terminal and code execution workflows without leaving the workspace.',
  },
  {
    title: 'Manager Visibility',
    description: 'Track room activity, participation, and progress with operational clarity.',
  },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="home-page">
      <AppNavbar />

      <section className="home-hero">
        <div className="container-main home-hero__grid">
          <div>
            <p className="home-kicker">Virtual Engineering Collaboration</p>
            <h1 className="home-title">A focused workspace for distributed product teams.</h1>
            <p className="home-subtitle">
              Combine team chat, realtime meetings, file collaboration, and engineering workflow orchestration in one
              platform built for daily use.
            </p>
            <div className="home-cta">
              <Link to={user ? '/groups' : '/signup'} className="btn btn--primary">
                {user ? 'Open Dashboard' : 'Start Free'}
              </Link>
              <Link to="/login" className="btn btn--ghost">Sign In</Link>
            </div>
          </div>

          <aside className="home-proof glass-panel">
            <h2 className="home-proof__title">Team productivity, without context switching</h2>
            <p className="home-proof__copy">Structured for developers, product teams, and engineering leadership.</p>
            <ul className="home-proof__list">
              <li><span className="home-proof__dot" />Realtime meetings with focused call controls</li>
              <li><span className="home-proof__dot" />Terminal, code collaboration, and file preview in-room</li>
              <li><span className="home-proof__dot" />Discussion loops for pull requests and task coordination</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="home-section">
        <div className="container-main">
          <h2 className="home-section__title">Core platform capabilities</h2>
          <p className="home-section__subtitle">
            A calm, high-signal interface with predictable workflows for engineering execution.
          </p>
          <div className="home-feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="home-feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta-band">
        <div className="container-main home-cta-band__inner">
          <h2 className="home-section__title">Ship faster with one collaboration surface</h2>
          <p className="home-section__subtitle home-section__subtitle--center">
            Build rooms by initiative, keep discussions near code, and execute work without losing team context.
          </p>
          <div className="home-cta home-cta--center">
            <Link to={user ? '/groups' : '/signup'} className="btn btn--primary">
              {user ? 'Go to Workspace' : 'Create Workspace'}
            </Link>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="container-main home-footer__inner">
          <span>Realtime Group Platform</span>
          <span>Copyright 2026</span>
        </div>
      </footer>
    </div>
  );
}
