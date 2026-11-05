import headshot from "../assets/alex-headshot.jpg";
import { curlyQuotes } from "../lib/readableText.js";

// Alex's own words, above the script preview. Keep the AI wording honest: the
// tool "uses AI, guided by" what he's learned, never "trained on" or "built on"
// NLN material (CLAUDE.md, compliance copy).
const BIO = [
  "I'm the founder of Next Level Negotiation (NLN). For the past 6+ years, I've helped mid-career to executive-level professionals negotiate their job offers and raises. I've coached 200+ professionals through negotiations at companies like Amazon, TikTok and OpenAI, and my clients average more than $26k in increases.",
  "That experience is what powers this tool. Most AI gives you advice that sounds right until a recruiter pushes back. The Job Offer Analyzer uses AI, guided by what I've learned from hundreds of real negotiations: the questions recruiters actually ask, the pushback they actually use, and the exact words that moved offers up. It then tailors your script to your role, your market and your situation.",
  "Before starting NLN, I helped launch and scale the job placement, coaching and negotiation programs at Pathrise, a career accelerator. My full-time job is in sales, so I'm negotiating every single day.",
  "I built this because most people don't think about negotiating until a recruiter puts them on the spot. My goal is to make negotiation less scary and give you the exact words to use, so you get paid what you're worth without coming across as greedy.",
];

export default function AlexIntro() {
  return (
    <section className="print:hidden bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
      <div className="flex items-center gap-4 mb-4">
        <img
          src={headshot}
          alt="Alex Immel, founder of Next Level Negotiation"
          width="80"
          height="80"
          loading="lazy"
          className="h-20 w-20 rounded-full object-cover"
        />
        <h2 className="text-2xl font-serif font-semibold text-navy-900">{curlyQuotes("Hi, I'm Alex")}</h2>
      </div>
      <div className="space-y-3">
        {BIO.map((paragraph) => (
          <p key={paragraph.slice(0, 20)} className="text-slate-800 leading-relaxed">
            {curlyQuotes(paragraph)}
          </p>
        ))}
      </div>
    </section>
  );
}
