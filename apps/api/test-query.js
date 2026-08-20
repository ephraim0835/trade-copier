const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const subAccountId = 'DEMO-SUB-1';
  
  console.time('Combined Query');
  const result = await prisma.$queryRaw`
    WITH account_check AS (
      SELECT id, "isDemo", "isActive"
      FROM "Mt5Account"
      WHERE id = ${subAccountId}
    ),
    claimed AS (
      UPDATE "ExecutionCommand"
      SET status = 'DELIVERED', "deliveredAt" = NOW()
      WHERE id IN (
        SELECT e.id FROM "ExecutionCommand" e
        JOIN account_check a ON a.id = e."subAccountId"
        WHERE e."subAccountId" = ${subAccountId}
          AND e.status IN ('CREATED', 'QUEUED')
          AND e."expiresAt" > NOW()
          AND a."isDemo" = true
          AND a."isActive" = true
        ORDER BY e."createdAt" ASC
        FOR UPDATE OF e SKIP LOCKED
      )
      RETURNING *
    )
    SELECT 
      (SELECT row_to_json(account_check.*) FROM account_check) as account,
      COALESCE((SELECT json_agg(row_to_json(claimed.*)) FROM claimed), '[]'::json) as commands;
  `;
  console.timeEnd('Combined Query');
  console.log(JSON.stringify(result, null, 2));
  
  await prisma.$disconnect();
}
main().catch(console.error);
