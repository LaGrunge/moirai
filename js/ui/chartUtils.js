// Shared chart utilities for SVG charts
// Used by overview, infrastructure, contributors modules

// Render a horizontal bar chart
export function renderBarChart(data, options = {}) {
    const {
        valueField = 'value',
        labelField = 'label',
        width = 400,
        height = null,
        barHeight = 30,
        gap = 8,
        labelWidth = 120,
        showValues = true,
        colorField = null,
        defaultColor = 'var(--primary-color)'
    } = options;

    if (!data || data.length === 0) {
        return '<div class="no-data">No data available</div>';
    }

    const chartHeight = height || data.length * (barHeight + gap);
    const chartWidth = width - labelWidth - 50;
    const maxValue = Math.max(...data.map(d => d[valueField] || 0), 1);

    const bars = data.map((d, i) => {
        const value = d[valueField] || 0;
        const barW = (value / maxValue) * chartWidth;
        const y = i * (barHeight + gap);
        const color = colorField ? d[colorField] : defaultColor;
        const label = d[labelField] || '';

        return `
            <g transform="translate(0, ${y})">
                <text x="${labelWidth - 10}" y="${barHeight / 2 + 5}" class="chart-label" text-anchor="end">
                    ${escapeHtml(label.length > 15 ? label.slice(0, 15) + '...' : label)}
                </text>
                <rect x="${labelWidth}" y="0" width="${barW}" height="${barHeight}" 
                      fill="${color}" rx="4">
                    <title>${label}: ${value}</title>
                </rect>
                ${showValues ? `<text x="${labelWidth + barW + 10}" y="${barHeight / 2 + 5}" class="chart-value">${value}</text>` : ''}
            </g>
        `;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${chartHeight}" class="bar-chart">
            ${bars}
        </svg>
    `;
}

// Render a line chart
export function renderLineChart(data, options = {}) {
    const {
        valueField = 'value',
        labelField = 'date',
        width = 400,
        height = 150,
        padding = { top: 20, right: 20, bottom: 30, left: 40 },
        color = 'var(--primary-color)',
        showArea = true,
        showDots = true,
        unit = ''
    } = options;

    if (!data || data.length === 0) {
        return '<div class="no-data">No data available</div>';
    }

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = data.map(d => d[valueField] || 0);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    // Generate points
    const points = data.map((d, i) => {
        const value = d[valueField] || 0;
        const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
        const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
        return { x, y, value, label: d[labelField] };
    });

    const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
    const areaPath = `M ${padding.left},${padding.top + chartHeight} L ${points.map(p => `${p.x},${p.y}`).join(' L ')} L ${padding.left + chartWidth},${padding.top + chartHeight} Z`;

    // Dots
    const dots = showDots ? points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}" class="chart-dot">
            <title>${p.label}: ${p.value}${unit}</title>
        </circle>
    `).join('') : '';

    // Y-axis labels
    const yLabels = [minValue, Math.round((maxValue + minValue) / 2), maxValue].map((v, i) => {
        const y = padding.top + chartHeight - (i * chartHeight / 2);
        return `<text x="${padding.left - 5}" y="${y + 4}" class="chart-label" text-anchor="end">${v}${unit}</text>`;
    }).join('');

    // X-axis labels
    const step = Math.ceil(data.length / 7);
    const xLabels = data
        .filter((_, i) => i % step === 0)
        .map((d, i) => {
            const x = padding.left + (i * step / (data.length - 1 || 1)) * chartWidth;
            const label = d[labelField] || '';
            return `<text x="${x}" y="${height - 5}" class="chart-label">${label.slice(-5)}</text>`;
        }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="line-chart">
            ${showArea ? `<path d="${areaPath}" fill="${color}" opacity="0.1" />` : ''}
            <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" />
            ${dots}
            ${xLabels}
            ${yLabels}
            <line x1="${padding.left}" y1="${padding.top + chartHeight}" 
                  x2="${width - padding.right}" y2="${padding.top + chartHeight}" 
                  stroke="var(--border-color)" />
        </svg>
    `;
}

// Render a pie chart
export function renderPieChart(data, options = {}) {
    const {
        valueField = 'value',
        colorField = 'color',
        labelField = 'label',
        size = 200,
        innerRadius = 40
    } = options;

    if (!data || data.length === 0) {
        return '<div class="no-data">No data available</div>';
    }

    const total = data.reduce((sum, d) => sum + (d[valueField] || 0), 0);
    if (total === 0) {
        return '<div class="no-data">No data available</div>';
    }

    const center = size / 2;
    const radius = (size / 2) - 10;
    let currentAngle = -90;

    const segments = data.map(d => {
        const value = d[valueField] || 0;
        const percentage = value / total;
        const angle = percentage * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;
        const color = d[colorField] || 'var(--primary-color)';
        const label = d[labelField] || '';

        return `
            <path d="M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z"
                  fill="${color}" class="pie-segment">
                <title>${label}: ${value} (${Math.round(percentage * 100)}%)</title>
            </path>
        `;
    }).join('');

    return `
        <svg viewBox="0 0 ${size} ${size}" class="pie-chart">
            ${segments}
            <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="var(--card-bg)" />
        </svg>
    `;
}

// Render hourly distribution chart
export function renderHourlyChart(distribution, options = {}) {
    const {
        width = 500,
        height = 100,
        color = 'var(--primary-color)'
    } = options;

    const maxValue = Math.max(...distribution, 1);
    const barWidth = width / 24 - 2;

    const bars = distribution.map((count, hour) => {
        const barHeight = (count / maxValue) * 80;
        const x = hour * (width / 24) + 1;
        const y = height - barHeight - 20;

        return `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" 
                  fill="${color}" rx="2">
                <title>${hour}:00 - ${count} builds</title>
            </rect>
        `;
    }).join('');

    const labels = [0, 4, 8, 12, 16, 20].map(hour => {
        const x = hour * (width / 24) + barWidth / 2;
        return `<text x="${x}" y="${height - 5}" class="chart-label">${hour}:00</text>`;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="hourly-chart">
            ${bars}
            ${labels}
        </svg>
    `;
}

// Render legend
export function renderLegend(items, options = {}) {
    const { inline = false } = options;
    const className = inline ? 'chart-legend-inline' : 'pie-legend';

    return `
        <div class="${className}">
            ${items.map(item => `
                <${inline ? 'span' : 'div'} class="${inline ? 'legend-item-inline' : 'legend-item'}">
                    <span class="${inline ? 'legend-dot' : 'legend-color'}" style="background-color: ${item.color}"></span>
                    <span class="legend-label">${item.label}</span>
                    ${item.value !== undefined ? `<span class="legend-value">${item.value}</span>` : ''}
                </${inline ? 'span' : 'div'}>
            `).join('')}
        </div>
    `;
}

// Escape HTML for safe rendering
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Status colors mapping
export const STATUS_COLORS = {
    success: 'var(--success-color)',
    failure: 'var(--failure-color)',
    error: 'var(--failure-color)',
    running: 'var(--running-color)',
    pending: 'var(--pending-color)',
    killed: '#6c757d',
    skipped: '#adb5bd'
};

// Status labels mapping
export const STATUS_LABELS = {
    success: 'Success',
    failure: 'Failed',
    error: 'Error',
    running: 'Running',
    pending: 'Pending',
    killed: 'Killed',
    skipped: 'Skipped'
};
