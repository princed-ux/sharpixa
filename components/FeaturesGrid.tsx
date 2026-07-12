import { FEATURES } from "@/lib/constants";
import { Icon } from "@/components/Icons";

export default function FeaturesGrid() {
 return (
 <section className="section" id="features">
 <div className="container-x">
 <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Powerful Watermark Removal Features</h2>
 <p className="text-center text-gray-500 mb-10">Everything you need to clean up your media</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {FEATURES.map((f) => (
 <div key={f.title} className="premium-card">
 <div className="feature-icon">
 <Icon name={f.icon as any} size={22} />
 </div>
 <h3 className="font-bold text-lg mb-2">{f.title}</h3>
 <p className="text-sm text-gray-500">{f.desc}</p>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
}
