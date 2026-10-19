'use client';

import { useState, useRef, useEffect } from 'react';
import { Server } from 'lucide-react';

const COMMON_BROKERS = [
  // ── Top Brokers in Nigeria & Africa ──────────────────────────────────
  { broker: 'Exness Technologies Ltd', servers: ['Exness-MT5Trial', 'Exness-MT5Trial2', 'Exness-MT5Trial3', 'Exness-MT5Trial4', 'Exness-MT5Trial5', 'Exness-MT5Trial6', 'Exness-MT5Trial7', 'Exness-MT5Real', 'Exness-MT5Real2', 'Exness-MT5Real3', 'Exness-MT5Real4', 'Exness-MT5Real5', 'Exness-MT5Real6', 'Exness-MT5Real7', 'Exness-MT5Real8', 'Exness-MT5Real9', 'Exness-MT5Real10'] },
  { broker: 'Deriv (SVG) LLC', servers: ['Deriv-Demo', 'Deriv-Server', 'Deriv-Server-02', 'Deriv-Server-03'] },
  { broker: 'HF Markets (SV) Ltd', servers: ['HFMarketsSV-Demo', 'HFMarketsSV-Live', 'HFMarketsSV-Live Server', 'HFMarketsSV-Live 2', 'HFMarketsSV-Live 3', 'HFMarketsSV-Live 4'] },
  { broker: 'XM Global Limited', servers: ['XMGlobal-MT5', 'XMGlobal-MT5 2', 'XMGlobal-MT5 3', 'XMGlobal-MT5 4', 'XMGlobal-Demo'] },
  { broker: 'Octa Markets Incorporated', servers: ['OctaFX-Demo', 'OctaFX-Real', 'OctaFX-Real2'] },
  { broker: 'ForexTime Ltd (FXTM)', servers: ['FXTM-MT5-Demo', 'FXTM-MT5', 'FXTM-MT5-2', 'FXTM-MT5-3'] },
  { broker: 'FBS Markets Inc.', servers: ['FBS-Demo', 'FBS-Real', 'FBS-Real-2', 'FBS-Real-3', 'FBS-Real-4', 'FBS-Real-5'] },
  { broker: 'Just Global Markets Ltd.', servers: ['JustMarkets-Demo', 'JustMarkets-Live', 'JustMarkets-Live 2', 'JustMarkets-Live 3'] },
  { broker: 'Kwakol Markets', servers: ['Kwakol-Demo', 'Kwakol-Live', 'Kwakol-Live 2'] },
  { broker: 'LiteFinance Global LLC', servers: ['LiteFinance-Classic.com', 'LiteFinance-ECN.com', 'LiteFinance-Demo.com'] },
  { broker: 'Headway (Jarocel Pty Ltd)', servers: ['Headway-Real', 'Headway-Real 2', 'Headway-Demo', 'Headway-Live'] },
  { broker: 'Infinox Capital Ltd', servers: ['Infinox-MT5 Live', 'Infinox-MT5 Demo'] },

  // ── Global Institutional & ECN Brokers ───────────────────────────────
  { broker: 'IC Markets (SC / EU)', servers: ['ICMarketsSC-MT5', 'ICMarketsSC-MT5-2', 'ICMarketsSC-MT5-3', 'ICMarketsSC-MT5-4', 'ICMarkets-MT5', 'ICMarkets-MT5-2', 'ICMarkets-MT5-3', 'ICMarkets-MT5-4', 'ICMarkets-Demo'] },
  { broker: 'Pepperstone Group Limited', servers: ['Pepperstone-Demo', 'Pepperstone-Live', 'Pepperstone-Edge', 'Pepperstone-MT5-Live'] },
  { broker: 'Tickmill Ltd', servers: ['Tickmill-Demo', 'Tickmill-Live', 'Tickmill-Live 2', 'Tickmill-Live 3'] },
  { broker: 'Vantage Global Prime Pty Ltd', servers: ['Vantage-Demo', 'Vantage-Live', 'Vantage-Live 2', 'Vantage-Live 3'] },
  { broker: 'FP Markets', servers: ['FPMarkets-Demo', 'FPMarkets-Live', 'FPMarkets-Live 2'] },
  { broker: 'FxPro Financial Services Ltd', servers: ['FxPro-MT5', 'FxPro-MT5-Demo', 'FxPro-MT5-2'] },
  { broker: 'RoboForex Ltd', servers: ['RoboForex-Pro', 'RoboForex-ECN', 'RoboForex-Demo'] },
  { broker: 'Avatrade', servers: ['Ava-Demo', 'Ava-Real 1', 'Ava-Real 2', 'Ava-Real 3'] },
  { broker: 'Alpari Limited', servers: ['Alpari-Demo', 'Alpari-Standard', 'Alpari-ECN'] },
  { broker: 'Axi', servers: ['Axi-Demo', 'Axi-Live', 'Axi-Live-2'] },
  { broker: 'Admirals', servers: ['Admirals-Demo', 'Admirals-Live'] },
  { broker: 'BlackBull Markets', servers: ['BlackBull-Demo', 'BlackBull-Live'] },
  { broker: 'Fusion Markets', servers: ['FusionMarkets-Demo', 'FusionMarkets-Live'] },
  { broker: 'Moneta Markets', servers: ['Moneta-Demo', 'Moneta-Live'] },
  { broker: 'AXIORY', servers: ['Axiory-Demo', 'Axiory-Live'] },
  { broker: 'Equiti', servers: ['Equiti-Demo', 'Equiti-Live'] },
  { broker: 'Blueberry Markets', servers: ['Blueberry-Demo', 'Blueberry-Live'] },
  { broker: 'ThinkMarkets', servers: ['ThinkMarkets-Demo', 'ThinkMarkets-Live'] },
  { broker: 'AMarkets', servers: ['AMarkets-Demo', 'AMarkets-Live'] },
  { broker: 'MultiBank Group', servers: ['MultiBank-Demo', 'MultiBank-Live'] },
  { broker: 'Windsor Brokers', servers: ['Windsor-Demo', 'Windsor-Live'] },

  // ── Verified Prop Firms That Allow Copy Trading ─────────────────────
  // (NOTE: Most firms permit copying only between accounts owned by the same trader)
  { broker: 'FTMO S.R.O.', servers: ['FTMO-Demo', 'FTMO-Server', 'FTMO-Server2', 'FTMO-Server3', 'FTMO-Server4'] },
  { broker: 'Funding Pips', servers: ['FundingPips-Demo', 'FundingPips-Live', 'FundingPips-Server'] },
  { broker: 'FundedNext', servers: ['FundedNext-Demo', 'FundedNext-Server', 'FundedNext-Server2', 'FundedNext-Server3'] },
  { broker: 'The5ers', servers: ['The5ers-MT5', 'The5ers-Live', 'The5ers-Demo'] },
  { broker: 'Alpha Capital Group', servers: ['AlphaCapital-Demo', 'AlphaCapital-Live', 'AlphaCapital-Live 2'] },
  { broker: 'Goat Funded Trader', servers: ['GoatFundedTrader-Server', 'GoatFundedTrader-Demo'] },
  { broker: 'FXIFY', servers: ['FXIFY-Live', 'FXIFY-Demo'] },
  { broker: 'Instant Funding', servers: ['InstantFunding-Server', 'InstantFunding-Demo'] },
  { broker: 'FunderPro', servers: ['FunderPro-Live', 'FunderPro-Demo'] },
  { broker: 'City Traders Imperium', servers: ['CTI-Server', 'CTI-Demo'] },
  { broker: 'Lark Funding', servers: ['LarkFunding-Server', 'LarkFunding-Demo'] },
  { broker: 'Funded Trading Plus', servers: ['FundedTradingPlus-Server', 'FundedTradingPlus-Demo'] },

  // Base MetaQuotes Demo
  { broker: 'MetaQuotes Software Corp.', servers: ['MetaQuotes-Demo'] }
];

export function BrokerCombobox() {
  const [brokerValue, setBrokerValue] = useState('');
  const [serverValue, setServerValue] = useState('');
  
  const [brokerFocused, setBrokerFocused] = useState(false);
  const [serverFocused, setServerFocused] = useState(false);

  const brokerRef = useRef<HTMLDivElement>(null);
  const serverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (brokerRef.current && !brokerRef.current.contains(event.target as Node)) {
        setBrokerFocused(false);
      }
      if (serverRef.current && !serverRef.current.contains(event.target as Node)) {
        setServerFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBrokers = COMMON_BROKERS.filter(b => b.broker.toLowerCase().includes(brokerValue.toLowerCase()));
  
  const selectedBrokerObj = COMMON_BROKERS.find(b => b.broker.toLowerCase() === brokerValue.trim().toLowerCase());
                            
  const filteredServers = selectedBrokerObj 
    ? selectedBrokerObj.servers.filter(s => s.toLowerCase().includes(serverValue.toLowerCase()))
    : [];

  const isCustomBroker = brokerValue.trim().length > 0 && !selectedBrokerObj;

  return (
    <>
      <div className="flex flex-col gap-1.5" ref={brokerRef}>
        <div className="flex items-center justify-between px-1">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Broker or Prop Firm</label>
          {isCustomBroker && (
            <span className="text-[10px] bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
              Custom Broker Supported
            </span>
          )}
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Server className="w-4 h-4 text-muted-foreground" />
          </div>
          <input 
            type="text" 
            name="broker"
            required
            value={brokerValue}
            onChange={(e) => setBrokerValue(e.target.value)}
            onFocus={() => setBrokerFocused(true)}
            placeholder="Search or enter any broker / prop firm..." 
            autoComplete="off"
            className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-2xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20 transition-all"
          />
          {brokerFocused && (
            <div className="absolute top-full left-0 right-0 mt-2 p-1 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto custom-scrollbar">
              {filteredBrokers.map(b => (
                <div 
                  key={b.broker} 
                  className="px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer transition-colors flex items-center justify-between"
                  onClick={() => {
                    setBrokerValue(b.broker);
                    setBrokerFocused(false);
                    if (b.servers.length === 1) {
                      setServerValue(b.servers[0]);
                    } else {
                      setServerValue('');
                    }
                  }}
                >
                  <span>{b.broker}</span>
                  <span className="text-[10px] text-muted-foreground/70 uppercase font-mono">{b.servers.length} servers</span>
                </div>
              ))}
              {isCustomBroker && (
                <div 
                  className="px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-colors border-t border-border/30 mt-1 flex items-center justify-between"
                  onClick={() => setBrokerFocused(false)}
                >
                  <span>Use custom: &ldquo;{brokerValue}&rdquo;</span>
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded">All Brokers Allowed</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5" ref={serverRef}>
        <div className="flex items-center justify-between px-1">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">MT5 Server or Host</label>
          <span className="text-[10px] text-muted-foreground/80 font-mono">e.g. ServerName or IP:Port</span>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Server className="w-4 h-4 text-muted-foreground" />
          </div>
          <input 
            type="text" 
            name="server"
            required
            value={serverValue}
            onChange={(e) => setServerValue(e.target.value)}
            onFocus={() => setServerFocused(true)}
            placeholder={selectedBrokerObj ? selectedBrokerObj.servers[0] : "e.g. MyBroker-Live or 185.12.34.56:443"} 
            autoComplete="off"
            className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-2xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20 transition-all font-mono"
          />
          {serverFocused && filteredServers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 p-1 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
              {filteredServers.map(s => (
                <div 
                  key={s} 
                  className="px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer transition-colors font-mono"
                  onClick={() => {
                    setServerValue(s);
                    setServerFocused(false);
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5 px-2 font-medium">
          Any MT5 broker or prop firm in the world is supported. Enter the exact server name from your broker welcome email, or direct IP/hostname.
        </p>
      </div>
    </>
  );
}



