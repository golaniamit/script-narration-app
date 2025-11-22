import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { socket } from '../utils/socket';
import Button from '../components/Button';
import Card from '../components/Card';
import FeedbackGraph from '../components/FeedbackGraph';
import WaveformPlayer from '../components/WaveformPlayer';

const NarratorDashboard = () => {
    const [sessionName, setSessionName] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [listeners, setListeners] = useState([]); // Array of { id, name }
    const [isSessionStarted, setIsSessionStarted] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [feedbackData, setFeedbackData] = useState([]);
    const [startTime, setStartTime] = useState(null);
    const [totalPausedTime, setTotalPausedTime] = useState(0);

    const [isReviewing, setIsReviewing] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(50); // Pixels per second
    const [duration, setDuration] = useState(0);

    // Graph Controls
    const [visibleUserIds, setVisibleUserIds] = useState(new Set());
    const [showAverage, setShowAverage] = useState(true);

    const playerRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const scrollContainerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const scrollIntervalRef = useRef(null);

    // Auto-scroll logic
    useEffect(() => {
        const handleWindowMouseMove = (e) => {
            if (!isDragging || !scrollContainerRef.current) return;

            const { clientX } = e;
            const containerRect = scrollContainerRef.current.getBoundingClientRect();

            const edgeThreshold = 100; // px from container edge to trigger scroll
            const scrollSpeed = 20; // px per interval

            // Clear existing interval
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }

            // Scroll Left if near left edge of container (or to the left of it)
            if (clientX < containerRect.left + edgeThreshold) {
                scrollIntervalRef.current = setInterval(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollLeft = Math.max(0, scrollContainerRef.current.scrollLeft - scrollSpeed);
                    }
                }, 16);
            }
            // Scroll Right if near right edge of container (or to the right of it)
            else if (clientX > containerRect.right - edgeThreshold) {
                scrollIntervalRef.current = setInterval(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollLeft += scrollSpeed;
                    }
                }, 16);
            }
        };

        const handleWindowMouseUp = () => {
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
            }
        };
    }, [isDragging]);

    const handleDragStart = () => setIsDragging(true);
    const handleDragEnd = () => setIsDragging(false);

    useEffect(() => {
        const updateWidth = () => {
            if (scrollContainerRef.current) {
                setContainerWidth(scrollContainerRef.current.clientWidth);
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [isReviewing]); // Update when entering review mode

    // Initialize visibleUserIds when entering review mode
    useEffect(() => {
        if (isReviewing && feedbackData.length > 0) {
            // Only set if empty (to preserve manual toggles if any, though usually reset on new session)
            // Actually, for a fresh review, we want to show all.
            // Since isReviewing flips once, this is safe.
            setVisibleUserIds(new Set(feedbackData.map(d => d.userId)));
        }
    }, [isReviewing, feedbackData]);

    const getMinZoom = () => {
        if (!duration || !containerWidth) return 10;
        return containerWidth / duration;
    };

    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(200, prev + 10));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(getMinZoom(), prev - 10));
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    const pauseStartTimeRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // Graph Polish Refs
    const lastFeedbackTimeRef = useRef({});
    const lastFeedbackValueRef = useRef({});
    const listenersRef = useRef([]); // Keep track of listeners for heartbeat

    // Connection Lifecycle

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
        const onListenerUpdate = (userList) => {
            setListeners(userList);
            listenersRef.current = userList;
        };

        const onFeedbackUpdate = (data) => {
            // data: { userId, userName, value, timestamp }
            if (!startTime) return;

            const now = Date.now();
            let relativeTime;

            if (isPaused && pauseStartTimeRef.current) {
                relativeTime = (pauseStartTimeRef.current - startTime - totalPausedTime) / 1000;
            } else {
                // Use arrival time (now) instead of sender time (data.timestamp) to avoid clock skew
                relativeTime = (now - startTime - totalPausedTime) / 1000;
            }

            setFeedbackData(prev => {
                const newData = [...prev];

                // Fix Start Gap: If first point and late, backfill 0 at t=0
                if (!lastFeedbackTimeRef.current[data.userId] && relativeTime > 0.1) {
                    newData.push({ ...data, x: 0, value: 0 });
                }

                newData.push({ ...data, x: relativeTime });
                return newData;
            });

            // Update Refs
            lastFeedbackTimeRef.current[data.userId] = Date.now();
            lastFeedbackValueRef.current[data.userId] = {
                value: data.value,
                userName: data.userName
            };
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

    // Heartbeat for Fluid Graph (fills in gaps when value is constant)
    useEffect(() => {
        if (!isSessionStarted || isPaused) return;

        const interval = setInterval(() => {
            const now = Date.now();

            // Check all active listeners who have sent data at least once
            Object.entries(lastFeedbackTimeRef.current).forEach(([userId, lastTime]) => {
                // If no update for > 150ms (allow slight buffer over 100ms interval)
                if (now - lastTime > 150) {
                    const lastData = lastFeedbackValueRef.current[userId];
                    if (!lastData) return;

                    let relativeTime;
                    if (isPaused && pauseStartTimeRef.current) {
                        relativeTime = (pauseStartTimeRef.current - startTime - totalPausedTime) / 1000;
                    } else {
                        relativeTime = (now - startTime - totalPausedTime) / 1000;
                    }

                    // Add a "heartbeat" point
                    setFeedbackData(prev => [...prev, {
                        userId,
                        userName: lastData.userName,
                        value: lastData.value,
                        x: relativeTime,
                        timestamp: now
                    }]);

                    // Update last time so we don't spam (wait another cycle)
                    lastFeedbackTimeRef.current[userId] = now;
                }
            });
        }, 100);

        return () => clearInterval(interval);
    }, [isSessionStarted, isPaused, startTime, totalPausedTime]);

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
                const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                setIsReviewing(true);
                setIsSessionStarted(false);
                setIsPaused(false);
            };

            mediaRecorderRef.current.start();

            socket.emit('start-session');
            setStartTime(Date.now());
            setFeedbackData([]);
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
        }
    };

    const handleSeek = (time) => {
        setCurrentPlaybackTime(time);
        if (playerRef.current) {
            playerRef.current.seekTo(time);
        }
    };

    const handleWaveformSeek = (time) => {
        setCurrentPlaybackTime(time);
    };

    const handleWaveformTimeUpdate = (time) => {
        setCurrentPlaybackTime(time);
        if (playerRef.current) {
            setIsPlaying(playerRef.current.isPlaying);
        }
    };

    const downloadRecording = () => {
        if (audioUrl) {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = `${sessionName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.wav`;
            a.click();
        }
    };

    const handleSaveSession = async () => {
        if (!audioUrl) return;

        try {
            // 1. Get Audio Blob
            const response = await fetch(audioUrl);
            const blob = await response.blob();

            // 2. Convert to Base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64Audio = reader.result;

                // 3. Create Session Object
                const sessionData = {
                    metadata: {
                        name: sessionName,
                        date: new Date().toISOString(),
                        duration: duration
                    },
                    feedbackData: feedbackData,
                    audioData: base64Audio
                };

                // 4. Download JSON
                const jsonString = JSON.stringify(sessionData);
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = `${sessionName.replace(/\s+/g, '_')}_savefile.json`;
                a.click();
                URL.revokeObjectURL(url);
            };
        } catch (e) {
            console.error("Error saving session:", e);
            alert("Failed to save session.");
        }
    };

    const handleLoadSession = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const sessionData = JSON.parse(e.target.result);

                // 1. Restore Metadata
                setSessionName(sessionData.metadata.name || "Loaded Session");
                setDuration(sessionData.metadata.duration || 0);

                // 2. Restore Feedback
                const loadedFeedback = sessionData.feedbackData || [];
                setFeedbackData(loadedFeedback);

                // Initialize visible users
                const users = new Set(loadedFeedback.map(d => d.userId));
                setVisibleUserIds(users);

                // 3. Restore Audio
                const res = await fetch(sessionData.audioData);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                // 4. Set State
                setIsReviewing(true);
                setIsSessionStarted(false);
                setSessionId("OFFLINE_REVIEW"); // Set truthy value to bypass "Create Session" screen

            } catch (err) {
                console.error("Error loading session:", err);
                alert("Invalid session file.");
            }
        };
        reader.readAsText(file);
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0', color: 'var(--text-secondary)' }}>
                                <div style={{ flex: 1, height: '1px', background: 'var(--neutral)' }}></div>
                                <span>OR</span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--neutral)' }}></div>
                            </div>

                            <label style={{
                                display: 'block',
                                textAlign: 'center',
                                padding: '0.75rem',
                                border: '1px dashed var(--neutral)',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                color: 'var(--text-accent)'
                            }}>
                                📂 Load Saved Session
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleLoadSession}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    </Card>
                </div>
            ) : isReviewing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <Card title="Session Review">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ color: 'var(--primary)' }}>{sessionName} - Recording Review</h3>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                {/* Playback Controls */}
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#1e293b', padding: '0.25rem 0.5rem', borderRadius: '2rem' }}>
                                    <button
                                        onClick={() => playerRef.current?.playPause()}
                                        style={{ background: isPlaying ? 'var(--warning)' : 'var(--success)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {isPlaying ? '❚❚' : '▶'}
                                    </button>
                                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.9rem', minWidth: '100px', textAlign: 'center' }}>
                                        {formatTime(currentPlaybackTime)} / {formatTime(duration)}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Zoom</span>
                                    <button onClick={handleZoomOut} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>-</button>
                                    <span style={{ color: 'white', minWidth: '30px', textAlign: 'center' }}>{Math.round(zoomLevel)}</span>
                                    <button onClick={handleZoomIn} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>+</button>
                                </div>
                                <Button onClick={handleSaveSession} style={{ background: 'var(--primary)', border: 'none' }}>💾 Save Session</Button>
                                <Button onClick={downloadRecording} variant="secondary">Download Audio</Button>
                            </div>
                        </div>

                        {/* Graph Controls */}
                        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#1e293b', borderRadius: '0.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', marginRight: '0.5rem' }}>Filters:</span>
                                {Array.from(new Set(feedbackData.map(d => d.userId))).map((userId, index) => {
                                    const userName = feedbackData.find(d => d.userId === userId)?.userName || `Listener ${index + 1}`;
                                    const color = `hsl(${(index * 137.5) % 360}, 70%, 50%)`;
                                    return (
                                        <label key={userId} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', color: 'white', fontSize: '0.9rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={visibleUserIds.has(userId)}
                                                onChange={(e) => {
                                                    const newSet = new Set(visibleUserIds);
                                                    if (e.target.checked) newSet.add(userId);
                                                    else newSet.delete(userId);
                                                    setVisibleUserIds(newSet);
                                                }}
                                            />
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                                            {userName}
                                        </label>
                                    );
                                })}
                            </div>

                            {new Set(feedbackData.map(d => d.userId)).size > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #334155', paddingLeft: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}>
                                        <input
                                            type="checkbox"
                                            checked={showAverage}
                                            onChange={(e) => setShowAverage(e.target.checked)}
                                        />
                                        Show Average Trend
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Scrollable Container for Sync */}
                        <div
                            ref={scrollContainerRef}
                            style={{
                                width: '100%',
                                overflowX: 'auto',
                                background: '#0f172a',
                                borderRadius: '0.5rem',
                                border: '1px solid #334155',
                                padding: '0'
                            }}>
                            <div style={{
                                minWidth: '100%',
                                width: duration ? `${Math.max(containerWidth, duration * zoomLevel)}px` : '100%',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Synced Graph */}
                                <div style={{ height: '200px', width: '100%', position: 'relative' }}>
                                    <FeedbackGraph
                                        feedbackData={feedbackData}
                                        reviewMode={true}
                                        playbackTime={currentPlaybackTime}
                                        onSeek={handleSeek}
                                        width="100%"
                                        duration={duration}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                        visibleUserIds={visibleUserIds}
                                        showAverage={showAverage}
                                    />
                                </div>

                                {/* Waveform Player */}
                                <div style={{ width: '100%', position: 'relative', paddingLeft: '40px', paddingRight: '20px', boxSizing: 'border-box' }}>
                                    <WaveformPlayer
                                        ref={playerRef}
                                        audioUrl={audioUrl}
                                        zoomLevel={zoomLevel}
                                        onTimeUpdate={handleWaveformTimeUpdate}
                                        onSeek={handleWaveformSeek}
                                        onReady={(d) => setDuration(d)}
                                        onFinish={() => setIsPlaying(false)}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                    />
                                </div>
                            </div>
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
                                            ■ Stop & Review
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
        </div >
    );
};

export default NarratorDashboard;
