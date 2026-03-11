export default function ConfiguracionLoading() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded mb-6" />
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-gray-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
