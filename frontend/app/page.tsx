"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="home-wrapper">
      <div className="home-card">
        <h1>Welcome to MyCodeEditor</h1>
        <p>Create, edit, and preview your code in real-time!</p>
        <div className="home-buttons">
          <Link href="/editor" className="btn">
            Start Coding
          </Link>
          <a href="#" className="btn-outline">
            Learn More
          </a>
        </div>
      </div>
    </div>
  );
}
