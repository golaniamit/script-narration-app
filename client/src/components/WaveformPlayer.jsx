import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';

const WaveformPlayer = forwardRef(({ audioUrl, zoomLevel = 50, onTimeUpdate, onSeek, onFinish, onReady, onDragStart, onDragEnd }, ref) => {
    const containerRef = useRef(null);
    const wavesurferRef = useRef(null);
    const isReadyRef = useRef(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useImperativeHandle(ref, () => ({
        playPause: () => {
            if (wavesurferRef.current && isReadyRef.current) {
                wavesurferRef.current.playPause();
            }
        },
        play: () => {
            if (wavesurferRef.current && isReadyRef.current) {
                wavesurferRef.current.play();
            }
        },
        pause: () => {
            if (wavesurferRef.current && isReadyRef.current) {
                wavesurferRef.current.pause();
            }
        },
        seekTo: (time) => {
            if (wavesurferRef.current && isReadyRef.current) {
                const duration = wavesurferRef.current.getDuration();
                if (duration > 0) {
                    wavesurferRef.current.seekTo(time / duration);
                }
            }
        },
        isPlaying: isPlaying
    }));

    // Initialize WaveSurfer
    useEffect(() => {
        if (!containerRef.current || !audioUrl) return;

        // Destroy existing instance if any
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            isReadyRef.current = false;
        }

        try {
            wavesurferRef.current = WaveSurfer.create({
                container: containerRef.current,
                waveColor: '#475569',
                progressColor: '#38bdf8',
                cursorColor: '#ffffff',
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                height: 100,
                normalize: true,
                minPxPerSec: zoomLevel,
                fillParent: false,
                interact: false, // Disable default interaction to handle it manually
                dragToSeek: false,
                url: audioUrl,
            });

            // Event Listeners
            wavesurferRef.current.on('ready', () => {
                isReadyRef.current = true;
                const d = wavesurferRef.current.getDuration();
                if (onReady) onReady(d);
            });

            wavesurferRef.current.on('timeupdate', (time) => {
                if (onTimeUpdate) onTimeUpdate(time);
            });

            wavesurferRef.current.on('finish', () => {
                setIsPlaying(false);
                if (onFinish) onFinish();
            });

            wavesurferRef.current.on('play', () => setIsPlaying(true));
            wavesurferRef.current.on('pause', () => setIsPlaying(false));

            wavesurferRef.current.on('error', (e) => {
                console.error("WaveSurfer error:", e);
            });

        } catch (e) {
            console.error("Error initializing WaveSurfer:", e);
        }

        return () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                isReadyRef.current = false;
            }
        };
    }, [audioUrl]);

    // Handle Zoom Updates
    useEffect(() => {
        if (wavesurferRef.current && isReadyRef.current) {
            try {
                wavesurferRef.current.zoom(zoomLevel);
            } catch (e) {
                console.error("Error setting zoom:", e);
            }
        }
    }, [zoomLevel]);

    // Manual Drag Handling
    const isDraggingRef = useRef(false);

    const handleMouseDown = (e) => {
        if (!wavesurferRef.current || !isReadyRef.current || !containerRef.current) return;

        isDraggingRef.current = true;
        if (onDragStart) onDragStart();

        // Initial seek on click
        handleMouseMove(e);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current && e.type === 'mousemove') return;
        if (!containerRef.current || !wavesurferRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        // Clamp x between 0 and width
        const clampedX = Math.max(0, Math.min(x, width));
        const progress = clampedX / width;

        const duration = wavesurferRef.current.getDuration();
        if (duration > 0) {
            const time = progress * duration;
            wavesurferRef.current.seekTo(progress);
            if (onSeek) onSeek(time);
            if (onTimeUpdate) onTimeUpdate(time);
        }
    };

    const handleMouseUp = () => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            if (onDragEnd) onDragEnd();
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
    };

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div
                ref={containerRef}
                style={{ width: '100%', cursor: 'text' }}
                onMouseDown={handleMouseDown}
            />
        </div>
    );
});

export default WaveformPlayer;
