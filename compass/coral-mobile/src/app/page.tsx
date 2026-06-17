import { redirect } from 'next/navigation';

// Coral × Compass mobile demo entry point. Redirects to /savings —
// the canonical Maya page. (The Coral shopping-flow demo lives in the
// internal Sly repo and isn't bundled here.)
export default function Home() {
  redirect('/savings');
}
