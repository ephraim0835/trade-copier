import { prisma } from '@/lib/prisma';
import { Server, Cpu, HardDrive, Wifi, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InfrastructureAdminPage() {
  let vpsEnvs: any[] = [];
  try {
    vpsEnvs = await prisma.vpsEnvironment.findMany({
      orderBy: { name: 'asc' }
    });
  } catch (e) {
    console.error("Failed to fetch VPS envs", e);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Infrastructure Fleet</h1>
        <p className="text-muted-foreground">Monitor real-time hardware telemetry for all active MT5 VPS nodes.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {vpsEnvs.length === 0 ? (
          <div className="col-span-full plaiz-card p-12 flex flex-col items-center justify-center text-center">
            <Server className="w-8 h-8 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-bold">No Telemetry Received</h3>
            <p className="text-muted-foreground text-sm mt-1">Ensure the VPS manager is running and pushing telemetry to the database.</p>
          </div>
        ) : (
          vpsEnvs.map((vps: any) => {
             const isOnline = new Date().getTime() - new Date(vps.lastHeartbeatAt).getTime() < 5 * 60 * 1000;
             return (
               <div key={vps.id} className="plaiz-card p-6 flex flex-col gap-6">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                       <Server className="w-5 h-5" />
                     </div>
                     <div>
                       <h3 className="font-bold text-lg leading-none">{vps.name}</h3>
                       <span className="text-xs text-muted-foreground mt-1 block">ID: {vps.id.slice(0,8)}</span>
                     </div>
                   </div>
                   <div className={isOnline ? "plaiz-pill plaiz-pill-success" : "plaiz-pill plaiz-pill-destructive"}>
                     <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'} mr-1`}></span>
                     {isOnline ? 'Online' : 'Offline'}
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
                   <div className="flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                       <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Cpu className="w-3.5 h-3.5"/> CPU</span>
                       <span className="text-sm font-bold num-tabular">{vps.cpuPercent}%</span>
                     </div>
                     <div className="w-full h-1.5 bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${vps.cpuPercent}%` }}></div>
                     </div>
                   </div>

                   <div className="flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                       <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><HardDrive className="w-3.5 h-3.5"/> RAM</span>
                       <span className="text-sm font-bold num-tabular">{vps.ramPercent}%</span>
                     </div>
                     <div className="w-full h-1.5 bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${vps.ramPercent}%` }}></div>
                     </div>
                   </div>
                 </div>

                 <div className="flex items-center justify-between pt-4 border-t border-border/40">
                   <div className="flex flex-col">
                     <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Active Terminals</span>
                     <span className="text-lg font-bold mt-0.5">{vps.activeTerminals} / 25</span>
                   </div>
                   <div className="flex flex-col items-end">
                     <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Last Heartbeat</span>
                     <span className="text-sm font-medium mt-0.5">{new Date(vps.lastHeartbeatAt).toLocaleTimeString()}</span>
                   </div>
                 </div>
               </div>
             )
          })
        )}
      </div>
    </div>
  );
}
