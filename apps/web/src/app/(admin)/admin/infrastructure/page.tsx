import { prisma } from '@/lib/prisma';
import { InfrastructureFleetClient } from '@/components/infrastructure-fleet-client';

export const dynamic = 'force-dynamic';

export default async function InfrastructureAdminPage() {
  let vpsEnvs: any[] = [];
  try {
    const rawEnvs = await prisma.vpsEnvironment.findMany({
      orderBy: { name: 'asc' }
    });
    vpsEnvs = rawEnvs.map((vps: any) => ({
      id: vps.id,
      name: vps.name,
      status: vps.status,
      cpuPercent: vps.cpuPercent,
      ramPercent: vps.ramPercent,
      diskPercent: vps.diskPercent,
      activeTerminals: vps.activeTerminals,
      lastHeartbeatAt: vps.lastHeartbeatAt ? new Date(vps.lastHeartbeatAt).toISOString() : null,
      lastCommand: vps.lastCommand,
      commandStatus: vps.commandStatus,
      commandMessage: vps.commandMessage,
      commandAt: vps.commandAt ? new Date(vps.commandAt).toISOString() : null,
    }));
  } catch (e) {
    console.error("Failed to fetch VPS envs", e);
  }

  return <InfrastructureFleetClient initialVpsEnvs={vpsEnvs} />;
}
