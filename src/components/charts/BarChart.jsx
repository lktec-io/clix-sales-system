import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { BASE_FONT, useChartTheme } from './chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// `datasets` (array of { label, values, color }) renders a grouped/legended
// bar chart (Revenue vs Expenses); the single `values`/`color`/`label` props
// stay the default single-series mode every existing caller already uses.
// `color`/dataset colors are optional — omitting them falls back to the
// current theme's primary color, so a theme switch re-colors the chart
// even for callers that don't pass an explicit color.
function BarChart({
  labels, values, label, color, horizontal = false,
  datasets = null, valueFormatter = (v) => v, height = 260,
}) {
  const { t } = useTranslation('common');
  const chartColors = useChartTheme();
  const resolvedLabel = label ?? t('chart.value');
  const resolvedColor = color || chartColors.primary;

  const data = {
    labels,
    datasets: datasets
      ? datasets.map((d) => ({
        label: d.label,
        data: d.values,
        backgroundColor: d.color,
        borderRadius: 4,
        maxBarThickness: 28,
      }))
      : [
        {
          label: resolvedLabel,
          data: values,
          backgroundColor: resolvedColor,
          borderRadius: 4,
          maxBarThickness: 36,
        },
      ],
  };

  const options = {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: datasets
        ? { display: true, position: 'top', align: 'end', labels: { font: BASE_FONT, color: chartColors.graySecondary, usePointStyle: true, boxWidth: 8 } }
        : { display: false },
      tooltip: {
        titleFont: BASE_FONT,
        bodyFont: BASE_FONT,
        backgroundColor: chartColors.tooltipBg,
        padding: 12,
        cornerRadius: 8,
        callbacks: { label: (context) => `${context.dataset.label}: ${valueFormatter(context.parsed[horizontal ? 'x' : 'y'])}` },
      },
    },
    scales: {
      x: { ticks: { font: BASE_FONT, color: chartColors.graySecondary }, grid: { display: !horizontal, color: chartColors.border } },
      y: { ticks: { font: BASE_FONT, color: chartColors.graySecondary }, grid: { display: horizontal, color: chartColors.border } },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}

export default BarChart;
