import React from 'react';

const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="py-14 px-4 text-center bg-gray-100">
      {/* Top links */}
      <nav className="flex justify-center gap-10 flex-wrap mb-6" aria-label="Footer">
        <a href="#" className="text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors">About</a>
        <a href="#" className="text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors">Blog</a>
        <a href="#" className="text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors">Jobs</a>
        <a href="#" className="text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors">Press</a>
        <a href="#" className="text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors">Accessibility</a>
        <a href="#" className="text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors">Partners</a>
      </nav>

      {/* Social icons */}
      <div className="flex justify-center gap-7 my-4" aria-label="Social links">
        <a href="#" aria-label="Facebook" className="inline-flex w-10 h-10 items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition transform hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[22px] h-[22px]" aria-hidden="true">
            <path d="M22 12.06C22 6.49 17.52 2 11.95 2S2 6.49 2 12.06c0 5.01 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.41c0-2.51 1.5-3.9 3.79-3.9 1.1 0 2.25.2 2.25.2v2.47h-1.27c-1.25 0-1.64.78-1.64 1.58v1.9h2.79l-.45 2.91h-2.34V22c4.78-.78 8.44-4.93 8.44-9.94Z" fill="currentColor"/>
          </svg>
        </a>
        <a href="#" aria-label="Instagram" className="inline-flex w-10 h-10 items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition transform hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" className="w-[22px] h-[22px]" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/>
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
          </svg>
        </a>
        <a href="#" aria-label="X" className="inline-flex w-10 h-10 items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition transform hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" className="w-[22px] h-[22px]" aria-hidden="true">
            <path d="M3 3l18 18M21 3L3 21" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </a>
        <a href="#" aria-label="GitHub" className="inline-flex w-10 h-10 items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition transform hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="w-[22px] h-[22px]" aria-hidden="true">
            <path d="M12 2a10 10 0 00-3.16 19.48c.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.61-3.37-1.19-3.37-1.19-.45-1.15-1.11-1.46-1.11-1.46-.9-.61.07-.6.07-.6 1 .07 1.53 1.04 1.53 1.04.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.26-4.55-1.11-4.55-4.93 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.28.1-2.67 0 0 .84-.27 2.75 1.02a9.6 9.6 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.39.2 2.42.1 2.67.64.7 1.03 1.59 1.03 2.68 0 3.83-2.33 4.67-4.56 4.92.36.31.68.92.68 1.86 0 1.34-.01 2.42-.01 2.75 0 .27.18.59.69.49A10 10 0 0012 2z"/>
          </svg>
        </a>
        <a href="#" aria-label="YouTube" className="inline-flex w-10 h-10 items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition transform hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="w-[22px] h-[22px]" aria-hidden="true">
            <path d="M23.5 7.2a3 3 0 00-2.12-2.12C19.6 4.5 12 4.5 12 4.5s-7.6 0-9.38.58A3 3 0 00.5 7.2 31.3 31.3 0 000 12a31.3 31.3 0 00.5 4.8 3 3 0 002.12 2.12C4.4 19.5 12 19.5 12 19.5s7.6 0 9.38-.58a3 3 0 002.12-2.12A31.3 31.3 0 0024 12a31.3 31.3 0 00-.5-4.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
          </svg>
        </a>
      </div>

      {/* Copyright */}
      <p className="text-gray-500 text-sm mt-2">© {year} Ticketory. All rights reserved.</p>
    </footer>
  );
};

export default Footer;