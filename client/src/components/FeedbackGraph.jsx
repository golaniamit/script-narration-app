import React, { useEffect, useState } from 'react';
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

const FeedbackGraph = ({ feedbackData }) => {
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

        const datasets = Object.entries(groupedData).map(([userId, dataPoints], index) => {
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

        setChartData({ datasets });
    }, [feedbackData]);

    // Calculate sliding window
    const maxTime = feedbackData.length > 0
        ? Math.max(...feedbackData.map(d => d.x))
        : 0;

    // Target: Keep the head (maxTime) at the 15s mark of the 20s window (75%)
    // So xMax should be maxTime + 5 (padding), but at least 20 initially.
    const xMax = Math.max(20, maxTime + 5);
    const minTime = Math.max(0, xMax - 20);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Disable animation for real-time performance
        scales: {
            x: {
                type: 'linear', // Use linear scale for seconds
                min: minTime,
                max: xMax,
                title: {
                    display: true,
                    text: 'Time (seconds)',
                    color: '#888'
                },
                grid: {
                    color: '#333'
                },
                ticks: {
                    color: '#888'
                }
            },
            y: {
                min: -10,
                max: 10,
                grid: {
                    color: '#333'
                },
                ticks: {
                    color: '#888'
                }
            }
        },
        plugins: {
            legend: {
                display: true, // Show legend
                labels: {
                    color: '#fff'
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Line options={options} data={chartData} />
        </div>
    );
};

export default FeedbackGraph;
