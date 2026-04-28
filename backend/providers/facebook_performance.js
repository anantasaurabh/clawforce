import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function fetchMetrics(timeRange, targetId) {
  try {
    const dataPath = path.join(__dirname, '../dummy-data.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const allData = JSON.parse(rawData);
    const base = allData.facebook || { summary: { reach: 0, engagement: 0, conversion: 0 }, chartData: [] };

    if (!targetId) return base;

    // Deterministic scaling based on targetId string to create realistic variation per page
    const hash = targetId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const factor = 0.5 + (hash % 10) / 5; // between 0.5x and 2.5x multiplier

    return {
      summary: {
        reach: Math.round(base.summary.reach * factor),
        engagement: Math.round(base.summary.engagement * factor),
        conversion: Math.round(base.summary.conversion * factor)
      },
      chartData: base.chartData.map(d => ({
        date: d.date,
        reach: Math.round(d.reach * factor),
        engagement: Math.round(d.engagement * factor)
      }))
    };
  } catch (err) {
    console.error('Error fetching facebook metrics:', err);
    return null;
  }
}
