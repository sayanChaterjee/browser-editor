"use client";

type Props = {
  activeFile: string;
  setActiveFile: (file: string) => void;
};

const files = [
  { name: "index.html", label: "HTML" },
  { name: "styles.css", label: "CSS" },
  { name: "script.js", label: "JavaScript" },
  { name: "README.md", label: "Markdown" }, 
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
          {/* Icons */}
          {file.name === "index.html" && (
            <i className="devicon-html5-plain colored" />
          )}
          {file.name === "styles.css" && (
            <i className="devicon-css3-plain colored" />
          )}
          {file.name === "script.js" && (
            <i className="devicon-javascript-plain colored" />
          )}
          {file.name === "README.md" && (
            <span style={{ fontWeight: "bold" }}>📘</span>
          )}

          <span style={{ marginLeft: "8px" }}>{file.name}</span>
        </div>
      ))}
    </div>
  );
}
