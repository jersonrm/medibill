export default function GlosasLoading() {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 animate-pulse">
      <div className="h-8 w-40 bg-gray-200 rounded mb-6" />
      <div className="h-10 w-full bg-gray-200 rounded-lg mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
