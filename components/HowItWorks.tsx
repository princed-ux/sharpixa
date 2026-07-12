import { Icon } from "@/components/Icons";

const steps = [
 { num: "1", icon: "upload", title: "Upload", desc: "Upload your image or video via drag-and-drop or file browser." },
 { num: "2", icon: "sliders", title: "Mark or Adjust", desc: "Brush over the watermark or background, or pick enhancement settings." },
 { num: "3", icon: "wand", title: "Instant Processing", desc: "Your file is processed instantly in your browser — nothing is uploaded." },
 { num: "4", icon: "download", title: "Download", desc: "Preview and download your cleaned result with no watermarks." },
];

export default function HowItWorks() {
 return (
 <section className="section" id="how-it-works">
 <div className="container-x">
 <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">How It Works</h2>
 <p className="text-center text-gray-500 mb-10">Remove watermarks in 4 simple steps</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {steps.map((s) => (
 <div key={s.num} className="premium-card text-center relative">
 <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-bold flex items-center justify-center">
 {s.num}
 </div>
 <div className="feature-icon mx-auto">
 <Icon name={s.icon as any} size={22} />
 </div>
 <h3 className="font-bold text-lg mb-2">{s.title}</h3>
 <p className="text-sm text-gray-500">{s.desc}</p>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
}
