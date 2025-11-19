import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import NarratorDashboard from './pages/NarratorDashboard';
import ListenerView from './pages/ListenerView';
import './styles/index.css';

function Home() {
    return (
        <div className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', background: 'linear-gradient(to right, #6366f1, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Script Narration
            </h1>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <Link to="/narrator" className="btn btn-primary">
                    I am the Narrator
                </Link>
                {/* Listener link is usually via QR, but for dev/testing: */}
                <Link to="/listener" className="btn" style={{ backgroundColor: 'var(--bg-card)', color: 'white' }}>
                    Join as Listener
                </Link>
            </div>
        </div>
    );
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/narrator" element={<NarratorDashboard />} />
                <Route path="/listener" element={<ListenerView />} />
                <Route path="/session/:sessionId" element={<ListenerView />} />
            </Routes>
        </Router>
    );
}

export default App;
