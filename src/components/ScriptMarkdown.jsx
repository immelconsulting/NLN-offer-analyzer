import { Children } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Brand styling for the markdown-formatted script, shared by the paid script
// and the free preview so they look like the same document.
const markdownComponents = {
  h1: (props) => (
    <h1 className="text-2xl font-serif font-semibold text-navy-900 mt-8 mb-3 first:mt-0" {...props} />
  ),
  h2: (props) => (
    <h2 className="text-xl font-serif font-semibold text-navy-900 mt-8 mb-3 first:mt-0 border-b border-slate-200 pb-2" {...props} />
  ),
  h3: (props) => (
    <h3 className="text-lg font-serif font-semibold text-navy-900 mt-6 mb-2" {...props} />
  ),
  p: (props) => <p className="text-slate-800 leading-relaxed mb-4" {...props} />,
  ul: (props) => <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-800" {...props} />,
  ol: (props) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-800" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-navy-900" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-l-4 border-navy-200 pl-4 italic text-slate-700 mb-4" {...props} />
  ),
  hr: () => <hr className="border-slate-200 my-6" />,
  table: (props) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border border-slate-200 rounded-lg" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-navy-50 text-navy-900" {...props} />,
  th: (props) => (
    <th className="text-left font-semibold px-4 py-2 border-b border-slate-200" {...props} />
  ),
  td: (props) => <td className="px-4 py-2 border-b border-slate-100" {...props} />,
};

// The free preview sets lines to say apart from advice, so they're easy to tell
// from it at a glance.
const isSpoken = (children) =>
  Children.toArray(children).some((c) => typeof c === "string" && c.includes("🗣"));

const SPOKEN_CLASS = "bg-navy-50 border-l-4 border-navy-600 rounded-r-lg px-4 py-3 mb-4 text-slate-800 leading-relaxed";

const previewComponents = {
  ...markdownComponents,
  p: ({ children, ...props }) =>
    isSpoken(children) ? (
      <p className={SPOKEN_CLASS} {...props}>{children}</p>
    ) : (
      markdownComponents.p({ children, ...props })
    ),
  li: ({ children, ...props }) =>
    isSpoken(children) ? (
      <li className="list-none -ml-6" {...props}>
        <div className={SPOKEN_CLASS}>{children}</div>
      </li>
    ) : (
      markdownComponents.li({ children, ...props })
    ),
};

export default function ScriptMarkdown({ children, spokenBlocks = false }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={spokenBlocks ? previewComponents : markdownComponents}>
      {children}
    </ReactMarkdown>
  );
}
