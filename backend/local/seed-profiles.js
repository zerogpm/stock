import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_PATH = join(__dirname, '..', 'data', 'stockProfiles.json');

const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:8000';
const TABLE_NAME = process.env.PROFILES_TABLE_NAME || 'stock-profiles';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

async function seedProfiles() {
  const profiles = JSON.parse(readFileSync(PROFILES_PATH, 'utf-8'));
  let count = 0;

  // Seed industry profiles
  for (const [name, data] of Object.entries(profiles.industries)) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `INDUSTRY#${name}`,
        sk: 'PROFILE',
        type: 'industry',
        name,
        ...data,
      },
    }));
    count++;
  }

  // Seed ticker profiles
  for (const [symbol, data] of Object.entries(profiles.tickers)) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TICKER#${symbol}`,
        sk: 'PROFILE',
        type: 'ticker',
        symbol,
        ...data,
      },
    }));
    count++;
  }

  console.log(`Seeded ${count} profiles (${Object.keys(profiles.industries).length} industries, ${Object.keys(profiles.tickers).length} tickers).`);
}

seedProfiles().catch((err) => {
  console.error('Failed to seed profiles:', err.message);
  process.exit(1);
});
