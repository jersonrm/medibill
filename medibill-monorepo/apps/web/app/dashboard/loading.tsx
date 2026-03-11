export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-xl" />
    </div>
  );
}
