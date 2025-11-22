import React, { useEffect, useState, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
);

const FeedbackGraph = ({ feedbackData, reviewMode = false, playbackTime = 0, onSeek = () => { }, width, duration, onDragStart, onDragEnd, visibleUserIds, showAverage }) => {
    const [chartData, setChartData] = useState({ datasets: [] });

    useEffect(() => {
        // Group by userId
        const groupedData = {};
        feedbackData.forEach(item => {
            if (!groupedData[item.userId]) {
                groupedData[item.userId] = [];
            }
            groupedData[item.userId].push(item);
        });

        const datasets = Object.entries(groupedData)
            .filter(([userId]) => !reviewMode || !visibleUserIds || visibleUserIds.has(userId))
            .map(([userId, dataPoints], index) => {
                // Get user name from the first data point
                const userName = dataPoints[0]?.userName || `Listener ${index + 1}`;
                const color = `hsl(${(index * 137.5) % 360}, 70%, 50%)`; // Golden angle approximation for distinct colors

                return {
                    label: userName,
                    data: dataPoints.map(d => ({ x: d.x, y: d.value })),
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.4,
                    pointRadius: 0, // Hide points for cleaner look
                    borderWidth: 2
                };
            });

        // Calculate Average Line (only in review mode and if requested)
        if (reviewMode && showAverage && feedbackData.length > 0) {
            // Use ALL users for average, regardless of visibility
            const activeUsers = Object.keys(groupedData);

            if (activeUsers.length > 1) {
                // Create time grid (every 200ms)
                const maxTime = Math.max(...feedbackData.map(d => d.x));
                const timeStep = 0.2;
                const averagePoints = [];

                for (let t = 0; t <= maxTime; t += timeStep) {
                    let sum = 0;
                    let count = 0;

                    activeUsers.forEach(userId => {
                        const userPoints = groupedData[userId];
                        // Find the latest point at or before time t
                        const point = userPoints.reduce((prev, curr) => {
                            return (curr.x <= t && curr.x > (prev?.x || -1)) ? curr : prev;
                        }, null);

                        if (point) {
                            sum += point.value;
                            count++;
                        }
                    });

                    if (count > 0) {
                        averagePoints.push({ x: t, y: sum / count });
                    }
                }

                datasets.push({
                    label: 'Average',
                    data: averagePoints,
                    borderColor: 'white',
                    backgroundColor: 'white',
                    borderWidth: 4,
                    pointRadius: 0,
                    tension: 0.4,
                    order: -2 // Topmost
                });
            }
        }

        // Add cursor dataset if in review mode
        if (reviewMode) {
            datasets.push({
                label: 'Cursor',
                data: [
                    { x: playbackTime, y: -10 },
                    { x: playbackTime, y: 10 }
                ],
                borderColor: 'white',
                borderWidth: 2,
                pointRadius: 0,
                borderDash: [5, 5],
                order: -1 // Ensure it renders on top
            });
        }

        setChartData({ datasets });
    }, [feedbackData, reviewMode, playbackTime, visibleUserIds, showAverage]);

    // Calculate sliding window or full range
    const maxTime = feedbackData.length > 0
        ? Math.max(...feedbackData.map(d => d.x))
        : 0;

    let minTime, xMax;

    if (reviewMode) {
        // Full timeline view
        minTime = 0;
        // Use duration if available, otherwise fallback to maxTime
        xMax = duration || Math.max(maxTime, 10);
    } else {
        // Sliding window view
        // Target: Keep the head (maxTime) at the right edge (100%)
        xMax = Math.max(20, maxTime);
        minTime = Math.max(0, xMax - 20);
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
            padding: {
                left: reviewMode ? 0 : 10,
                right: reviewMode ? 20 : 10, // Add right padding to match waveform and accommodate labels
                top: reviewMode ? 0 : 10,
                bottom: reviewMode ? 0 : 10
            }
        },
        scales: {
            x: {
                type: 'linear',
                min: minTime,
                max: xMax,
                display: !reviewMode, // Show X axis in live mode
                title: {
                    display: !reviewMode,
                    text: 'Time (seconds)',
                    color: '#888'
                },
                grid: {
                    display: !reviewMode,
                    color: '#333',
                    drawBorder: !reviewMode
                },
                afterBuildTicks: (axis) => {
                    const ticks = [];
                    // Ensure we cover the entire visible range plus a bit of buffer
                    const start = Math.floor(axis.min / 5) * 5;
                    // STRICTLY cap ticks at axis.max so future ticks don't appear early
                    const end = axis.max;

                    for (let i = start; i <= end; i += 5) {
                        ticks.push({ value: i });
                    }
                    axis.ticks = ticks;
                },
                ticks: {
                    color: '#888',
                    maxRotation: 0,
                    autoSkip: false,
                    includeBounds: false, // Prevent ticks at min/max edges
                    callback: function (value) {
                        // Hide ticks that are too close to the left edge (minTime)
                        // This prevents them from pushing the Y-axis or causing jitter
                        // 'this.chart.scales.x.min' might not be updated yet, so use the prop 'minTime'
                        // But we don't have access to props here easily without closure.
                        // Fortunately, 'this' context usually has access to the scale.
                        const min = this.chart.scales.x.min;
                        if (value < min + 1) return null; // Hide if within 1s of the left edge
                        return value;
                    }
                }
            },
            y: {
                min: -10,
                max: 10,
                display: !reviewMode, // Show Y axis in live mode
                afterFit: (scale) => {
                    scale.width = 40; // Force fixed width to prevent jitter
                },
                grid: {
                    display: !reviewMode,
                    color: '#333',
                    drawBorder: !reviewMode
                },
                ticks: {
                    color: '#888'
                }
            }
        },
        plugins: {
            legend: {
                display: !reviewMode, // Show legend in live mode
                labels: {
                    color: '#fff',
                    filter: (item) => item.text !== 'Cursor'
                }
            },
            tooltip: {
                enabled: !reviewMode, // Enable tooltip in live mode
                mode: 'index',
                intersect: false,
                filter: (item) => item.dataset.label !== 'Cursor'
            }
        }
    };

    // Drag to scrub logic
    const containerRef = useRef(null);
    const isDraggingRef = useRef(false);

    const handleMouseDown = (e) => {
        if (!reviewMode || !onSeek) return;
        isDraggingRef.current = true;
        if (onDragStart) onDragStart();
        handleMouseMove(e);
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        // Calculate time based on position
        // The graph shows [minTime, xMax]
        const timeRange = xMax - minTime;
        const time = minTime + (x / width) * timeRange;

        onSeek(Math.max(0, Math.min(time, xMax)));
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        if (onDragEnd) onDragEnd();
    };

    useEffect(() => {
        const handleWindowMouseMove = (e) => {
            if (isDraggingRef.current) {
                handleMouseMove(e);
            }
        };

        if (reviewMode) {
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('mousemove', handleWindowMouseMove);
            return () => {
                window.removeEventListener('mouseup', handleMouseUp);
                window.removeEventListener('mousemove', handleWindowMouseMove);
            };
        }
    }, [reviewMode, xMax, minTime]); // Add dependencies for calculation

    return (
        <div
            ref={containerRef}
            style={{ width: width || '100%', height: '100%', position: 'relative', cursor: reviewMode ? 'text' : 'default' }}
            onMouseDown={handleMouseDown}
        >
            <Line options={options} data={chartData} />
        </div>
    );
};

export default FeedbackGraph;
