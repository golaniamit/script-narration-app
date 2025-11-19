import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { socket } from '../utils/socket';
import Button from '../components/Button';
import Card from '../components/Card';
import FeedbackGraph from '../components/FeedbackGraph';

const NarratorDashboard = () => {
    const [sessionName, setSessionName] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [listeners, setListeners] = useState([]); // Array of { id, name }
    const [isSessionStarted, setIsSessionStarted] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [feedbackData, setFeedbackData] = useState([]);
    const [startTime, setStartTime] = useState(null);
    const [totalPausedTime, setTotalPausedTime] = useState(0);
    const pauseStartTimeRef = useRef(null);

    // Audio Refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // Connection Lifecycle
    useEffect(() => {
        socket.connect();
        return () => {
            socket.disconnect();
        };
    }, []);

    // Event Listeners
    useEffect(() => {
        const onSessionCreated = (id) => setSessionId(id);
        const onListenerUpdate = (userList) => setListeners(userList);

        const onFeedbackUpdate = (data) => {
            // data: { userId, userName, value, timestamp }
            // If we haven't started, ignore (should be handled by server too)
            if (!startTime) return;

            // Calculate relative time in seconds, accounting for pauses
            // If currently paused, we technically shouldn't be getting data, but if we do, map it to the "freeze" point
            let relativeTime;

            if (isPaused && pauseStartTimeRef.current) {
                // If we are paused, any incoming data is effectively at the moment we paused
                relativeTime = (pauseStartTimeRef.current - startTime - totalPausedTime) / 1000;
            } else {
                relativeTime = (data.timestamp - startTime - totalPausedTime) / 1000;
            }

            setFeedbackData(prev => [...prev, { ...data, x: relativeTime }]);
        };

        socket.on('session-created', onSessionCreated);
        socket.on('listener-update', onListenerUpdate);
        socket.on('feedback-update', onFeedbackUpdate);

        return () => {
            socket.off('session-created', onSessionCreated);
            socket.off('listener-update', onListenerUpdate);
            socket.off('feedback-update', onFeedbackUpdate);
        };
    }, [startTime, totalPausedTime, isPaused]);

    const createSession = () => {
        if (!sessionName.trim()) return;
        const newSessionId = Math.random().toString(36).substr(2, 9);
        socket.emit('create-session', { sessionId: newSessionId, sessionName });
    };

    const startSession = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const a = document.createElement('a');
                a.href = audioUrl;
                a.download = `${sessionName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.wav`;
                a.click();
            };

            mediaRecorderRef.current.start();

            // Signal server to start tracking
            socket.emit('start-session');
            setStartTime(Date.now());
            setFeedbackData([]); // Clear previous session data
            setIsSessionStarted(true);
            setIsPaused(false);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please allow permissions.");
        }
    };

    const pauseSession = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            socket.emit('pause-session');
            setIsPaused(true);
            pauseStartTimeRef.current = Date.now();
        }
    };

    const resumeSession = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            socket.emit('resume-session');
            setIsPaused(false);

            // Add the duration of this pause to the total
            if (pauseStartTimeRef.current) {
                const pauseDuration = Date.now() - pauseStartTimeRef.current;
                setTotalPausedTime(prev => prev + pauseDuration);
                pauseStartTimeRef.current = null;
            }
        }
    };

    const stopSession = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsSessionStarted(false);
            setIsPaused(false);
            // We don't necessarily "stop" the session on server, but we stop recording
        }
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Narrator Dashboard</h1>
                {sessionId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: 'var(--success)' }}>● {sessionName}</span>
                        <span style={{ backgroundColor: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '2rem' }}>
                            Listeners: {listeners.length}
                        </span>
                    </div>
                )}
            </header>

            {!sessionId ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                    <Card style={{ textAlign: 'center', maxWidth: '400px' }}>
                        <h2>Start a New Narration</h2>
                        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
                            Enter a name for this session to get started.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="text"
                                placeholder="Session Name (e.g., Story Night)"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--neutral)',
                                    background: 'var(--bg-primary)',
                                    color: 'white'
                                }}
                            />
                            <Button onClick={createSession} disabled={!sessionName.trim()}>Create Session</Button>
                        </div>
                    </Card>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <Card title="Live Feedback">
                            <div style={{ height: '400px', width: '100%', position: 'relative' }}>
                                <FeedbackGraph feedbackData={feedbackData} />
                            </div>
                        </Card>

                        <Card title="Controls">
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                {!isSessionStarted ? (
                                    <Button onClick={startSession}>Start Session & Recording</Button>
                                ) : (
                                    <>
                                        {!isPaused ? (
                                            <Button
                                                onClick={pauseSession}
                                                style={{
                                                    backgroundColor: 'var(--warning)',
                                                    color: 'black',
                                                    border: 'none',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                ❚❚ Pause
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={resumeSession}
                                                style={{
                                                    backgroundColor: 'var(--success)',
                                                    color: 'white',
                                                    border: 'none',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                ▶ Resume
                                            </Button>
                                        )}

                                        <Button
                                            onClick={stopSession}
                                            variant="secondary"
                                            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                        >
                                            ■ Stop
                                        </Button>
                                    </>
                                )}
                                {isSessionStarted && !isPaused && <span className="animate-fade-in" style={{ color: 'var(--danger)', fontWeight: 'bold' }}>● REC</span>}
                                {isPaused && <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>❚❚ PAUSED</span>}
                            </div>
                        </Card>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <Card title="Join Session">
                            <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                                <QRCodeSVG value={`${window.location.origin}/session/${sessionId}`} size={200} />
                            </div>
                            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Scan to join or enter code:</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '2px', margin: '0.5rem 0' }}>
                                    {sessionId}
                                </p>
                            </div>
                        </Card>

                        <Card title="Joined Listeners">
                            {listeners.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No listeners yet...</p>
                            ) : (
                                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {listeners.map((user) => (
                                        <li key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
                                            {user.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NarratorDashboard;
