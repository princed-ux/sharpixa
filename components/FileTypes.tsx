import { Icon } from "@/components/Icons";

const imgTypes = [
  { ext: "JPG", color: "#f59e0b" },
  { ext: "JPEG", color: "#f59e0b" },
  { ext: "PNG", color: "#3b82f6" },
  { ext: "WEBP", color: "#8b5cf6" },
];
const vidTypes = [
  { ext: "MP4", color: "#ef4444" },
  { ext: "MOV", color: "#10b981" },
  { ext: "AVI", color: "#f97316" },
  { ext: "WEBM", color: "#8b5cf6" },
  { ext: "MKV", color: "#06b6d4" },
];

function TypeCard({ ext, color }: { ext: string; color: string }) {
  return (
    <div className="premium-card text-center py-4 px-2">
      <div
        className="text-xs font-bold rounded-lg py-2 px-1"
        style={{ background: `${color}20`, color }}
      >
        {ext}
      </div>
    </div>
  );
}

export default function FileTypes() {
  return (
    <section className="section bg-gray-50 dark:bg-gray-900/50">
      <div className="container-x">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Supported File Types</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10">We support all major image and video formats</p>
        <div className="max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold mb-4 flex items-center justify-center gap-2">
            <Icon name="image" size={18} /> Images
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {imgTypes.map((t) => <TypeCard key={t.ext} {...t} />)}
          </div>
          <h3 className="text-lg font-semibold mb-4 flex items-center justify-center gap-2">
            <Icon name="film" size={18} /> Videos
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {vidTypes.map((t) => <TypeCard key={t.ext} {...t} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
