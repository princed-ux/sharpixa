"use client";

import { useState } from "react";
import { FAQS } from "@/lib/constants";

export default function FAQ() {
 const [open, setOpen] = useState<number | null>(0);

 return (
 <section className="section" id="faq">
 <div className="container-x max-w-3xl">
 <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Frequently Asked Questions</h2>
 <p className="text-center text-gray-500 mb-10">Everything you need to know</p>
 <div className="glass rounded-2xl px-6">
 {FAQS.map((f, i) => (
 <div key={i} className="faq-item">
 <div className="faq-question" onClick={() => setOpen(open === i ? null : i)}>
 <span>{f.q}</span>
 <span
 className="text-indigo-500 text-xl transition-transform"
 style={{ transform: open === i ? "rotate(180deg)" : "rotate(0deg)" }}
 >
 {open === i ? "−" : "+"}
 </span>
 </div>
 <div className={`faq-answer ${open === i ? "open" : ""}`}>{f.a}</div>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
}
