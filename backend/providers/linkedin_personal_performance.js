import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function fetchMetrics(timeRange) {
  // In the future, this will call LinkedIn API with the provided token/timeRange
  // For now, load from dummy-data.json
  try {
    const dataPath = path.join(__dirname, '../dummy-data.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const allData = JSON.parse(rawData);
    return allData.linkedin_personal;
  } catch (err) {
    console.error('Error fetching linkedin_personal metrics:', err);
    return null;
  }
}
