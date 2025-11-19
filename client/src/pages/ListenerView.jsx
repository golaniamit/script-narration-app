import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { socket } from '../utils/socket';
import FeedbackDial from '../components/FeedbackDial';
import Card from '../components/Card';
import Button from '../components/Button';

const ListenerView = () => {
    const { sessionId: urlSessionId } = useParams();
    const navigate = useNavigate();
    const [sessionId, setSessionId] = useState(urlSessionId || '');
    const [manualSessionId, setManualSessionId] = useState('');
    const [userName, setUserName] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState('');

    // Throttling feedback to avoid flooding the server
    const lastFeedbackTime = useRef(0);

    useEffect(() => {
        socket.on('session-joined', (data) => {
            setSessionName(data.sessionName || 'Session');
            setIsConnected(true);
            setError('');
        });

        socket.on('error', (msg) => {
            setError(msg);
            setIsConnected(false);
        });

        return () => {
            socket.off('session-joined');
            socket.off('error');
            socket.disconnect();
        };
    }, []);

    const joinSession = () => {
        const targetSessionId = sessionId || manualSessionId;
        if (!targetSessionId || !userName.trim()) {
            setError('Please enter both Session ID and your Name');
            return;
        }
        socket.connect();
        socket.emit('join-session', { sessionId: targetSessionId, userName });
    };

    const handleFeedback = (value) => {
        const now = Date.now();
        // Limit updates to every 100ms
        if (now - lastFeedbackTime.current > 100) {
            socket.emit('feedback', { value, timestamp: now });
            lastFeedbackTime.current = now;
        }
    };

    return (
        <div className="container" style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '1rem'
        }}>
            {!isConnected ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <Card style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                        <h2>Join Session</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            {!sessionId && (
                                <input
                                    type="text"
                                    placeholder="Session ID"
                                    value={manualSessionId}
                                    onChange={(e) => setManualSessionId(e.target.value)}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid var(--neutral)',
                                        background: 'var(--bg-primary)',
                                        color: 'white'
                                    }}
                                />
                            )}
                            <input
                                type="text"
                                placeholder="Your Name"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--neutral)',
                                    background: 'var(--bg-primary)',
                                    color: 'white'
                                }}
                            />
                            <Button onClick={joinSession} disabled={(!sessionId && !manualSessionId) || !userName.trim()}>
                                Join
                            </Button>
                        </div>
                        {error && <div style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</div>}
                    </Card>
                </div>
            ) : (
                <>
                    <header style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                        flexShrink: 0
                    }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{sessionName}</h2>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{userName}</span>
                        </div>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: 'var(--success)',
                            boxShadow: '0 0 10px var(--success)'
                        }} />
                    </header>

                    <div style={{ flex: 1, position: 'relative' }}>
                        <FeedbackDial onFeedbackChange={handleFeedback} />
                    </div>
                </>
            )}
        </div>
    );
};

export default ListenerView;
