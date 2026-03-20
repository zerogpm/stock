import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:8000';
const TABLE_NAME = process.env.PROFILES_TABLE_NAME || 'stock-profiles';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

async function tableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function createTables() {
  if (await tableExists()) {
    console.log(`Table "${TABLE_NAME}" already exists — skipping creation.`);
    return;
  }

  await client.send(new CreateTableCommand({
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  }));

  console.log(`Table "${TABLE_NAME}" created.`);
}

createTables().catch((err) => {
  console.error('Failed to create tables:', err.message);
  process.exit(1);
});
