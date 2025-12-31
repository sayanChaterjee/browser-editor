"use client";

type Props = {
  activeFile: string;
  setActiveFile: (file: string) => void;
};

const files = [
  { name: "index.html", label: "HTML" },
  { name: "styles.css", label: "CSS" },
  { name: "script.js", label: "JavaScript" },
];

export default function FileExplorer({ activeFile, setActiveFile }: Props) {
  return (
    <div className="explorer">
      <h4>EXPLORER</h4>
      {files.map((file) => (
        <div
          key={file.name}
          className={`file ${activeFile === file.name ? "active" : ""}`}
          onClick={() => setActiveFile(file.name)}
        >
          {file.name}
        </div>
      ))}
    </div>
  );
}
