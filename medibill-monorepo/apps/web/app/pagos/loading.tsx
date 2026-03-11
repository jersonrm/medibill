export default function PagosLoading() {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 animate-pulse">
      <div className="h-8 w-40 bg-gray-200 rounded mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
