import React from 'react';

interface TeamBreakdownItem {
  team_id: string;
  team_name: string;
  color_hex: string;
  total: number;
  checked_in: number;
  percentage: number;
}

interface SubTeamBreakdownItem {
  sub_team_id: string;
  sub_team_name: string;
  team_name: string;
  color_hex: string;
  total: number;
  checked_in: number;
}

// 1. Team Donut Chart
export const TeamDonutChart: React.FC<{
  data: TeamBreakdownItem[];
  totalRegistrations: number;
}> = ({ data, totalRegistrations }) => {
  if (totalRegistrations === 0 || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-slate-400 text-sm">
        <span>ยังไม่มีข้อมูลการลงทะเบียน</span>
      </div>
    );
  }

  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      {/* SVG Ring */}
      <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="20"
          />
          {data.map((item) => {
            const strokeDasharray = `${(item.total / totalRegistrations) * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedAngle;
            accumulatedAngle += (item.total / totalRegistrations) * circumference;

            return (
              <circle
                key={item.team_id}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={item.color_hex}
                strokeWidth="20"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-out"
              />
            );
          })}
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-800">{totalRegistrations}</span>
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            ผู้ลงทะเบียน
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {data.map((item) => {
          const pct = Math.round((item.total / totalRegistrations) * 100);
          return (
            <div key={item.team_id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: item.color_hex }}
                />
                <span className="font-semibold text-slate-700 truncate">{item.team_name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium text-slate-900">{item.total} คน</span>
                <span className="text-slate-400 w-9 text-right font-mono">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. Sub-Team Horizontal Bar Chart
export const SubTeamBarChart: React.FC<{ data: SubTeamBreakdownItem[] }> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        <span>ยังไม่มีข้อมูลทีมย่อย</span>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 7).map((item) => {
        const percentage = Math.round((item.total / maxVal) * 100);
        return (
          <div key={item.sub_team_id} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">
                {item.sub_team_name}{' '}
                <span className="text-slate-400 font-normal">({item.team_name})</span>
              </span>
              <span className="font-medium text-slate-900 font-mono">
                {item.total} คน{' '}
                <span className="text-emerald-600 text-[11px]">(เช็คอินแล้ว {item.checked_in})</span>
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: item.color_hex,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 3. Trend Area / Bar Chart
export const TrendChart: React.FC<{
  data: { hour?: string; date?: string; count: number }[];
  mode: 'hourly' | 'daily';
}> = ({ data, mode }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 5);

  return (
    <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2">
      {data.map((point, index) => {
        const heightPct = Math.max(Math.round((point.count / maxCount) * 100), 4);
        const label = mode === 'hourly' ? point.hour : point.date;
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end">
            <div className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {point.count}
            </div>
            <div
              className="w-full bg-indigo-500/80 hover:bg-indigo-600 rounded-t-md transition-all duration-300"
              style={{ height: `${heightPct}%` }}
            />
            <div className="text-[9px] text-slate-400 truncate w-full text-center mt-1">
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 4. Check-in Circular Gauge
export const CheckInGauge: React.FC<{
  checkedIn: number;
  total: number;
  percentage: number;
}> = ({ checkedIn, total, percentage }) => {
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center justify-around">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="14"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke="#10B981"
            strokeWidth="14"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute text-center pointer-events-none">
          <span className="text-2xl font-black text-slate-800 font-mono">{percentage}%</span>
          <p className="text-[10px] font-semibold text-emerald-600 uppercase">Check-in แล้ว</p>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <span className="text-slate-400 block">Check-in แล้ว</span>
          <span className="text-lg font-bold text-emerald-600 font-mono">
            {checkedIn} <span className="text-xs font-normal text-slate-500">/ {total} คน</span>
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">ยังไม่ Check-in</span>
          <span className="text-lg font-bold text-amber-500 font-mono">
            {total - checkedIn} <span className="text-xs font-normal text-slate-500">คน</span>
          </span>
        </div>
      </div>
    </div>
  );
};
