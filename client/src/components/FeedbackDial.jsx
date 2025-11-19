import React, { useState, useEffect, useRef } from 'react';

const FeedbackDial = ({ onFeedbackChange }) => {
    const [value, setValue] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const trackRef = useRef(null);
    const requestRef = useRef(null);
    const velocity = useRef(0);

    // Throttled feedback emission
    useEffect(() => {
        const now = Date.now();
        onFeedbackChange(value, now);
    }, [value]);

    // Spring-back animation loop
    const animate = () => {
        if (!isDragging) {
            setValue(prev => {
                // Stop if extremely close to 0 to prevent infinite calculation
                if (Math.abs(prev) < 0.01) return 0;

                // Gentle exponential decay
                // 0.96 is much smoother/slower than the previous 0.92
                // This ensures it slows down significantly as it approaches neutral
                return prev * 0.96;
            });
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (!isDragging) {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [isDragging]);

    const handleStart = (clientY) => {
        setIsDragging(true);
        updateValue(clientY);
    };

    const handleMove = (clientY) => {
        if (isDragging) {
            updateValue(clientY);
        }
    };

    const handleEnd = () => {
        setIsDragging(false);
    };

    const updateValue = (clientY) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;

        // Calculate distance from center (inverted because Y grows downwards)
        const deltaY = centerY - clientY;

        // Max distance is half height
        const maxDist = rect.height / 2;

        // Normalize to -10 to 10 (User requested -10 to 10 reference)
        // Internal value is still useful to be -100 to 100 for percentage calculations?
        // Let's keep internal state -10 to 10 to match the markings directly.

        let newValue = (deltaY / maxDist) * 10;

        // Clamp
        newValue = Math.max(-10, Math.min(10, newValue));

        setValue(newValue);
    };

    // Mouse events
    const onMouseDown = (e) => handleStart(e.clientY);
    const onMouseMove = (e) => handleMove(e.clientY);
    const onMouseUp = () => handleEnd();
    const onMouseLeave = () => handleEnd();

    // Touch events
    const onTouchStart = (e) => handleStart(e.touches[0].clientY);
    const onTouchMove = (e) => handleMove(e.touches[0].clientY);
    const onTouchEnd = () => handleEnd();

    // Calculate handle position
    // Value -10 to 10.
    // 0 -> 50%
    // 10 -> 0% (top)
    // -10 -> 100% (bottom)
    // Formula: 50 - (value * 5)
    const topPercent = 50 - (value * 5);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                touchAction: 'none', // Prevent scrolling
                userSelect: 'none'
            }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Fader Track */}
            <div
                ref={trackRef}
                style={{
                    width: '80px',
                    height: '60vh', // Reduced height as requested
                    background: '#1e293b',
                    borderRadius: '10px',
                    position: 'relative',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
                    border: '2px solid #334155'
                }}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
            >
                {/* Center Line */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '0',
                    right: '0',
                    height: '2px',
                    background: 'rgba(255,255,255,0.2)',
                    pointerEvents: 'none'
                }} />

                {/* Markings -10 to 10 */}
                {[...Array(21)].map((_, i) => {
                    const val = 10 - i; // 10 down to -10
                    if (val % 2 !== 0 && val !== 0) return null; // Only show even numbers and 0

                    return (
                        <div key={i} style={{
                            position: 'absolute',
                            top: `${i * 5}%`,
                            left: '100%',
                            marginLeft: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            pointerEvents: 'none'
                        }}>
                            <div style={{ width: '10px', height: '1px', background: '#64748b', marginRight: '5px' }}></div>
                            <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold' }}>{val}</span>
                        </div>
                    );
                })}

                {/* Tick Marks on Track */}
                {[...Array(21)].map((_, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        top: `${i * 5}%`,
                        left: '10px',
                        right: '10px',
                        height: '1px',
                        background: i === 10 ? 'transparent' : 'rgba(255,255,255,0.1)',
                        pointerEvents: 'none'
                    }} />
                ))}

                {/* Fader Handle */}
                <div style={{
                    position: 'absolute',
                    top: `${topPercent}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '120px', // Wider than track for easier grabbing
                    height: '60px',
                    background: 'linear-gradient(180deg, #475569 0%, #1e293b 100%)',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                    border: '1px solid #64748b',
                    cursor: 'grab',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {/* Handle Grip Lines */}
                    <div style={{ width: '60%', height: '2px', background: '#000', marginBottom: '4px' }} />
                    <div style={{ width: '60%', height: '2px', background: '#000', marginBottom: '4px' }} />
                    <div style={{ width: '60%', height: '2px', background: '#000' }} />

                    {/* Value Indicator Glow */}
                    <div style={{
                        position: 'absolute',
                        left: '10px',
                        right: '10px',
                        top: '50%',
                        height: '4px',
                        background: value > 0 ? 'var(--success)' : (value < 0 ? 'var(--danger)' : 'var(--text-secondary)'),
                        boxShadow: `0 0 10px ${value > 0 ? 'var(--success)' : (value < 0 ? 'var(--danger)' : 'transparent')}`,
                        opacity: Math.abs(value) / 10 + 0.2
                    }} />
                </div>
            </div>

            {/* Value Display */}
            <div style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                pointerEvents: 'none',
                opacity: 0.5
            }}>
                {Math.round(value)}
            </div>
        </div>
    );
};

export default FeedbackDial;
