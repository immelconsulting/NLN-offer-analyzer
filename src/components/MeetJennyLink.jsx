import { JENNY_BIO_URL } from "../lib/config.js";

// Link to Jenny Foss's bio, shown wherever someone is deciding whether to book
// a session with her, so nobody has to book a stranger. Opens in a new tab so
// they don't lose their place in the funnel.
export default function MeetJennyLink({ children = "Meet Jenny Foss →", className = "" }) {
  return (
    <a
      href={JENNY_BIO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-medium underline underline-offset-2 transition ${className}`}
    >
      {children}
    </a>
  );
}
