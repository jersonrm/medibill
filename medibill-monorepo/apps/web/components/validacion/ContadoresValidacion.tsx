"use client";

interface ContadoresValidacionProps {
  errores: number;
  advertencias: number;
  prevenidas: number;
}

export default function ContadoresValidacion({ errores, advertencias, prevenidas }: ContadoresValidacionProps) {
  const items = [
    {
      label: "Errores",
      valor: errores,
      color: "border-red-500/50 text-red-400",
      bgIcon: "bg-red-500/20",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ),
    },
    {
      label: "Advertencias",
      valor: advertencias,
      color: "border-amber-500/50 text-amber-400",
      bgIcon: "bg-amber-500/20",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        </svg>
      ),
    },
    {
      label: "Prevenidas",
      valor: prevenidas,
      color: "border-emerald-500/50 text-emerald-400",
      bgIcon: "bg-emerald-500/20",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`bg-medi-deep/60 border ${item.color} rounded-xl p-4 flex flex-col items-center gap-2`}
        >
          <div className={`${item.bgIcon} p-2 rounded-lg`}>
            {item.icon}
          </div>
          <span className="text-3xl font-bold font-mono">{item.valor}</span>
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
